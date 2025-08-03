/**
 * Testes end-to-end para integração MCP com interface de chat
 * Verifica o fluxo completo de mensagem do usuário até resposta formatada
 */
import { jest } from '@jest/globals';
import WebSocket from 'ws';
import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { WebSocketHandler } from '../handlers/WebSocketHandler.js';
import { MCPConnectionManager } from '../mcp/MCPConnectionManager.js';

describe('Integração End-to-End MCP + Chat Interface', () => {
  let testServer;
  let wsClient;
  let testMcpManager;
  let testWsHandler;
  const TEST_PORT = 3004;

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

  describe('Fluxo Completo de Chat com MCP', () => {
    test('deve processar mensagem completa com formatação MCP', async () => {
      const messageFlow = [];
      
      wsClient = new WebSocket(`ws://localhost:${TEST_PORT}/ws`);
      
      const completeFlowPromise = new Promise((resolve) => {
        let sessionId = null;
        let sessionStarted = false;

        wsClient.on('message', (data) => {
          const message = JSON.parse(data.toString());
          messageFlow.push(message);

          if (message.type === 'session_started' && !sessionStarted) {
            sessionStarted = true;
            sessionId = message.sessionId;
            
            // Envia mensagem de chat
            wsClient.send(JSON.stringify({
              type: 'chat',
              content: 'Explique como funciona a inteligência artificial',
              messageId: 'e2e-test-1',
              timestamp: new Date().toISOString()
            }));
          }

          if (message.type === 'chat_response') {
            // Verifica estrutura completa da resposta MCP
            expect(message).toHaveProperty('type', 'chat_response');
            expect(message).toHaveProperty('messageId', 'e2e-test-1');
            expect(message).toHaveProperty('content');
            expect(message).toHaveProperty('timestamp');
            expect(message).toHaveProperty('usage');
            expect(message).toHaveProperty('metadata');
            expect(message).toHaveProperty('sessionId', sessionId);

            // Verifica formatação do usage
            expect(message.usage).toHaveProperty('promptTokens');
            expect(message.usage).toHaveProperty('completionTokens');
            expect(message.usage).toHaveProperty('totalTokens');
            expect(typeof message.usage.promptTokens).toBe('number');
            expect(typeof message.usage.completionTokens).toBe('number');
            expect(typeof message.usage.totalTokens).toBe('number');

            // Verifica metadados
            expect(message.metadata).toHaveProperty('model');
            expect(message.metadata).toHaveProperty('requestId');
            expect(message.metadata).toHaveProperty('originalMessageId', 'e2e-test-1');
            expect(message.metadata).toHaveProperty('processingTime');
            expect(typeof message.metadata.processingTime).toBe('number');

            // Verifica que conteúdo foi sanitizado
            expect(message.content).toBeDefined();
            expect(typeof message.content).toBe('string');
            expect(message.content.length).toBeGreaterThan(0);
            expect(message.content.length).toBeLessThanOrEqual(8000);

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

      await completeFlowPromise;

      // Verifica sequência de mensagens
      const messageTypes = messageFlow.map(m => m.type);
      expect(messageTypes).toContain('connection');
      expect(messageTypes).toContain('session_started');
      expect(messageTypes).toContain('typing');
      expect(messageTypes).toContain('chat_response');

      // Verifica que indicador de digitação foi enviado e parado
      const typingMessages = messageFlow.filter(m => m.type === 'typing');
      expect(typingMessages.length).toBeGreaterThanOrEqual(2);
      expect(typingMessages.some(m => m.isTyping === true)).toBe(true);
      expect(typingMessages.some(m => m.isTyping === false)).toBe(true);
    });

    test('deve tratar timeout com formatação adequada', async () => {
      // Mock do MCP manager para simular timeout
      const originalSendMessage = testMcpManager.sendMessage;
      testMcpManager.sendMessage = async function() {
        return new Promise((resolve) => {
          // Nunca resolve para simular timeout
          setTimeout(() => {
            // Timeout será atingido antes disso
          }, 35000);
        });
      };

      wsClient = new WebSocket(`ws://localhost:${TEST_PORT}/ws`);
      
      const timeoutTestPromise = new Promise((resolve) => {
        let sessionStarted = false;

        wsClient.on('message', (data) => {
          const message = JSON.parse(data.toString());

          if (message.type === 'session_started' && !sessionStarted) {
            sessionStarted = true;
            
            wsClient.send(JSON.stringify({
              type: 'chat',
              content: 'Mensagem que vai dar timeout',
              messageId: 'timeout-test-1',
              timestamp: new Date().toISOString()
            }));
          }

          if (message.type === 'chat_error') {
            // Verifica formatação do erro de timeout
            expect(message).toHaveProperty('messageId', 'timeout-test-1');
            expect(message).toHaveProperty('message');
            expect(message).toHaveProperty('errorCode', 'TIMEOUT');
            expect(message).toHaveProperty('retryable', true);
            expect(message).toHaveProperty('timestamp');

            expect(message.message).toContain('demorando mais que o esperado');
            
            // Restaura método original
            testMcpManager.sendMessage = originalSendMessage;
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

      await timeoutTestPromise;
    }, 35000); // Timeout do teste maior que o timeout da aplicação

    test('deve tratar erro de MCP desconectado com formatação adequada', async () => {
      // Desconecta MCP temporariamente
      await testMcpManager.disconnect();

      wsClient = new WebSocket(`ws://localhost:${TEST_PORT}/ws`);
      
      const disconnectedTestPromise = new Promise((resolve) => {
        let sessionStarted = false;

        wsClient.on('message', (data) => {
          const message = JSON.parse(data.toString());

          if (message.type === 'session_started' && !sessionStarted) {
            sessionStarted = true;
            
            wsClient.send(JSON.stringify({
              type: 'chat',
              content: 'Mensagem com MCP desconectado',
              messageId: 'disconnected-test-1',
              timestamp: new Date().toISOString()
            }));
          }

          if (message.type === 'chat_error') {
            // Verifica formatação do erro de serviço indisponível
            expect(message).toHaveProperty('messageId', 'disconnected-test-1');
            expect(message).toHaveProperty('errorCode', 'SERVICE_UNAVAILABLE');
            expect(message).toHaveProperty('retryable', true);
            expect(message.message).toContain('temporariamente indisponível');
            
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

      await disconnectedTestPromise;

      // Reconecta MCP para outros testes
      await testMcpManager.connect();
    });

    test('deve validar tamanho de mensagem e retornar erro formatado', async () => {
      wsClient = new WebSocket(`ws://localhost:${TEST_PORT}/ws`);
      
      const validationTestPromise = new Promise((resolve) => {
        let sessionStarted = false;

        wsClient.on('message', (data) => {
          const message = JSON.parse(data.toString());

          if (message.type === 'session_started' && !sessionStarted) {
            sessionStarted = true;
            
            // Envia mensagem muito longa (> 4000 caracteres)
            const longMessage = 'A'.repeat(4001);
            wsClient.send(JSON.stringify({
              type: 'chat',
              content: longMessage,
              messageId: 'validation-test-1',
              timestamp: new Date().toISOString()
            }));
          }

          if (message.type === 'error') {
            expect(message.message).toContain('muito longa');
            expect(message.message).toContain('4000 caracteres');
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

      await validationTestPromise;
    });

    test('deve manter contexto de sessão através de múltiplas mensagens', async () => {
      wsClient = new WebSocket(`ws://localhost:${TEST_PORT}/ws`);
      
      const contextTestPromise = new Promise((resolve) => {
        let sessionId = null;
        let sessionStarted = false;
        let firstResponseReceived = false;

        wsClient.on('message', (data) => {
          const message = JSON.parse(data.toString());

          if (message.type === 'session_started' && !sessionStarted) {
            sessionStarted = true;
            sessionId = message.sessionId;
            
            // Primeira mensagem
            wsClient.send(JSON.stringify({
              type: 'chat',
              content: 'Primeira pergunta sobre IA',
              messageId: 'context-test-1',
              timestamp: new Date().toISOString()
            }));
          }

          if (message.type === 'chat_response' && message.messageId === 'context-test-1' && !firstResponseReceived) {
            firstResponseReceived = true;
            
            // Verifica que sessionId está presente
            expect(message.sessionId).toBe(sessionId);
            
            // Segunda mensagem na mesma sessão
            wsClient.send(JSON.stringify({
              type: 'chat',
              content: 'Continue explicando sobre o tópico anterior',
              messageId: 'context-test-2',
              timestamp: new Date().toISOString()
            }));
          }

          if (message.type === 'chat_response' && message.messageId === 'context-test-2') {
            // Verifica que sessionId foi mantido
            expect(message.sessionId).toBe(sessionId);
            
            // Verifica que a sessão ainda existe no handler
            const session = testWsHandler.sessions.get(sessionId);
            expect(session).toBeDefined();
            expect(session.messageCount).toBe(2);
            
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

      await contextTestPromise;
    });

    test('deve sanitizar conteúdo de resposta adequadamente', async () => {
      // Mock do MCP manager para retornar conteúdo que precisa ser sanitizado
      const originalSendMessage = testMcpManager.sendMessage;
      testMcpManager.sendMessage = async function(message, sessionId) {
        const result = await originalSendMessage.call(this, message, sessionId);
        
        // Modifica resposta para incluir conteúdo que deve ser sanitizado
        result.message = 'Resposta normal\x00com\x08caracteres\x1Fde controle e conteúdo muito longo ' + 'A'.repeat(8000);
        
        return result;
      };

      wsClient = new WebSocket(`ws://localhost:${TEST_PORT}/ws`);
      
      const sanitizationTestPromise = new Promise((resolve) => {
        let sessionStarted = false;

        wsClient.on('message', (data) => {
          const message = JSON.parse(data.toString());

          if (message.type === 'session_started' && !sessionStarted) {
            sessionStarted = true;
            
            wsClient.send(JSON.stringify({
              type: 'chat',
              content: 'Teste de sanitização',
              messageId: 'sanitization-test-1',
              timestamp: new Date().toISOString()
            }));
          }

          if (message.type === 'chat_response') {
            // Verifica que caracteres de controle foram removidos
            expect(message.content).not.toMatch(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/);
            
            // Verifica que conteúdo foi limitado a 8000 caracteres
            expect(message.content.length).toBeLessThanOrEqual(8000);
            
            // Verifica que conteúdo ainda contém texto válido
            expect(message.content).toContain('Resposta normal');
            expect(message.content).toContain('com');
            expect(message.content).toContain('caracteres');
            expect(message.content).toContain('de controle');
            
            // Restaura método original
            testMcpManager.sendMessage = originalSendMessage;
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

      await sanitizationTestPromise;
    });
  });

  describe('Eventos e Monitoramento', () => {
    test('deve emitir eventos de processamento de mensagem', async () => {
      const events = [];
      
      // Escuta eventos do WebSocket handler
      testWsHandler.on('messageProcessed', (data) => {
        events.push({ type: 'messageProcessed', data });
      });

      wsClient = new WebSocket(`ws://localhost:${TEST_PORT}/ws`);
      
      const eventsTestPromise = new Promise((resolve) => {
        let sessionStarted = false;

        wsClient.on('message', (data) => {
          const message = JSON.parse(data.toString());

          if (message.type === 'session_started' && !sessionStarted) {
            sessionStarted = true;
            
            wsClient.send(JSON.stringify({
              type: 'chat',
              content: 'Teste de eventos',
              messageId: 'events-test-1',
              timestamp: new Date().toISOString()
            }));
          }

          if (message.type === 'chat_response') {
            // Aguarda um pouco para garantir que evento foi emitido
            setTimeout(() => {
              expect(events.length).toBeGreaterThan(0);
              
              const messageProcessedEvent = events.find(e => e.type === 'messageProcessed');
              expect(messageProcessedEvent).toBeDefined();
              expect(messageProcessedEvent.data).toHaveProperty('messageId', 'events-test-1');
              expect(messageProcessedEvent.data).toHaveProperty('responseLength');
              expect(messageProcessedEvent.data).toHaveProperty('processingTime');
              
              resolve();
            }, 100);
          }
        });
      });

      wsClient.on('open', () => {
        wsClient.send(JSON.stringify({
          type: 'session_start',
          timestamp: new Date().toISOString()
        }));
      });

      await eventsTestPromise;
    });

    test('deve emitir eventos de erro adequadamente', async () => {
      const events = [];
      
      // Escuta eventos de erro
      testWsHandler.on('messageError', (data) => {
        events.push({ type: 'messageError', data });
      });

      // Mock para simular erro
      const originalSendMessage = testMcpManager.sendMessage;
      testMcpManager.sendMessage = async function() {
        throw new Error('Erro simulado para teste');
      };

      wsClient = new WebSocket(`ws://localhost:${TEST_PORT}/ws`);
      
      const errorEventsTestPromise = new Promise((resolve) => {
        let sessionStarted = false;

        wsClient.on('message', (data) => {
          const message = JSON.parse(data.toString());

          if (message.type === 'session_started' && !sessionStarted) {
            sessionStarted = true;
            
            wsClient.send(JSON.stringify({
              type: 'chat',
              content: 'Mensagem que causará erro',
              messageId: 'error-events-test-1',
              timestamp: new Date().toISOString()
            }));
          }

          if (message.type === 'chat_error') {
            setTimeout(() => {
              expect(events.length).toBeGreaterThan(0);
              
              const errorEvent = events.find(e => e.type === 'messageError');
              expect(errorEvent).toBeDefined();
              expect(errorEvent.data).toHaveProperty('messageId', 'error-events-test-1');
              expect(errorEvent.data).toHaveProperty('error');
              expect(errorEvent.data).toHaveProperty('errorType');
              
              // Restaura método original
              testMcpManager.sendMessage = originalSendMessage;
              resolve();
            }, 100);
          }
        });
      });

      wsClient.on('open', () => {
        wsClient.send(JSON.stringify({
          type: 'session_start',
          timestamp: new Date().toISOString()
        }));
      });

      await errorEventsTestPromise;
    });
  });
});