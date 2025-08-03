/**
 * Testes de integração para o servidor WebSocket
 */
import { jest } from '@jest/globals';
import WebSocket from 'ws';
import request from 'supertest';
import { app, server, mcpManager, wsHandler } from '../server.js';

describe('Integração do Servidor WebSocket', () => {
  let testServer;
  let wsClient;
  const TEST_PORT = 3002;

  beforeAll(async () => {
    // Inicia servidor de teste em porta diferente
    testServer = server.listen(TEST_PORT);
    await new Promise(resolve => testServer.on('listening', resolve));
  });

  afterAll(async () => {
    // Fecha conexões WebSocket
    if (wsClient && wsClient.readyState === WebSocket.OPEN) {
      wsClient.close();
    }

    // Encerra servidor
    if (testServer) {
      await new Promise(resolve => testServer.close(resolve));
    }
  });

  afterEach(() => {
    if (wsClient && wsClient.readyState === WebSocket.OPEN) {
      wsClient.close();
    }
  });

  describe('Endpoints HTTP', () => {
    test('GET /health deve retornar status ok', async () => {
      const response = await request(app).get('/health');
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.server).toBeDefined();
    });

    test('GET /config deve retornar configurações', async () => {
      const response = await request(app).get('/config');
      
      expect(response.status).toBe(200);
      expect(response.body.cors).toBeDefined();
      expect(response.body.mcp).toBeDefined();
      expect(response.body.websocket).toBeDefined();
    });

    test('GET /api/info deve retornar informações do chatbot', async () => {
      const response = await request(app).get('/api/info');
      
      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Chatbot Web MCP');
      expect(response.body.version).toBeDefined();
      expect(response.body.features).toBeInstanceOf(Array);
    });

    test('POST /api/validate-message deve validar mensagens', async () => {
      const validMessage = { message: 'Olá, como você está?' };
      const response = await request(app)
        .post('/api/validate-message')
        .send(validMessage);
      
      expect(response.status).toBe(200);
      expect(response.body.valid).toBe(true);
      expect(response.body.length).toBe(validMessage.message.length);
    });

    test('POST /api/validate-message deve rejeitar mensagem vazia', async () => {
      const invalidMessage = { message: '' };
      const response = await request(app)
        .post('/api/validate-message')
        .send(invalidMessage);
      
      expect(response.status).toBe(400);
      expect(response.body.valid).toBe(false);
      expect(response.body.error).toContain('vazia');
    });

    test('Rota inexistente deve retornar 404', async () => {
      const response = await request(app).get('/rota-inexistente');
      
      expect(response.status).toBe(404);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('Conexão WebSocket', () => {
    test('deve conectar com sucesso', (done) => {
      wsClient = new WebSocket(`ws://localhost:${TEST_PORT}/ws`);
      
      wsClient.on('open', () => {
        expect(wsClient.readyState).toBe(WebSocket.OPEN);
        done();
      });

      wsClient.on('error', (error) => {
        done(error);
      });
    });

    test('deve receber mensagem de boas-vindas', (done) => {
      wsClient = new WebSocket(`ws://localhost:${TEST_PORT}/ws`);
      
      wsClient.on('message', (data) => {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'connection') {
          expect(message.status).toBe('connected');
          expect(message.clientId).toBeDefined();
          done();
        }
      });

      wsClient.on('error', done);
    });

    test('deve responder a ping com pong', (done) => {
      wsClient = new WebSocket(`ws://localhost:${TEST_PORT}/ws`);
      
      wsClient.on('open', () => {
        wsClient.send(JSON.stringify({
          type: 'ping',
          timestamp: new Date().toISOString()
        }));
      });

      wsClient.on('message', (data) => {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'pong') {
          expect(message.timestamp).toBeDefined();
          done();
        }
      });

      wsClient.on('error', done);
    });
  });

  describe('Fluxo de Chat via WebSocket', () => {
    test('deve iniciar sessão de chat', (done) => {
      wsClient = new WebSocket(`ws://localhost:${TEST_PORT}/ws`);
      
      wsClient.on('open', () => {
        wsClient.send(JSON.stringify({
          type: 'session_start',
          timestamp: new Date().toISOString()
        }));
      });

      wsClient.on('message', (data) => {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'session_started') {
          expect(message.sessionId).toBeDefined();
          expect(message.timestamp).toBeDefined();
          done();
        }
      });

      wsClient.on('error', done);
    });

    test('deve processar mensagem de chat', (done) => {
      wsClient = new WebSocket(`ws://localhost:${TEST_PORT}/ws`);
      let sessionStarted = false;
      let typingReceived = false;
      
      wsClient.on('open', () => {
        // Primeiro inicia sessão
        wsClient.send(JSON.stringify({
          type: 'session_start',
          timestamp: new Date().toISOString()
        }));
      });

      wsClient.on('message', (data) => {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'session_started' && !sessionStarted) {
          sessionStarted = true;
          
          // Envia mensagem de chat
          wsClient.send(JSON.stringify({
            type: 'chat',
            content: 'Olá, como você está?',
            messageId: 'test-msg-1',
            timestamp: new Date().toISOString()
          }));
        }
        
        if (message.type === 'typing' && message.isTyping && !typingReceived) {
          typingReceived = true;
          expect(message.isTyping).toBe(true);
        }
        
        if (message.type === 'chat_response') {
          expect(message.content).toBeDefined();
          expect(message.messageId).toBe('test-msg-1');
          expect(message.timestamp).toBeDefined();
          done();
        }
      });

      wsClient.on('error', done);
    });

    test('deve encerrar sessão de chat', (done) => {
      wsClient = new WebSocket(`ws://localhost:${TEST_PORT}/ws`);
      let sessionId = null;
      
      wsClient.on('open', () => {
        wsClient.send(JSON.stringify({
          type: 'session_start',
          timestamp: new Date().toISOString()
        }));
      });

      wsClient.on('message', (data) => {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'session_started') {
          sessionId = message.sessionId;
          
          // Encerra sessão
          wsClient.send(JSON.stringify({
            type: 'session_end',
            timestamp: new Date().toISOString()
          }));
        }
        
        if (message.type === 'session_ended') {
          expect(message.sessionId).toBe(sessionId);
          expect(message.timestamp).toBeDefined();
          done();
        }
      });

      wsClient.on('error', done);
    });
  });

  describe('Tratamento de Erros WebSocket', () => {
    test('deve tratar mensagem inválida', (done) => {
      wsClient = new WebSocket(`ws://localhost:${TEST_PORT}/ws`);
      
      wsClient.on('open', () => {
        // Envia JSON inválido
        wsClient.send('mensagem-invalida');
      });

      wsClient.on('message', (data) => {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'error') {
          expect(message.message).toContain('inválido');
          done();
        }
      });

      wsClient.on('error', done);
    });

    test('deve tratar tipo de mensagem desconhecido', (done) => {
      wsClient = new WebSocket(`ws://localhost:${TEST_PORT}/ws`);
      
      wsClient.on('open', () => {
        wsClient.send(JSON.stringify({
          type: 'tipo_inexistente',
          data: 'teste'
        }));
      });

      wsClient.on('message', (data) => {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'error') {
          expect(message.message).toContain('não suportado');
          done();
        }
      });

      wsClient.on('error', done);
    });

    test('deve tratar chat sem sessão', (done) => {
      wsClient = new WebSocket(`ws://localhost:${TEST_PORT}/ws`);
      
      wsClient.on('open', () => {
        // Tenta enviar chat sem iniciar sessão
        wsClient.send(JSON.stringify({
          type: 'chat',
          content: 'Mensagem sem sessão',
          messageId: 'test-msg-error'
        }));
      });

      wsClient.on('message', (data) => {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'error') {
          expect(message.message).toContain('obrigatório');
          done();
        }
      });

      wsClient.on('error', done);
    });
  });

  describe('Estatísticas e Monitoramento', () => {
    test('wsHandler deve fornecer estatísticas', () => {
      const stats = wsHandler.getStats();
      
      expect(stats).toBeDefined();
      expect(typeof stats.connectedClients).toBe('number');
      expect(typeof stats.activeSessions).toBe('number');
      expect(Array.isArray(stats.clients)).toBe(true);
    });

    test('mcpManager deve fornecer estatísticas', () => {
      const stats = mcpManager.getStats();
      
      expect(stats).toBeDefined();
      expect(stats.isConnected).toBeDefined();
      expect(stats.config).toBeDefined();
    });
  });

  describe('Limpeza e Shutdown', () => {
    test('deve limpar conexões inativas', async () => {
      // Cria conexão que será considerada inativa
      const inactiveClient = new WebSocket(`ws://localhost:${TEST_PORT}/ws`);
      
      await new Promise(resolve => {
        inactiveClient.on('open', resolve);
      });

      const initialStats = wsHandler.getStats();
      const initialConnections = initialStats.connectedClients;

      // Simula limpeza (normalmente seria automática)
      // Em um teste real, aguardaríamos o timeout
      inactiveClient.close();

      // Aguarda um pouco para processamento
      await new Promise(resolve => setTimeout(resolve, 100));

      const finalStats = wsHandler.getStats();
      expect(finalStats.connectedClients).toBeLessThanOrEqual(initialConnections);
    });
  });
});