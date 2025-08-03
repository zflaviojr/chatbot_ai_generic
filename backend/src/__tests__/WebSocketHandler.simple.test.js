/**
 * Testes simplificados para WebSocketHandler
 */
import { EventEmitter } from 'events';
import { WebSocketHandler } from '../handlers/WebSocketHandler.js';

// Mock simples do WebSocket Server
class MockWebSocketServer extends EventEmitter {
  constructor() {
    super();
    this.clients = new Set();
  }
}

// Mock simples do WebSocket Client
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
    // Simula envio assíncrono
    setTimeout(() => {
      this.emit('mockSend', data);
    }, 1);
  }

  close(code, reason) {
    this.readyState = this.CLOSED;
    setTimeout(() => {
      this.emit('close', code, reason);
    }, 1);
  }

  ping() {
    this.emit('ping');
  }
}

// Mock simples do MCP Manager
class MockMCPManager extends EventEmitter {
  constructor() {
    super();
    this.isConnected = true;
  }

  async sendMessage(message, sessionId) {
    // Simula processamento rápido
    return {
      id: 'mock-response-id',
      sessionId,
      message: `Resposta para: ${message}`,
      content: `Resposta para: ${message}`,
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

describe('WebSocketHandler - Testes Simplificados', () => {
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

  describe('Inicialização Básica', () => {
    test('deve inicializar corretamente', () => {
      expect(wsHandler).toBeInstanceOf(WebSocketHandler);
      expect(wsHandler.clients).toBeInstanceOf(Map);
      expect(wsHandler.sessions).toBeInstanceOf(Map);
      expect(wsHandler.wss).toBe(mockWss);
      expect(wsHandler.mcpManager).toBe(mockMcpManager);
    });

    test('deve ter métodos essenciais', () => {
      expect(typeof wsHandler.generateClientId).toBe('function');
      expect(typeof wsHandler.generateSessionId).toBe('function');
      expect(typeof wsHandler.sendToClient).toBe('function');
      expect(typeof wsHandler.broadcast).toBe('function');
      expect(typeof wsHandler.getStats).toBe('function');
    });
  });

  describe('Geração de IDs', () => {
    test('deve gerar IDs únicos para clientes', () => {
      const id1 = wsHandler.generateClientId();
      const id2 = wsHandler.generateClientId();
      
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^client_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^client_\d+_[a-z0-9]+$/);
    });

    test('deve gerar IDs únicos para sessões', () => {
      const id1 = wsHandler.generateSessionId();
      const id2 = wsHandler.generateSessionId();
      
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^session_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^session_\d+_[a-z0-9]+$/);
    });
  });

  describe('Conexão Simples', () => {
    test('deve processar nova conexão', (done) => {
      const mockWs = new MockWebSocket();
      const mockRequest = {
        socket: { remoteAddress: '127.0.0.1' },
        headers: { 'user-agent': 'test-agent' }
      };

      // Escuta mensagem de boas-vindas
      mockWs.on('mockSend', (data) => {
        const message = JSON.parse(data);
        if (message.type === 'connection') {
          expect(message.status).toBe('connected');
          expect(message.clientId).toBeDefined();
          expect(wsHandler.clients.size).toBe(1);
          done();
        }
      });

      // Simula nova conexão
      mockWss.emit('connection', mockWs, mockRequest);
    });
  });

  describe('Mensagens Básicas', () => {
    let mockWs;
    let clientId;

    beforeEach((done) => {
      mockWs = new MockWebSocket();
      const mockRequest = {
        socket: { remoteAddress: '127.0.0.1' },
        headers: { 'user-agent': 'test-agent' }
      };

      mockWs.on('mockSend', (data) => {
        const message = JSON.parse(data);
        if (message.type === 'connection') {
          clientId = message.clientId;
          done();
        }
      });

      mockWss.emit('connection', mockWs, mockRequest);
    });

    test('deve processar ping', (done) => {
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

    test('deve iniciar sessão', (done) => {
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
  });

  describe('Estatísticas', () => {
    test('deve retornar estatísticas básicas', () => {
      const stats = wsHandler.getStats();
      
      expect(stats).toHaveProperty('connectedClients');
      expect(stats).toHaveProperty('activeSessions');
      expect(stats).toHaveProperty('clients');
      expect(Array.isArray(stats.clients)).toBe(true);
      expect(typeof stats.connectedClients).toBe('number');
      expect(typeof stats.activeSessions).toBe('number');
    });
  });

  describe('Broadcast', () => {
    test('deve fazer broadcast para clientes conectados', (done) => {
      const mockWs = new MockWebSocket();
      const mockRequest = {
        socket: { remoteAddress: '127.0.0.1' },
        headers: { 'user-agent': 'test-agent' }
      };

      let connectionReceived = false;
      let broadcastReceived = false;

      mockWs.on('mockSend', (data) => {
        const message = JSON.parse(data);
        
        if (message.type === 'connection') {
          connectionReceived = true;
          
          // Envia broadcast após conexão
          setTimeout(() => {
            const sentCount = wsHandler.broadcast({
              type: 'test_broadcast',
              message: 'Mensagem de teste'
            });
            expect(sentCount).toBe(1);
          }, 10);
        }
        
        if (message.type === 'test_broadcast') {
          broadcastReceived = true;
          expect(message.message).toBe('Mensagem de teste');
          
          if (connectionReceived && broadcastReceived) {
            done();
          }
        }
      });

      mockWss.emit('connection', mockWs, mockRequest);
    });
  });

  describe('Desconexão', () => {
    test('deve processar desconexão corretamente', (done) => {
      const mockWs = new MockWebSocket();
      const mockRequest = {
        socket: { remoteAddress: '127.0.0.1' },
        headers: { 'user-agent': 'test-agent' }
      };

      mockWs.on('mockSend', (data) => {
        const message = JSON.parse(data);
        if (message.type === 'connection') {
          expect(wsHandler.clients.size).toBe(1);
          
          // Simula desconexão
          mockWs.emit('close', 1000, 'Normal closure');
          
          // Verifica se cliente foi removido
          setTimeout(() => {
            expect(wsHandler.clients.size).toBe(0);
            done();
          }, 10);
        }
      });

      mockWss.emit('connection', mockWs, mockRequest);
    });
  });
});