/**
 * Testes de integração específicos para roteamento de mensagens WebSocket
 * Verifica os requisitos 4.1, 4.2, 4.3 da especificação
 */
import { jest } from '@jest/globals';
import WebSocket from 'ws';
import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { WebSocketHandler } from '../handlers/WebSocketHandler.js';
import { MCPConnectionManager } from '../mcp/MCPConnectionManager.js';

describe('Integração WebSocket Message Routing', () => {
  let testServer;
  let wsClient;
  let testMcpManager;
  let testWsHandler;
  const TEST_PORT = 3003;

  beforeAll(async () => {
    // Cria instâncias de teste
    testMcpManager = new MCPConnectionManager({
      serverUrl: 'https://test-mcp-server.com',
      apiKey: 'test-api-key',
      modelName: 'gpt-4',
      maxTokens: 1000,
      temperature: 0.7
    });

    // Cria app Express de teste
    const testApp = express();
    testApp.use(cors());
    testApp.use(express.json());

    // Cria servidor HTTP de teste
    testServer = createServer(testApp);

    // Configura WebSocket Server de teste
    const testWss = new WebSocketServer({ 
      server: testServer,
      path: '/ws',
      clientTracking: true
    });

    // Inicializa handler WebSocket de teste
    testWsHandler = new WebSocketHandler(testWss, testMcpManager);

    // Conecta MCP de teste
    await testMcpManager.connect();

    // Inicia servidor de teste
    await new Promise((resolve) => {
      testServer.listen(TEST_PORT, resolve);
    });
  });

  afterAll(async () => {
    if (wsClient && wsClient.readyState === WebSocket.OPEN) {
      wsClient.close();
    }
    if (testServer) {
      await new Promise(resolve => testServer.close(resolve));
    }
  });

  afterEach(() => {
    if (wsClient && wsClient.readyState === WebSocket.OPEN) {
      wsClient.close();
    }
  });

  describe('Requirement 4.1: Conexão MCP quando usuário envia pergunta', () => {
    test('deve conectar com MCP ao processar mensagem de chat', (done) => {
      wsClient = new WebSocket(`ws://localhost:${TEST_PORT}/ws`);
      let sessionStarted = false;

      wsClient.on('open', () => {
        // Inicia sessão primeiro
        wsClient.send(JSON.stringify({
          type: 'session_start',
          timestamp: new Date().toISOString()
        }));
      });

      wsClient.on('message', (data) => {
        const message = JSON.parse(data.toString());

        if (message.type === 'session_started' && !sessionStarted) {
          sessionStarted = true;
          
          // Verifica se MCP está conectado antes de enviar mensagem
          const mcpStats = testMcpManager.getStats();
          expect(mcpStats.isConnected).toBe(true);

          // Envia mensagem de chat
          wsClient.send(JSON.stringify({
            type: 'chat',
            content: 'Como você pode me ajudar?',
            messageId: 'test-routing-1',
            timestamp: new Date().toISOString()
          }));
        }

        if (message.type === 'chat_response') {
          // Verifica que a resposta foi processada via MCP
          expect(message.content).toBeDefined();
          expect(message.messageId).toBe('test-routing-1');
          expect(message.usage).toBeDefined();
          done();
        }
      });

      wsClient.on('error', done);
    });

    test('deve mostrar erro quando MCP não está disponível', async () => {
      // Desconecta MCP temporariamente
      await testMcpManager.disconnect();

      wsClient = new WebSocket(`ws://localhost:${TEST_PORT}/ws`);
      let sessionStarted = false;

      const errorPromise = new Promise((resolve) => {
        wsClient.on('message', (data) => {
          const message = JSON.parse(data.toString());

          if (message.type === 'session_started' && !sessionStarted) {
            sessionStarted = true;
            
            // Tenta enviar mensagem com MCP desconectado
            wsClient.send(JSON.stringify({
              type: 'chat',
              content: 'Teste com MCP desconectado',
              messageId: 'test-error-1'
            }));
          }

          if (message.type === 'chat_error') {
            expect(message.messageId).toBe('test-error-1');
            expect(message.message).toContain('Erro ao processar');
            resolve();
          }
        });
      });

      wsClient.on('open', () => {
        wsClient.send(JSON.stringify({
          type: 'session_start',
          timestamp: new Date().toISOString()
        }));
      });

      await errorPromise;

      // Reconecta MCP para outros testes
      await testMcpManager.connect();
    });
  });

  describe('Requirement 4.2: Envio de pergunta para bot especializado', () => {
    test('deve rotear mensagem do usuário para MCP manager', (done) => {
      wsClient = new WebSocket(`ws://localhost:${TEST_PORT}/ws`);
      let sessionStarted = false;

      // Spy no método sendMessage do MCP manager
      const originalSendMessage = testMcpManager.sendMessage;
      let mcpMessageReceived = false;

      testMcpManager.sendMessage = async function(message, sessionId) {
        mcpMessageReceived = true;
        expect(message).toBe('Qual é o seu propósito?');
        expect(sessionId).toBeDefined();
        
        // Chama método original
        const result = await originalSendMessage.call(this, message, sessionId);
        
        // Restaura método original
        testMcpManager.sendMessage = originalSendMessage;
        
        return result;
      };

      wsClient.on('open', () => {
        wsClient.send(JSON.stringify({
          type: 'session_start',
          timestamp: new Date().toISOString()
        }));
      });

      wsClient.on('message', (data) => {
        const message = JSON.parse(data.toString());

        if (message.type === 'session_started' && !sessionStarted) {
          sessionStarted = true;
          
          wsClient.send(JSON.stringify({
            type: 'chat',
            content: 'Qual é o seu propósito?',
            messageId: 'test-routing-2'
          }));
        }

        if (message.type === 'chat_response') {
          expect(mcpMessageReceived).toBe(true);
          done();
        }
      });

      wsClient.on('error', done);
    });

    test('deve incluir sessionId no roteamento para MCP', (done) => {
      wsClient = new WebSocket(`ws://localhost:${TEST_PORT}/ws`);
      let sessionId = null;
      let sessionStarted = false;

      // Spy no método sendMessage
      const originalSendMessage = testMcpManager.sendMessage;
      testMcpManager.sendMessage = async function(message, receivedSessionId) {
        expect(receivedSessionId).toBe(sessionId);
        
        const result = await originalSendMessage.call(this, message, receivedSessionId);
        testMcpManager.sendMessage = originalSendMessage;
        
        return result;
      };

      wsClient.on('open', () => {
        wsClient.send(JSON.stringify({
          type: 'session_start',
          timestamp: new Date().toISOString()
        }));
      });

      wsClient.on('message', (data) => {
        const message = JSON.parse(data.toString());

        if (message.type === 'session_started' && !sessionStarted) {
          sessionStarted = true;
          sessionId = message.sessionId;
          
          wsClient.send(JSON.stringify({
            type: 'chat',
            content: 'Teste com sessionId',
            messageId: 'test-session-routing'
          }));
        }

        if (message.type === 'chat_response') {
          done();
        }
      });

      wsClient.on('error', done);
    });
  });

  describe('Requirement 4.3: Exibição de resposta na interface', () => {
    test('deve formatar resposta MCP corretamente para cliente', (done) => {
      wsClient = new WebSocket(`ws://localhost:${TEST_PORT}/ws`);
      let sessionStarted = false;

      wsClient.on('open', () => {
        wsClient.send(JSON.stringify({
          type: 'session_start',
          timestamp: new Date().toISOString()
        }));
      });

      wsClient.on('message', (data) => {
        const message = JSON.parse(data.toString());

        if (message.type === 'session_started' && !sessionStarted) {
          sessionStarted = true;
          
          wsClient.send(JSON.stringify({
            type: 'chat',
            content: 'Teste formatação de resposta',
            messageId: 'test-format-1'
          }));
        }

        if (message.type === 'chat_response') {
          // Verifica estrutura da resposta
          expect(message).toHaveProperty('type', 'chat_response');
          expect(message).toHaveProperty('messageId', 'test-format-1');
          expect(message).toHaveProperty('content');
          expect(message).toHaveProperty('timestamp');
          expect(message).toHaveProperty('usage');
          
          // Verifica estrutura do usage
          expect(message.usage).toHaveProperty('promptTokens');
          expect(message.usage).toHaveProperty('completionTokens');
          expect(message.usage).toHaveProperty('totalTokens');
          
          // Verifica que timestamp é válido
          expect(new Date(message.timestamp)).toBeInstanceOf(Date);
          
          done();
        }
      });

      wsClient.on('error', done);
    });

    test('deve mostrar indicador de digitação durante processamento', (done) => {
      wsClient = new WebSocket(`ws://localhost:${TEST_PORT}/ws`);
      let sessionStarted = false;
      let typingStartReceived = false;
      let typingEndReceived = false;

      wsClient.on('open', () => {
        wsClient.send(JSON.stringify({
          type: 'session_start',
          timestamp: new Date().toISOString()
        }));
      });

      wsClient.on('message', (data) => {
        const message = JSON.parse(data.toString());

        if (message.type === 'session_started' && !sessionStarted) {
          sessionStarted = true;
          
          wsClient.send(JSON.stringify({
            type: 'chat',
            content: 'Teste indicador de digitação',
            messageId: 'test-typing-1'
          }));
        }

        if (message.type === 'typing') {
          if (message.isTyping && !typingStartReceived) {
            typingStartReceived = true;
            expect(message.isTyping).toBe(true);
          } else if (!message.isTyping && !typingEndReceived) {
            typingEndReceived = true;
            expect(message.isTyping).toBe(false);
          }
        }

        if (message.type === 'chat_response') {
          expect(typingStartReceived).toBe(true);
          expect(typingEndReceived).toBe(true);
          done();
        }
      });

      wsClient.on('error', done);
    });
  });

  describe('Gerenciamento de Sessões no Roteamento', () => {
    test('deve manter contexto de sessão durante múltiplas mensagens', (done) => {
      wsClient = new WebSocket(`ws://localhost:${TEST_PORT}/ws`);
      let sessionId = null;
      let sessionStarted = false;
      let firstResponseReceived = false;

      wsClient.on('open', () => {
        wsClient.send(JSON.stringify({
          type: 'session_start',
          timestamp: new Date().toISOString()
        }));
      });

      wsClient.on('message', (data) => {
        const message = JSON.parse(data.toString());

        if (message.type === 'session_started' && !sessionStarted) {
          sessionStarted = true;
          sessionId = message.sessionId;
          
          // Primeira mensagem
          wsClient.send(JSON.stringify({
            type: 'chat',
            content: 'Primeira mensagem',
            messageId: 'test-context-1'
          }));
        }

        if (message.type === 'chat_response' && message.messageId === 'test-context-1' && !firstResponseReceived) {
          firstResponseReceived = true;
          
          // Segunda mensagem na mesma sessão
          wsClient.send(JSON.stringify({
            type: 'chat',
            content: 'Segunda mensagem',
            messageId: 'test-context-2'
          }));
        }

        if (message.type === 'chat_response' && message.messageId === 'test-context-2') {
          // Verifica que a sessão foi mantida
          const stats = testWsHandler.getStats();
          const activeSession = Array.from(testWsHandler.sessions.values()).find(s => s.id === sessionId);
          
          expect(activeSession).toBeDefined();
          expect(activeSession.clientId).toBeDefined();
          done();
        }
      });

      wsClient.on('error', done);
    });

    test('deve limpar sessão ao encerrar', (done) => {
      wsClient = new WebSocket(`ws://localhost:${TEST_PORT}/ws`);
      let sessionId = null;
      let sessionStarted = false;

      wsClient.on('open', () => {
        wsClient.send(JSON.stringify({
          type: 'session_start',
          timestamp: new Date().toISOString()
        }));
      });

      wsClient.on('message', (data) => {
        const message = JSON.parse(data.toString());

        if (message.type === 'session_started' && !sessionStarted) {
          sessionStarted = true;
          sessionId = message.sessionId;
          
          // Verifica que sessão foi criada
          expect(testWsHandler.sessions.has(sessionId)).toBe(true);
          
          // Encerra sessão
          wsClient.send(JSON.stringify({
            type: 'session_end',
            timestamp: new Date().toISOString()
          }));
        }

        if (message.type === 'session_ended') {
          // Verifica que sessão foi removida
          expect(testWsHandler.sessions.has(sessionId)).toBe(false);
          done();
        }
      });

      wsClient.on('error', done);
    });
  });

  describe('Tratamento de Erros no Roteamento', () => {
    test('deve tratar erro de validação de mensagem', (done) => {
      wsClient = new WebSocket(`ws://localhost:${TEST_PORT}/ws`);
      let sessionStarted = false;

      wsClient.on('open', () => {
        wsClient.send(JSON.stringify({
          type: 'session_start',
          timestamp: new Date().toISOString()
        }));
      });

      wsClient.on('message', (data) => {
        const message = JSON.parse(data.toString());

        if (message.type === 'session_started' && !sessionStarted) {
          sessionStarted = true;
          
          // Envia mensagem sem conteúdo
          wsClient.send(JSON.stringify({
            type: 'chat',
            content: '',
            messageId: 'test-validation-error'
          }));
        }

        if (message.type === 'error') {
          expect(message.message).toContain('obrigatório');
          done();
        }
      });

      wsClient.on('error', done);
    });

    test('deve parar indicador de digitação em caso de erro', (done) => {
      // Simula erro no MCP manager
      const originalSendMessage = testMcpManager.sendMessage;
      testMcpManager.sendMessage = async function() {
        throw new Error('Erro simulado no MCP');
      };

      wsClient = new WebSocket(`ws://localhost:${TEST_PORT}/ws`);
      let sessionStarted = false;
      let typingStoppedAfterError = false;

      wsClient.on('open', () => {
        wsClient.send(JSON.stringify({
          type: 'session_start',
          timestamp: new Date().toISOString()
        }));
      });

      wsClient.on('message', (data) => {
        const message = JSON.parse(data.toString());

        if (message.type === 'session_started' && !sessionStarted) {
          sessionStarted = true;
          
          wsClient.send(JSON.stringify({
            type: 'chat',
            content: 'Mensagem que causará erro',
            messageId: 'test-error-typing'
          }));
        }

        if (message.type === 'typing' && !message.isTyping && !typingStoppedAfterError) {
          typingStoppedAfterError = true;
        }

        if (message.type === 'chat_error') {
          expect(typingStoppedAfterError).toBe(true);
          
          // Restaura método original
          testMcpManager.sendMessage = originalSendMessage;
          done();
        }
      });

      wsClient.on('error', done);
    });
  });
});