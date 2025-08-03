/**
 * Testes unitários para WebSocketHandler
 */
import { EventEmitter } from 'events';
import { WebSocketHandler } from '../handlers/WebSocketHandler.js';

// Mock do WebSocket Server
class MockWebSocketServer extends EventEmitter {
  constructor() {
    super();
    this.clients = new Set();
  }
}

// Mock do WebSocket Client
class MockWebSocket extends EventEmitter {
  constructor() {
    super();
    this.readyState = 1; // OPEN
    this.OPEN = 1;
    this.CLOSED = 3;
    this.sentMessages = [];
  }

  send(data) {
    this.sentMessages.push(data);
    // Simula envio de mensagem
    this.emit('mockSend', data);
  }

  close(code, reason) {
    this.readyState = this.CLOSED;
    this.emit('close', code, reason);
  }

  ping() {
    this.emit('ping');
  }
}

// Mock do MCP Connection Manager
class MockMCPManager extends EventEmitter {
  constructor() {
    super();
    this.isConnected = true;
  }

  async sendMessage(message, sessionId) {
    // Simula delay de processamento
    await new Promise(resolve => setTimeout(resolve, 10));
    
    return {
      id: 'mock-response-id',
      sessionId,
      message: `Resposta para: ${message}`,
      content: `Resposta para: ${message}`,
      usage: {
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30
      },
      timestamp: new Date().toISOString()
    };
  }

  getStats() {
    return {
      isConnected: this.isConnected,
      activeRequests: 0
    };
  }
}

describe('WebSocketHandler', () => {
  let wsHandler;
  let mockWss;
  let mockMcpManager;

  beforeEach(() => {
    mockWss = new MockWebSocketServer();
    mockMcpManager = new MockMCPManager();
    wsHandler = new WebSocketHandler(mockWss, mockMcpManager);
  });

  afterEach(() => {
    if (wsHandler) {
      wsHandler.removeAllListeners();
    }
  });

  describe('Inicialização', () => {
    test('deve inicializar corretamente', () => {
      expect(wsHandler).toBeInstanceOf(WebSocketHandler);
      expect(wsHandler.clients).toBeInstanceOf(Map);
      expect(wsHandler.sessions).toBeInstanceOf(Map);
      expect(wsHandler.wss).toBe(mockWss);
      expect(wsHandler.mcpManager).toBe(mockMcpManager);
    });

    test('deve configurar listeners do WebSocket Server', () => {
      expect(mockWss.listenerCount('connection')).toBeGreaterThan(0);
    });
  });

  describe('Conexão de Clientes', () => {
    test('deve processar nova conexão', () => {
      const mockWs = new MockWebSocket();
      const mockRequest = {
        socket: { remoteAddress: '127.0.0.1' },
        headers: { 'user-agent': 'test-agent' }
      };

      // Simula nova conexão
      mockWss.emit('connection', mockWs, mockRequest);

      expect(wsHandler.clients.size).toBe(1);
      
      const clientInfo = Array.from(wsHandler.clients.values())[0];
      expect(clientInfo.ws).toBe(mockWs);
      expect(clientInfo.ip).toBe('127.0.0.1');
    });

    test('deve enviar mensagem de boas-vindas', (done) => {
      const mockWs = new MockWebSocket();
      const mockRequest = {
        socket: { remoteAddress: '127.0.0.1' },
        headers: { 'user-agent': 'test-agent' }
      };

      mockWs.on('mockSend', (data) => {
        const message = JSON.parse(data);
        if (message.type === 'connection') {
          expect(message.status).toBe('connected');
          expect(message.clientId).toBeDefined();
          done();
        }
      });

      mockWss.emit('connection', mockWs, mockRequest);
    });
  });

  describe('Processamento de Mensagens', () => {
    let mockWs;
    let clientId;

    beforeEach(() => {
      mockWs = new MockWebSocket();
      const mockRequest = {
        socket: { remoteAddress: '127.0.0.1' },
        headers: { 'user-agent': 'test-agent' }
      };

      mockWss.emit('connection', mockWs, mockRequest);
      clientId = Array.from(wsHandler.clients.keys())[0];
    });

    test('deve processar mensagem de ping', (done) => {
      mockWs.on('mockSend', (data) => {
        const message = JSON.parse(data);
        if (message.type === 'pong') {
          expect(message.timestamp).toBeDefined();
          done();
        }
      });

      mockWs.emit('message', Buffer.from(JSON.stringify({
        type: 'ping'
      })));
    });

    test('deve iniciar sessão de chat', (done) => {
      mockWs.on('mockSend', (data) => {
        const message = JSON.parse(data);
        if (message.type === 'session_started') {
          expect(message.sessionId).toBeDefined();
          expect(wsHandler.sessions.size).toBe(1);
          done();
        }
      });

      mockWs.emit('message', Buffer.from(JSON.stringify({
        type: 'session_start'
      })));
    });

    test('deve processar mensagem de chat', async () => {
      // Primeiro inicia sessão
      mockWs.emit('message', Buffer.from(JSON.stringify({
        type: 'session_start'
      })));

      // Aguarda processamento da sessão
      await new Promise(resolve => setTimeout(resolve, 50));

      let typingReceived = false;
      let responseReceived = false;

      mockWs.on('mockSend', (data) => {
        const message = JSON.parse(data);
        
        if (message.type === 'typing' && message.isTyping) {
          typingReceived = true;
        }
        
        if (message.type === 'chat_response') {
          responseReceived = true;
          expect(message.content).toContain('Resposta para:');
          expect(message.messageId).toBe('test-msg-1');
        }
      });

      // Envia mensagem de chat
      mockWs.emit('message', Buffer.from(JSON.stringify({
        type: 'chat',
        content: 'Olá, como você está?',
        messageId: 'test-msg-1'
      })));

      // Aguarda processamento
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(typingReceived).toBe(true);
      expect(responseReceived).toBe(true);
    }, 10000);

    test('deve encerrar sessão de chat', (done) => {
      // Primeiro inicia sessão
      mockWs.emit('message', Buffer.from(JSON.stringify({
        type: 'session_start'
      })));

      let sessionId = null;

      mockWs.on('mockSend', (data) => {
        const message = JSON.parse(data);
        
        if (message.type === 'session_started') {
          sessionId = message.sessionId;
          
          // Encerra sessão
          mockWs.emit('message', Buffer.from(JSON.stringify({
            type: 'session_end'
          })));
        }
        
        if (message.type === 'session_ended') {
          expect(message.sessionId).toBe(sessionId);
          expect(wsHandler.sessions.size).toBe(0);
          done();
        }
      });
    });

    test('deve tratar mensagem inválida', (done) => {
      mockWs.on('mockSend', (data) => {
        const message = JSON.parse(data);
        if (message.type === 'error') {
          expect(message.message).toContain('inválido');
          done();
        }
      });

      // Envia JSON inválido
      mockWs.emit('message', Buffer.from('mensagem-invalida'));
    });

    test('deve tratar tipo de mensagem desconhecido', (done) => {
      mockWs.on('mockSend', (data) => {
        const message = JSON.parse(data);
        if (message.type === 'error') {
          expect(message.message).toContain('não suportado');
          done();
        }
      });

      mockWs.emit('message', Buffer.from(JSON.stringify({
        type: 'tipo_inexistente'
      })));
    });
  });

  describe('Gerenciamento de Sessões', () => {
    test('deve gerar IDs únicos para clientes', () => {
      const id1 = wsHandler.generateClientId();
      const id2 = wsHandler.generateClientId();
      
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^client_\d+_[a-z0-9]+$/);
    });

    test('deve gerar IDs únicos para sessões', () => {
      const id1 = wsHandler.generateSessionId();
      const id2 = wsHandler.generateSessionId();
      
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^session_\d+_[a-z0-9]+$/);
    });
  });

  describe('Desconexão de Clientes', () => {
    test('deve processar desconexão corretamente', () => {
      const mockWs = new MockWebSocket();
      const mockRequest = {
        socket: { remoteAddress: '127.0.0.1' },
        headers: { 'user-agent': 'test-agent' }
      };

      // Conecta cliente
      mockWss.emit('connection', mockWs, mockRequest);
      expect(wsHandler.clients.size).toBe(1);

      // Desconecta cliente
      mockWs.emit('close', 1000, 'Normal closure');
      expect(wsHandler.clients.size).toBe(0);
    });

    test('deve limpar sessão ao desconectar', async () => {
      const mockWs = new MockWebSocket();
      const mockRequest = {
        socket: { remoteAddress: '127.0.0.1' },
        headers: { 'user-agent': 'test-agent' }
      };

      // Conecta e inicia sessão
      mockWss.emit('connection', mockWs, mockRequest);
      mockWs.emit('message', Buffer.from(JSON.stringify({
        type: 'session_start'
      })));

      // Aguarda processamento
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(wsHandler.sessions.size).toBe(1);
      
      // Desconecta
      mockWs.emit('close', 1000, 'Normal closure');
      expect(wsHandler.sessions.size).toBe(0);
    });
  });

  describe('Broadcast e Comunicação', () => {
    test('deve enviar mensagem para cliente específico', () => {
      const mockWs = new MockWebSocket();
      const mockRequest = {
        socket: { remoteAddress: '127.0.0.1' },
        headers: { 'user-agent': 'test-agent' }
      };

      mockWss.emit('connection', mockWs, mockRequest);
      const clientId = Array.from(wsHandler.clients.keys())[0];

      let messageSent = false;
      mockWs.on('mockSend', (data) => {
        const message = JSON.parse(data);
        if (message.type === 'test') {
          messageSent = true;
        }
      });

      const result = wsHandler.sendToClient(clientId, {
        type: 'test',
        message: 'Mensagem de teste'
      });

      expect(result).toBe(true);
      expect(messageSent).toBe(true);
    });

    test('deve fazer broadcast para todos os clientes', () => {
      const mockWs1 = new MockWebSocket();
      const mockWs2 = new MockWebSocket();
      const mockRequest = {
        socket: { remoteAddress: '127.0.0.1' },
        headers: { 'user-agent': 'test-agent' }
      };

      // Conecta dois clientes
      mockWss.emit('connection', mockWs1, mockRequest);
      mockWss.emit('connection', mockWs2, mockRequest);

      let messagesReceived = 0;
      const testMessage = { type: 'broadcast', message: 'Mensagem para todos' };

      [mockWs1, mockWs2].forEach(ws => {
        ws.on('mockSend', (data) => {
          const message = JSON.parse(data);
          if (message.type === 'broadcast') {
            messagesReceived++;
          }
        });
      });

      const sentCount = wsHandler.broadcast(testMessage);
      expect(sentCount).toBe(2);
      expect(messagesReceived).toBe(2);
    });
  });

  describe('Estatísticas', () => {
    test('deve retornar estatísticas corretas', () => {
      const stats = wsHandler.getStats();
      
      expect(stats).toHaveProperty('connectedClients');
      expect(stats).toHaveProperty('activeSessions');
      expect(stats).toHaveProperty('clients');
      expect(Array.isArray(stats.clients)).toBe(true);
    });
  });

  describe('Shutdown', () => {
    test('deve encerrar graciosamente', async () => {
      const mockWs = new MockWebSocket();
      const mockRequest = {
        socket: { remoteAddress: '127.0.0.1' },
        headers: { 'user-agent': 'test-agent' }
      };

      mockWss.emit('connection', mockWs, mockRequest);
      expect(wsHandler.clients.size).toBe(1);

      let shutdownMessageReceived = false;
      mockWs.on('mockSend', (data) => {
        const message = JSON.parse(data);
        if (message.type === 'system' && message.message.includes('reiniciado')) {
          shutdownMessageReceived = true;
        }
      });

      await wsHandler.shutdown();

      expect(shutdownMessageReceived).toBe(true);
      expect(wsHandler.clients.size).toBe(0);
      expect(wsHandler.sessions.size).toBe(0);
    });
  });

  describe('Integração com MCP', () => {
    test('deve configurar handlers para eventos MCP', () => {
      expect(mockMcpManager.listenerCount('connected')).toBeGreaterThan(0);
      expect(mockMcpManager.listenerCount('disconnected')).toBeGreaterThan(0);
      expect(mockMcpManager.listenerCount('error')).toBeGreaterThan(0);
    });

    test('deve broadcast quando MCP conecta', (done) => {
      const mockWs = new MockWebSocket();
      const mockRequest = {
        socket: { remoteAddress: '127.0.0.1' },
        headers: { 'user-agent': 'test-agent' }
      };

      mockWss.emit('connection', mockWs, mockRequest);

      mockWs.on('mockSend', (data) => {
        const message = JSON.parse(data);
        if (message.type === 'system' && message.message.includes('conectado')) {
          done();
        }
      });

      mockMcpManager.emit('connected');
    });

    test('deve broadcast quando MCP desconecta', (done) => {
      const mockWs = new MockWebSocket();
      const mockRequest = {
        socket: { remoteAddress: '127.0.0.1' },
        headers: { 'user-agent': 'test-agent' }
      };

      mockWss.emit('connection', mockWs, mockRequest);

      mockWs.on('mockSend', (data) => {
        const message = JSON.parse(data);
        if (message.type === 'system' && message.message.includes('indisponível')) {
          done();
        }
      });

      mockMcpManager.emit('disconnected');
    });
  });
});