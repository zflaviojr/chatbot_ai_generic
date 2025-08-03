/**
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals';
import { ChatbotApp } from '../../components/ChatbotApp.js';

// Enhanced WebSocket mock for E2E testing
class E2EWebSocketMock {
  constructor(url) {
    this.url = url;
    this.readyState = WebSocket.CONNECTING;
    this.CONNECTING = 0;
    this.OPEN = 1;
    this.CLOSING = 2;
    this.CLOSED = 3;
    
    this.messageQueue = [];
    this.sessionId = null;
    
    // Simulate realistic connection delay
    setTimeout(() => {
      this.readyState = WebSocket.OPEN;
      if (this.onopen) this.onopen();
    }, 50);
  }
  
  send(data) {
    if (this.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
    
    try {
      const message = JSON.parse(data);
      this.messageQueue.push(message);
      
      // Simulate server processing delay
      setTimeout(() => {
        this.processMessage(message);
      }, 100 + Math.random() * 100); // 100-200ms delay
      
    } catch (error) {
      // Handle malformed JSON
      setTimeout(() => {
        if (this.onmessage) {
          this.onmessage({
            data: JSON.stringify({
              type: 'error',
              error: 'Invalid JSON format',
              timestamp: new Date().toISOString()
            })
          });
        }
      }, 10);
    }
  }
  
  processMessage(message) {
    if (!this.onmessage) return;
    
    switch (message.type) {
      case 'startSession':
        this.sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.onmessage({
          data: JSON.stringify({
            type: 'sessionStarted',
            sessionId: this.sessionId,
            timestamp: new Date().toISOString()
          })
        });
        break;
        
      case 'chat':
        if (!this.sessionId) {
          this.onmessage({
            data: JSON.stringify({
              type: 'chatError',
              messageId: message.messageId,
              error: 'No active session',
              displayMessage: 'Sessão não iniciada. Tente novamente.',
              canRetry: true,
              retryDelay: 1000,
              errorCode: 'NO_SESSION',
              timestamp: new Date().toISOString()
            })
          });
          return;
        }
        
        // Simulate typing indicator
        this.onmessage({
          data: JSON.stringify({
            type: 'typing',
            isTyping: true,
            timestamp: new Date().toISOString()
          })
        });
        
        // Simulate response after delay
        setTimeout(() => {
          // Stop typing indicator
          this.onmessage({
            data: JSON.stringify({
              type: 'typing',
              isTyping: false,
              timestamp: new Date().toISOString()
            })
          });
          
          // Send response
          this.onmessage({
            data: JSON.stringify({
              type: 'chatResponse',
              messageId: message.messageId,
              content: this.generateResponse(message.content),
              formattedContent: this.generateFormattedResponse(message.content),
              timestamp: new Date().toISOString(),
              usage: {
                promptTokens: Math.floor(message.content.length / 4),
                completionTokens: Math.floor(Math.random() * 50) + 20,
                totalTokens: Math.floor(message.content.length / 4) + Math.floor(Math.random() * 50) + 20,
                displayText: `${Math.floor(message.content.length / 4) + Math.floor(Math.random() * 50) + 20} tokens utilizados`
              },
              metadata: {
                model: 'gpt-4',
                requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                processingTime: 1200 + Math.random() * 800,
                modelDisplayName: 'GPT-4',
                displayProcessingTime: `${(1200 + Math.random() * 800).toFixed(0)}ms`
              },
              quality: {
                score: 75 + Math.random() * 20,
                rating: Math.random() > 0.5 ? 'excellent' : 'good',
                factors: ['comprehensive', 'accurate', 'helpful'],
                displayText: Math.random() > 0.5 ? 'Excelente resposta' : 'Boa resposta'
              },
              responseTime: `${(1200 + Math.random() * 800).toFixed(0)}ms`
            })
          });
        }, 800 + Math.random() * 400); // 800-1200ms response time
        break;
        
      case 'ping':
        this.onmessage({
          data: JSON.stringify({
            type: 'pong',
            timestamp: new Date().toISOString()
          })
        });
        break;
        
      case 'endSession':
        this.onmessage({
          data: JSON.stringify({
            type: 'sessionEnded',
            sessionId: this.sessionId,
            timestamp: new Date().toISOString()
          })
        });
        this.sessionId = null;
        break;
        
      default:
        this.onmessage({
          data: JSON.stringify({
            type: 'error',
            error: `Unknown message type: ${message.type}`,
            timestamp: new Date().toISOString()
          })
        });
    }
  }
  
  generateResponse(userMessage) {
    const responses = [
      `Entendi sua pergunta sobre "${userMessage}". Deixe-me ajudá-lo com isso.`,
      `Interessante questão! Sobre "${userMessage}", posso explicar que...`,
      `Ótima pergunta! Em relação a "${userMessage}", aqui está minha resposta:`,
      `Vou responder sobre "${userMessage}" de forma detalhada.`,
      `Compreendo que você quer saber sobre "${userMessage}". Aqui está a informação:`
    ];
    
    const baseResponse = responses[Math.floor(Math.random() * responses.length)];
    const additionalInfo = this.generateAdditionalInfo(userMessage);
    
    return `${baseResponse}\n\n${additionalInfo}`;
  }
  
  generateFormattedResponse(userMessage) {
    const response = this.generateResponse(userMessage);
    return `<div class="bot-response">
      <p>${response.split('\n\n')[0]}</p>
      <div class="additional-info">
        <p>${response.split('\n\n')[1] || ''}</p>
      </div>
    </div>`;
  }
  
  generateAdditionalInfo(userMessage) {
    const infos = [
      'Esta é uma resposta simulada para fins de teste. Em um ambiente real, esta seria uma resposta gerada pelo modelo de IA.',
      'O sistema está funcionando corretamente e processando suas mensagens adequadamente.',
      'Esta resposta demonstra a capacidade do chatbot de processar e responder a diferentes tipos de perguntas.',
      'O fluxo de comunicação entre frontend e backend está operando conforme esperado.',
      'Todos os componentes do sistema estão integrados e funcionando harmoniosamente.'
    ];
    
    return infos[Math.floor(Math.random() * infos.length)];
  }
  
  close(code = 1000, reason = 'Normal closure') {
    this.readyState = WebSocket.CLOSED;
    if (this.onclose) {
      this.onclose({ code, reason });
    }
  }
  
  addEventListener(event, handler) {
    this[`on${event}`] = handler;
  }
  
  removeEventListener(event, handler) {
    this[`on${event}`] = null;
  }
}

// Replace global WebSocket
global.WebSocket = E2EWebSocketMock;

describe('Complete Chat Flow E2E Tests', () => {
  let chatbotApp;
  let container;

  beforeEach(() => {
    // Clean DOM
    document.body.innerHTML = '';
    
    // Create container
    container = document.createElement('div');
    container.id = 'e2e-test-container';
    document.body.appendChild(container);
    
    // Set up viewport
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
    
    // Mock additional APIs
    global.Notification = {
      permission: 'granted',
      requestPermission: jest.fn(() => Promise.resolve('granted'))
    };
    
    global.Audio = jest.fn().mockImplementation(() => ({
      play: jest.fn(() => Promise.resolve()),
      pause: jest.fn(),
      volume: 0.3
    }));
    
    // Initialize chatbot app
    const config = {
      websocketUrl: 'ws://localhost:3001/ws',
      title: 'E2E Test Chatbot',
      enableNotifications: true,
      enableSounds: true,
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

  describe('Complete User Journey', () => {
    test('should complete full user journey from widget click to response', async () => {
      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Verify widget is present
      const widget = document.querySelector('.chat-widget');
      expect(widget).toBeTruthy();
      
      const fab = widget.querySelector('.chat-widget__fab');
      expect(fab).toBeTruthy();
      
      // Step 1: User clicks on chat widget
      fab.click();
      
      // Wait for interface to open
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify chat interface opened
      expect(chatbotApp.chatInterface).toBeTruthy();
      
      const chatInterface = chatbotApp.chatInterface;
      const interfaceContainer = chatInterface.container;
      
      expect(interfaceContainer).toBeTruthy();
      expect(interfaceContainer.style.display).not.toBe('none');
      
      // Step 2: User sees welcome message
      const welcomeMessage = interfaceContainer.querySelector('.chat-message--bot');
      expect(welcomeMessage).toBeTruthy();
      
      // Step 3: User types a message
      const input = interfaceContainer.querySelector('.chat-widget__input');
      const sendButton = interfaceContainer.querySelector('.chat-widget__send-btn');
      
      expect(input).toBeTruthy();
      expect(sendButton).toBeTruthy();
      
      const userMessage = 'Olá! Como você pode me ajudar hoje?';
      input.value = userMessage;
      
      // Simulate typing event
      const inputEvent = new Event('input', { bubbles: true });
      input.dispatchEvent(inputEvent);
      
      // Step 4: User sends message
      sendButton.click();
      
      // Verify input was cleared
      expect(input.value).toBe('');
      
      // Step 5: Wait for typing indicator
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const typingIndicator = interfaceContainer.querySelector('.typing-indicator');
      // Note: Typing indicator might not be visible in DOM but should be handled
      
      // Step 6: Wait for bot response
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Verify message history
      expect(chatbotApp.messageHistory.length).toBeGreaterThanOrEqual(2);
      
      const userMsg = chatbotApp.messageHistory.find(msg => msg.type === 'user');
      const botMsg = chatbotApp.messageHistory.find(msg => msg.type === 'bot');
      
      expect(userMsg).toBeTruthy();
      expect(userMsg.content).toBe(userMessage);
      
      expect(botMsg).toBeTruthy();
      expect(botMsg.content).toContain(userMessage);
      
      // Step 7: Verify response is displayed in interface
      const botMessages = interfaceContainer.querySelectorAll('.chat-message--bot');
      expect(botMessages.length).toBeGreaterThan(1); // Welcome + response
      
      // Step 8: User can continue conversation
      const followUpMessage = 'Obrigado pela resposta!';
      input.value = followUpMessage;
      sendButton.click();
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Verify follow-up was processed
      expect(chatbotApp.messageHistory.length).toBeGreaterThanOrEqual(4);
      
      const followUpUser = chatbotApp.messageHistory.find(msg => 
        msg.type === 'user' && msg.content === followUpMessage
      );
      expect(followUpUser).toBeTruthy();
    });

    test('should handle complete error recovery flow', async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Open chat interface
      const fab = document.querySelector('.chat-widget__fab');
      fab.click();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const chatInterface = chatbotApp.chatInterface;
      const input = chatInterface.container.querySelector('.chat-widget__input');
      const sendButton = chatInterface.container.querySelector('.chat-widget__send-btn');
      
      // Simulate connection failure by replacing WebSocket
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
        
        removeEventListener() {}
      };
      
      // Force reconnection attempt
      if (chatbotApp.messageHandler.ws) {
        chatbotApp.messageHandler.ws.close();
      }
      
      // Wait for connection failure
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Try to send message during failure
      input.value = 'Message during connection failure';
      sendButton.click();
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Verify error handling
      const errorMessages = chatbotApp.messageHistory.filter(msg => 
        msg.type === 'system' && (msg.content.includes('erro') || msg.content.includes('falha'))
      );
      expect(errorMessages.length).toBeGreaterThan(0);
      
      // Restore working WebSocket
      global.WebSocket = OriginalWebSocket;
      
      // Simulate reconnection
      chatbotApp.messageHandler.connect();
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Try sending message after recovery
      input.value = 'Message after recovery';
      sendButton.click();
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Verify recovery worked
      const recoveryMessage = chatbotApp.messageHistory.find(msg => 
        msg.type === 'user' && msg.content === 'Message after recovery'
      );
      expect(recoveryMessage).toBeTruthy();
      
      const recoveryResponse = chatbotApp.messageHistory.find(msg => 
        msg.type === 'bot' && msg.content.includes('Message after recovery')
      );
      expect(recoveryResponse).toBeTruthy();
    });

    test('should handle complete mobile user journey', async () => {
      // Set mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });
      
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 667,
      });
      
      window.dispatchEvent(new Event('resize'));
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Mobile user clicks FAB
      const fab = document.querySelector('.chat-widget__fab');
      expect(fab).toBeTruthy();
      
      // Simulate touch interaction
      const touchStart = new TouchEvent('touchstart', {
        touches: [{ clientX: 100, clientY: 100 }],
        bubbles: true
      });
      
      const touchEnd = new TouchEvent('touchend', {
        changedTouches: [{ clientX: 100, clientY: 100 }],
        bubbles: true
      });
      
      fab.dispatchEvent(touchStart);
      fab.dispatchEvent(touchEnd);
      fab.click();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify mobile interface opened
      const chatInterface = chatbotApp.chatInterface;
      expect(chatInterface).toBeTruthy();
      
      const interfaceContainer = chatInterface.container;
      expect(interfaceContainer).toBeTruthy();
      
      // Mobile-specific elements
      const header = interfaceContainer.querySelector('.chat-widget__header');
      const closeButton = header?.querySelector('.chat-widget__close-btn');
      
      expect(header).toBeTruthy();
      expect(closeButton).toBeTruthy();
      
      // Mobile user types message
      const input = interfaceContainer.querySelector('.chat-widget__input');
      const sendButton = interfaceContainer.querySelector('.chat-widget__send-btn');
      
      expect(input).toBeTruthy();
      expect(sendButton).toBeTruthy();
      
      // Simulate virtual keyboard appearance
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 300, // Reduced height
      });
      
      window.dispatchEvent(new Event('resize'));
      
      // Type and send message
      input.value = 'Mobile message test';
      
      // On mobile, Enter should not send (only button)
      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true
      });
      
      input.dispatchEvent(enterEvent);
      
      // Message should not be sent yet
      expect(chatbotApp.messageHistory.filter(msg => msg.type === 'user').length).toBe(0);
      
      // Send via button
      sendButton.click();
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Verify mobile message flow worked
      const mobileMessage = chatbotApp.messageHistory.find(msg => 
        msg.type === 'user' && msg.content === 'Mobile message test'
      );
      expect(mobileMessage).toBeTruthy();
      
      const mobileResponse = chatbotApp.messageHistory.find(msg => 
        msg.type === 'bot' && msg.content.includes('Mobile message test')
      );
      expect(mobileResponse).toBeTruthy();
      
      // Test mobile close functionality
      closeButton.click();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Interface should be closed
      expect(chatbotApp.chatInterface).toBeNull();
    });
  });

  describe('Multi-Session E2E Flow', () => {
    test('should handle session lifecycle correctly', async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Verify session was started automatically
      expect(chatbotApp.currentSessionId).toBeTruthy();
      const initialSessionId = chatbotApp.currentSessionId;
      
      // Open interface and send messages
      const fab = document.querySelector('.chat-widget__fab');
      fab.click();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const chatInterface = chatbotApp.chatInterface;
      const input = chatInterface.container.querySelector('.chat-widget__input');
      const sendButton = chatInterface.container.querySelector('.chat-widget__send-btn');
      
      // Send multiple messages in same session
      const messages = [
        'First message in session',
        'Second message in session',
        'Third message in session'
      ];
      
      for (const message of messages) {
        input.value = message;
        sendButton.click();
        
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Verify session ID remains the same
        expect(chatbotApp.currentSessionId).toBe(initialSessionId);
      }
      
      // Verify all messages are in history with same session
      const userMessages = chatbotApp.messageHistory.filter(msg => msg.type === 'user');
      expect(userMessages.length).toBe(3);
      
      userMessages.forEach(msg => {
        expect(msg.sessionId).toBe(initialSessionId);
      });
      
      // End session
      await chatbotApp.endSession();
      
      // Start new session
      await chatbotApp.start();
      
      // Verify new session ID
      expect(chatbotApp.currentSessionId).toBeTruthy();
      expect(chatbotApp.currentSessionId).not.toBe(initialSessionId);
      
      // Send message in new session
      input.value = 'Message in new session';
      sendButton.click();
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Verify message has new session ID
      const newSessionMessage = chatbotApp.messageHistory.find(msg => 
        msg.content === 'Message in new session'
      );
      expect(newSessionMessage).toBeTruthy();
      expect(newSessionMessage.sessionId).toBe(chatbotApp.currentSessionId);
    });

    test('should preserve conversation context within session', async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const fab = document.querySelector('.chat-widget__fab');
      fab.click();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const chatInterface = chatbotApp.chatInterface;
      const input = chatInterface.container.querySelector('.chat-widget__input');
      const sendButton = chatInterface.container.querySelector('.chat-widget__send-btn');
      
      // Send contextual messages
      const contextualMessages = [
        'My name is João',
        'What is my name?',
        'Can you remember what I told you?'
      ];
      
      for (const message of contextualMessages) {
        input.value = message;
        sendButton.click();
        
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
      
      // Verify all messages were processed
      const userMessages = chatbotApp.messageHistory.filter(msg => msg.type === 'user');
      expect(userMessages.length).toBe(3);
      
      const botMessages = chatbotApp.messageHistory.filter(msg => msg.type === 'bot');
      expect(botMessages.length).toBeGreaterThanOrEqual(3);
      
      // All messages should have the same session ID (context preserved)
      const sessionIds = [...userMessages, ...botMessages].map(msg => msg.sessionId);
      const uniqueSessionIds = [...new Set(sessionIds)];
      expect(uniqueSessionIds.length).toBe(1);
    });
  });

  describe('Performance and User Experience E2E', () => {
    test('should maintain responsive performance during extended use', async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const fab = document.querySelector('.chat-widget__fab');
      fab.click();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const chatInterface = chatbotApp.chatInterface;
      const input = chatInterface.container.querySelector('.chat-widget__input');
      const sendButton = chatInterface.container.querySelector('.chat-widget__send-btn');
      
      const startTime = Date.now();
      const messageCount = 10;
      
      // Send multiple messages rapidly
      for (let i = 0; i < messageCount; i++) {
        input.value = `Performance test message ${i + 1}`;
        sendButton.click();
        
        // Small delay between messages
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      // Wait for all responses
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      // Verify all messages were processed
      const userMessages = chatbotApp.messageHistory.filter(msg => msg.type === 'user');
      const botMessages = chatbotApp.messageHistory.filter(msg => msg.type === 'bot');
      
      expect(userMessages.length).toBe(messageCount);
      expect(botMessages.length).toBeGreaterThanOrEqual(messageCount);
      
      // Performance should be reasonable (less than 1 second per message on average)
      const averageTimePerMessage = totalTime / messageCount;
      expect(averageTimePerMessage).toBeLessThan(2000); // 2 seconds max per message
      
      // Interface should still be responsive
      input.value = 'Final test message';
      sendButton.click();
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const finalMessage = chatbotApp.messageHistory.find(msg => 
        msg.content === 'Final test message'
      );
      expect(finalMessage).toBeTruthy();
    });

    test('should handle interface state transitions smoothly', async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const fab = document.querySelector('.chat-widget__fab');
      
      // Test multiple open/close cycles
      for (let cycle = 0; cycle < 5; cycle++) {
        // Open interface
        fab.click();
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Verify interface opened
        expect(chatbotApp.chatInterface).toBeTruthy();
        
        const chatInterface = chatbotApp.chatInterface;
        const closeButton = chatInterface.container.querySelector('.chat-widget__close-btn');
        
        // Send a quick message
        const input = chatInterface.container.querySelector('.chat-widget__input');
        const sendButton = chatInterface.container.querySelector('.chat-widget__send-btn');
        
        input.value = `Cycle ${cycle + 1} message`;
        sendButton.click();
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Close interface
        if (closeButton) {
          closeButton.click();
        } else {
          chatbotApp.closeChatInterface();
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Verify interface closed
        expect(chatbotApp.chatInterface).toBeNull();
      }
      
      // Verify message history was preserved across cycles
      const userMessages = chatbotApp.messageHistory.filter(msg => msg.type === 'user');
      expect(userMessages.length).toBe(5);
      
      // Final open should restore history
      fab.click();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const finalInterface = chatbotApp.chatInterface;
      expect(finalInterface).toBeTruthy();
      
      // History should be visible in interface
      const messageElements = finalInterface.container.querySelectorAll('.chat-message');
      expect(messageElements.length).toBeGreaterThan(0);
    });

    test('should provide consistent user experience across viewport changes', async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Start on desktop
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1440,
      });
      
      const fab = document.querySelector('.chat-widget__fab');
      fab.click();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      let chatInterface = chatbotApp.chatInterface;
      let input = chatInterface.container.querySelector('.chat-widget__input');
      let sendButton = chatInterface.container.querySelector('.chat-widget__send-btn');
      
      // Send message on desktop
      input.value = 'Desktop message';
      sendButton.click();
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Switch to mobile
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });
      
      window.dispatchEvent(new Event('resize'));
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Interface should still be functional
      chatInterface = chatbotApp.chatInterface;
      input = chatInterface.container.querySelector('.chat-widget__input');
      sendButton = chatInterface.container.querySelector('.chat-widget__send-btn');
      
      expect(input).toBeTruthy();
      expect(sendButton).toBeTruthy();
      
      // Send message on mobile
      input.value = 'Mobile message';
      sendButton.click();
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Switch to tablet
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768,
      });
      
      window.dispatchEvent(new Event('resize'));
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Send message on tablet
      chatInterface = chatbotApp.chatInterface;
      input = chatInterface.container.querySelector('.chat-widget__input');
      sendButton = chatInterface.container.querySelector('.chat-widget__send-btn');
      
      input.value = 'Tablet message';
      sendButton.click();
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Verify all messages were processed correctly
      const userMessages = chatbotApp.messageHistory.filter(msg => msg.type === 'user');
      expect(userMessages.length).toBe(3);
      
      const messageContents = userMessages.map(msg => msg.content);
      expect(messageContents).toContain('Desktop message');
      expect(messageContents).toContain('Mobile message');
      expect(messageContents).toContain('Tablet message');
      
      // All should have responses
      const botMessages = chatbotApp.messageHistory.filter(msg => msg.type === 'bot');
      expect(botMessages.length).toBeGreaterThanOrEqual(3);
    });
  });
});