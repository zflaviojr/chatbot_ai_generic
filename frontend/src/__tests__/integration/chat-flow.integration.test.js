/**
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals';
import { ChatbotApp } from '../../components/ChatbotApp.js';

// Mock WebSocket for integration testing
class MockWebSocketIntegration {
  constructor(url) {
    this.url = url;
    this.readyState = WebSocket.CONNECTING;
    this.CONNECTING = 0;
    this.OPEN = 1;
    this.CLOSING = 2;
    this.CLOSED = 3;
    
    // Simulate connection after a short delay
    setTimeout(() => {
      this.readyState = WebSocket.OPEN;
      if (this.onopen) this.onopen();
    }, 10);
  }
  
  send(data) {
    // Simulate server response based on message type
    const message = JSON.parse(data);
    setTimeout(() => {
      this.simulateServerResponse(message);
    }, 50);
  }
  
  simulateServerResponse(message) {
    if (!this.onmessage) return;
    
    switch (message.type) {
      case 'chat':
        this.onmessage({
          data: JSON.stringify({
            type: 'chatResponse',
            messageId: message.messageId,
            content: `Resposta para: ${message.content}`,
            formattedContent: `<p>Resposta para: ${message.content}</p>`,
            timestamp: new Date().toISOString(),
            usage: {
              promptTokens: 10,
              completionTokens: 15,
              totalTokens: 25,
              displayText: '25 tokens utilizados'
            },
            metadata: {
              model: 'gpt-4',
              requestId: `req-${Date.now()}`,
              processingTime: 1200,
              modelDisplayName: 'GPT-4',
              displayProcessingTime: '1.2s'
            },
            quality: {
              score: 85,
              rating: 'excellent',
              factors: ['comprehensive', 'accurate'],
              displayText: 'Excelente resposta'
            },
            responseTime: '1.2s'
          })
        });
        break;
        
      case 'startSession':
        this.onmessage({
          data: JSON.stringify({
            type: 'sessionStarted',
            sessionId: `session-${Date.now()}`,
            timestamp: new Date().toISOString()
          })
        });
        break;
        
      case 'ping':
        this.onmessage({
          data: JSON.stringify({
            type: 'pong',
            timestamp: new Date().toISOString()
          })
        });
        break;
        
      default:
        this.onmessage({
          data: JSON.stringify({
            type: 'error',
            error: 'Unknown message type',
            timestamp: new Date().toISOString()
          })
        });
    }
  }
  
  close() {
    this.readyState = WebSocket.CLOSED;
    if (this.onclose) this.onclose({ code: 1000, reason: 'Normal closure' });
  }
  
  addEventListener(event, handler) {
    this[`on${event}`] = handler;
  }
  
  removeEventListener(event, handler) {
    this[`on${event}`] = null;
  }
}

// Replace global WebSocket with mock
global.WebSocket = MockWebSocketIntegration;

describe('Chat Flow Integration Tests', () => {
  let chatbotApp;
  let container;

  beforeEach(() => {
    // Clean DOM
    document.body.innerHTML = '';
    
    // Create container
    container = document.createElement('div');
    container.id = 'test-container';
    document.body.appendChild(container);
    
    // Mock viewport
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });
    
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 768,
    });
    
    // Initialize chatbot app
    const config = {
      websocketUrl: 'ws://localhost:3001/ws',
      title: 'Test Chatbot',
      enableNotifications: false,
      enableSounds: false,
      autoStart: true,
      enableLogging: false
    };
    
    chatbotApp = new ChatbotApp(config);
  });

  afterEach(() => {
    if (chatbotApp) {
      chatbotApp.destroy();
    }
    document.body.innerHTML = '';
  });

  describe('Complete Chat Flow from User Input to Bot Response', () => {
    test('should handle complete user message to bot response flow', async () => {
      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Open chat interface
      chatbotApp.openChatInterface();
      
      // Get interface elements
      const chatInterface = chatbotApp.chatInterface;
      const input = chatInterface.container.querySelector('.chat-widget__input');
      const sendButton = chatInterface.container.querySelector('.chat-widget__send-btn');
      
      expect(input).toBeTruthy();
      expect(sendButton).toBeTruthy();
      
      // Simulate user typing and sending message
      input.value = 'Olá, como você está?';
      
      // Track message flow
      const messageFlow = [];
      
      // Listen for message events
      chatInterface.container.addEventListener('messageAdded', (event) => {
        messageFlow.push({
          type: 'messageAdded',
          messageType: event.detail.type,
          content: event.detail.content,
          timestamp: event.detail.timestamp
        });
      });
      
      // Send message
      sendButton.click();
      
      // Wait for message processing
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Verify message flow
      expect(messageFlow.length).toBeGreaterThanOrEqual(2);
      
      // Check user message was added
      const userMessage = messageFlow.find(msg => msg.messageType === 'user');
      expect(userMessage).toBeTruthy();
      expect(userMessage.content).toBe('Olá, como você está?');
      
      // Check bot response was added
      const botMessage = messageFlow.find(msg => msg.messageType === 'bot');
      expect(botMessage).toBeTruthy();
      expect(botMessage.content).toContain('Resposta para: Olá, como você está?');
      
      // Verify input was cleared
      expect(input.value).toBe('');
      
      // Verify message history
      expect(chatbotApp.messageHistory.length).toBe(2);
      expect(chatbotApp.messageHistory[0].type).toBe('user');
      expect(chatbotApp.messageHistory[1].type).toBe('bot');
    });

    test('should handle multiple consecutive messages', async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      
      chatbotApp.openChatInterface();
      const chatInterface = chatbotApp.chatInterface;
      const input = chatInterface.container.querySelector('.chat-widget__input');
      const sendButton = chatInterface.container.querySelector('.chat-widget__send-btn');
      
      const messages = [
        'Primeira mensagem',
        'Segunda mensagem',
        'Terceira mensagem'
      ];
      
      // Send multiple messages
      for (const message of messages) {
        input.value = message;
        sendButton.click();
        
        // Wait for processing
        await new Promise(resolve => setTimeout(resolve, 150));
      }
      
      // Wait for all responses
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Verify all messages and responses
      expect(chatbotApp.messageHistory.length).toBe(6); // 3 user + 3 bot
      
      // Check message order
      for (let i = 0; i < messages.length; i++) {
        const userIndex = i * 2;
        const botIndex = userIndex + 1;
        
        expect(chatbotApp.messageHistory[userIndex].type).toBe('user');
        expect(chatbotApp.messageHistory[userIndex].content).toBe(messages[i]);
        
        expect(chatbotApp.messageHistory[botIndex].type).toBe('bot');
        expect(chatbotApp.messageHistory[botIndex].content).toContain(`Resposta para: ${messages[i]}`);
      }
    });

    test('should maintain session context across messages', async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify session was started
      expect(chatbotApp.currentSessionId).toBeTruthy();
      const initialSessionId = chatbotApp.currentSessionId;
      
      chatbotApp.openChatInterface();
      const chatInterface = chatbotApp.chatInterface;
      const input = chatInterface.container.querySelector('.chat-widget__input');
      const sendButton = chatInterface.container.querySelector('.chat-widget__send-btn');
      
      // Send first message
      input.value = 'Primeira mensagem';
      sendButton.click();
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Send second message
      input.value = 'Segunda mensagem';
      sendButton.click();
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Verify session ID remained the same
      expect(chatbotApp.currentSessionId).toBe(initialSessionId);
      
      // Verify both messages have the same session context
      const userMessages = chatbotApp.messageHistory.filter(msg => msg.type === 'user');
      expect(userMessages.length).toBe(2);
      expect(userMessages[0].sessionId).toBe(initialSessionId);
      expect(userMessages[1].sessionId).toBe(initialSessionId);
    });

    test('should handle typing indicator during response', async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      
      chatbotApp.openChatInterface();
      const chatInterface = chatbotApp.chatInterface;
      const input = chatInterface.container.querySelector('.chat-widget__input');
      const sendButton = chatInterface.container.querySelector('.chat-widget__send-btn');
      
      // Mock typing indicator
      const typingIndicator = chatInterface.container.querySelector('.typing-indicator');
      let typingShown = false;
      let typingHidden = false;
      
      // Override typing indicator methods to track calls
      const originalShow = chatInterface.showTypingIndicator;
      const originalHide = chatInterface.hideTypingIndicator;
      
      chatInterface.showTypingIndicator = function() {
        typingShown = true;
        return originalShow.call(this);
      };
      
      chatInterface.hideTypingIndicator = function() {
        typingHidden = true;
        return originalHide.call(this);
      };
      
      // Send message
      input.value = 'Test message';
      sendButton.click();
      
      // Wait for typing indicator to show
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(typingShown).toBe(true);
      
      // Wait for response and typing indicator to hide
      await new Promise(resolve => setTimeout(resolve, 200));
      expect(typingHidden).toBe(true);
    });
  });

  describe('Error Scenarios and Recovery Mechanisms', () => {
    test('should handle WebSocket connection failure', async () => {
      // Mock WebSocket to fail connection
      const OriginalWebSocket = global.WebSocket;
      global.WebSocket = class FailingWebSocket {
        constructor(url) {
          this.url = url;
          this.readyState = WebSocket.CONNECTING;
          setTimeout(() => {
            this.readyState = WebSocket.CLOSED;
            if (this.onerror) this.onerror(new Error('Connection failed'));
            if (this.onclose) this.onclose({ code: 1006, reason: 'Connection failed' });
          }, 10);
        }
        
        send() {
          throw new Error('WebSocket is not connected');
        }
        
        close() {
          this.readyState = WebSocket.CLOSED;
        }
        
        addEventListener(event, handler) {
          this[`on${event}`] = handler;
        }
        
        removeEventListener(event, handler) {
          this[`on${event}`] = null;
        }
      };
      
      // Create new chatbot with failing WebSocket
      const config = {
        websocketUrl: 'ws://localhost:3001/ws',
        title: 'Test Chatbot',
        enableNotifications: false,
        enableSounds: false,
        autoStart: true,
        enableLogging: false
      };
      
      const failingChatbot = new ChatbotApp(config);
      
      // Wait for connection attempt
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Open interface and try to send message
      failingChatbot.openChatInterface();
      const chatInterface = failingChatbot.chatInterface;
      const input = chatInterface.container.querySelector('.chat-widget__input');
      const sendButton = chatInterface.container.querySelector('.chat-widget__send-btn');
      
      input.value = 'Test message';
      sendButton.click();
      
      // Wait for error handling
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify error state
      const errorMessages = failingChatbot.messageHistory.filter(msg => msg.type === 'system' && msg.content.includes('erro'));
      expect(errorMessages.length).toBeGreaterThan(0);
      
      // Cleanup
      failingChatbot.destroy();
      global.WebSocket = OriginalWebSocket;
    });

    test('should handle message timeout', async () => {
      // Mock WebSocket that doesn't respond
      const OriginalWebSocket = global.WebSocket;
      global.WebSocket = class TimeoutWebSocket extends MockWebSocketIntegration {
        simulateServerResponse(message) {
          // Don't respond to simulate timeout
          if (message.type === 'chat') {
            // Simulate timeout after delay
            setTimeout(() => {
              if (this.onmessage) {
                this.onmessage({
                  data: JSON.stringify({
                    type: 'chatError',
                    messageId: message.messageId,
                    error: 'Request timeout',
                    displayMessage: 'A resposta demorou muito para chegar. Tente novamente.',
                    canRetry: true,
                    retryDelay: 2000,
                    errorCode: 'TIMEOUT',
                    timestamp: new Date().toISOString()
                  })
                });
              }
            }, 100);
          } else {
            super.simulateServerResponse(message);
          }
        }
      };
      
      const timeoutChatbot = new ChatbotApp({
        websocketUrl: 'ws://localhost:3001/ws',
        title: 'Test Chatbot',
        enableNotifications: false,
        enableSounds: false,
        autoStart: true,
        enableLogging: false
      });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      timeoutChatbot.openChatInterface();
      const chatInterface = timeoutChatbot.chatInterface;
      const input = chatInterface.container.querySelector('.chat-widget__input');
      const sendButton = chatInterface.container.querySelector('.chat-widget__send-btn');
      
      input.value = 'Test timeout message';
      sendButton.click();
      
      // Wait for timeout error
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Verify timeout error was handled
      const errorMessages = timeoutChatbot.messageHistory.filter(msg => 
        msg.type === 'system' && msg.content.includes('demorou')
      );
      expect(errorMessages.length).toBeGreaterThan(0);
      
      // Cleanup
      timeoutChatbot.destroy();
      global.WebSocket = OriginalWebSocket;
    });

    test('should handle retry mechanism for failed messages', async () => {
      let attemptCount = 0;
      
      // Mock WebSocket that fails first attempt then succeeds
      const OriginalWebSocket = global.WebSocket;
      global.WebSocket = class RetryWebSocket extends MockWebSocketIntegration {
        simulateServerResponse(message) {
          if (message.type === 'chat') {
            attemptCount++;
            
            if (attemptCount === 1) {
              // Fail first attempt
              this.onmessage({
                data: JSON.stringify({
                  type: 'chatError',
                  messageId: message.messageId,
                  error: 'Temporary failure',
                  displayMessage: 'Erro temporário. Tentando novamente...',
                  canRetry: true,
                  retryDelay: 100,
                  errorCode: 'TEMPORARY_FAILURE',
                  timestamp: new Date().toISOString()
                })
              });
            } else {
              // Succeed on retry
              super.simulateServerResponse(message);
            }
          } else {
            super.simulateServerResponse(message);
          }
        }
      };
      
      const retryChatbot = new ChatbotApp({
        websocketUrl: 'ws://localhost:3001/ws',
        title: 'Test Chatbot',
        enableNotifications: false,
        enableSounds: false,
        autoStart: true,
        enableLogging: false
      });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      retryChatbot.openChatInterface();
      const chatInterface = retryChatbot.chatInterface;
      const input = chatInterface.container.querySelector('.chat-widget__input');
      const sendButton = chatInterface.container.querySelector('.chat-widget__send-btn');
      
      input.value = 'Test retry message';
      sendButton.click();
      
      // Wait for initial failure and retry
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Verify retry was attempted and succeeded
      expect(attemptCount).toBe(2);
      
      const botMessages = retryChatbot.messageHistory.filter(msg => msg.type === 'bot');
      expect(botMessages.length).toBe(1);
      expect(botMessages[0].content).toContain('Test retry message');
      
      // Cleanup
      retryChatbot.destroy();
      global.WebSocket = OriginalWebSocket;
    });
  });

  describe('WebSocket Connection Stability', () => {
    test('should handle connection drops and reconnection', async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Get initial WebSocket connection
      const messageHandler = chatbotApp.messageHandler;
      const originalWs = messageHandler.ws;
      
      expect(originalWs).toBeTruthy();
      expect(originalWs.readyState).toBe(WebSocket.OPEN);
      
      // Simulate connection drop
      originalWs.close();
      
      // Wait for reconnection attempt
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Verify new connection was established
      expect(messageHandler.ws).toBeTruthy();
      expect(messageHandler.ws.readyState).toBe(WebSocket.OPEN);
      
      // Verify we can still send messages after reconnection
      chatbotApp.openChatInterface();
      const chatInterface = chatbotApp.chatInterface;
      const input = chatInterface.container.querySelector('.chat-widget__input');
      const sendButton = chatInterface.container.querySelector('.chat-widget__send-btn');
      
      input.value = 'Message after reconnection';
      sendButton.click();
      
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Verify message was sent and response received
      const botMessages = chatbotApp.messageHistory.filter(msg => msg.type === 'bot');
      expect(botMessages.length).toBeGreaterThan(0);
      expect(botMessages[botMessages.length - 1].content).toContain('Message after reconnection');
    });

    test('should handle multiple rapid connection drops', async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const messageHandler = chatbotApp.messageHandler;
      let reconnectionCount = 0;
      
      // Track reconnection attempts
      const originalConnect = messageHandler.connect;
      messageHandler.connect = function() {
        reconnectionCount++;
        return originalConnect.call(this);
      };
      
      // Simulate multiple connection drops
      for (let i = 0; i < 3; i++) {
        if (messageHandler.ws) {
          messageHandler.ws.close();
        }
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      // Wait for final reconnection
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Verify reconnection attempts were made
      expect(reconnectionCount).toBeGreaterThan(0);
      
      // Verify final connection is stable
      expect(messageHandler.ws).toBeTruthy();
      expect(messageHandler.ws.readyState).toBe(WebSocket.OPEN);
    });

    test('should handle heartbeat/ping-pong mechanism', async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const messageHandler = chatbotApp.messageHandler;
      let pingCount = 0;
      let pongCount = 0;
      
      // Track ping/pong messages
      const originalSend = messageHandler.ws.send;
      messageHandler.ws.send = function(data) {
        const message = JSON.parse(data);
        if (message.type === 'ping') {
          pingCount++;
        }
        return originalSend.call(this, data);
      };
      
      const originalOnMessage = messageHandler.ws.onmessage;
      messageHandler.ws.onmessage = function(event) {
        const message = JSON.parse(event.data);
        if (message.type === 'pong') {
          pongCount++;
        }
        return originalOnMessage.call(this, event);
      };
      
      // Trigger ping manually
      messageHandler.sendPing();
      
      // Wait for pong response
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify ping was sent and pong was received
      expect(pingCount).toBe(1);
      expect(pongCount).toBe(1);
    });
  });
});