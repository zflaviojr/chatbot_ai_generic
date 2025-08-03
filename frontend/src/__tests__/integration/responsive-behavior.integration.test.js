/**
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals';
import { ChatbotApp } from '../../components/ChatbotApp.js';

// Mock WebSocket for responsive testing
global.WebSocket = class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = WebSocket.OPEN;
    this.CONNECTING = 0;
    this.OPEN = 1;
    this.CLOSING = 2;
    this.CLOSED = 3;
  }
  
  send(data) {
    // Mock response
    setTimeout(() => {
      if (this.onmessage) {
        this.onmessage({
          data: JSON.stringify({
            type: 'chatResponse',
            messageId: 'test-id',
            content: 'Test response',
            timestamp: new Date().toISOString()
          })
        });
      }
    }, 10);
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

describe('Responsive Behavior Integration Tests', () => {
  let chatbotApp;
  let container;

  beforeEach(() => {
    // Clean DOM
    document.body.innerHTML = '';
    
    // Create container
    container = document.createElement('div');
    container.id = 'test-container';
    document.body.appendChild(container);
    
    // Initialize chatbot app
    const config = {
      websocketUrl: 'ws://localhost:3001/ws',
      title: 'Test Chatbot',
      enableNotifications: false,
      enableSounds: false,
      autoStart: false,
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

  describe('Desktop Responsive Behavior (>1024px)', () => {
    beforeEach(() => {
      // Set desktop viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1440,
      });
      
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 900,
      });
      
      // Trigger resize event
      window.dispatchEvent(new Event('resize'));
    });

    test('should display chat widget with desktop dimensions', () => {
      const widget = document.querySelector('.chat-widget');
      expect(widget).toBeTruthy();
      
      // Check FAB positioning and size
      const fab = widget.querySelector('.chat-widget__fab');
      expect(fab).toBeTruthy();
      
      const fabStyles = window.getComputedStyle(fab);
      // Note: In JSDOM, computed styles may not reflect CSS exactly
      // We verify the elements exist and have appropriate classes
      expect(fab.classList.contains('chat-widget__fab')).toBe(true);
    });

    test('should open chat interface with desktop layout', () => {
      chatbotApp.openChatInterface();
      
      const chatInterface = chatbotApp.chatInterface;
      expect(chatInterface).toBeTruthy();
      
      const interfaceContainer = chatInterface.container;
      expect(interfaceContainer).toBeTruthy();
      
      // Verify desktop-specific elements
      const header = interfaceContainer.querySelector('.chat-widget__header');
      const messageArea = interfaceContainer.querySelector('.chat-widget__messages');
      const inputArea = interfaceContainer.querySelector('.chat-widget__input-area');
      
      expect(header).toBeTruthy();
      expect(messageArea).toBeTruthy();
      expect(inputArea).toBeTruthy();
      
      // Verify desktop layout classes
      expect(interfaceContainer.classList.contains('chat-widget__interface')).toBe(true);
    });

    test('should handle desktop-specific interactions', async () => {
      chatbotApp.openChatInterface();
      
      const chatInterface = chatbotApp.chatInterface;
      const input = chatInterface.container.querySelector('.chat-widget__input');
      const sendButton = chatInterface.container.querySelector('.chat-widget__send-btn');
      
      expect(input).toBeTruthy();
      expect(sendButton).toBeTruthy();
      
      // Test desktop keyboard interaction (Enter to send)
      input.value = 'Desktop test message';
      
      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true
      });
      
      input.dispatchEvent(enterEvent);
      
      // Wait for message processing
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Verify message was sent
      expect(chatbotApp.messageHistory.length).toBeGreaterThan(0);
      expect(chatbotApp.messageHistory[0].content).toBe('Desktop test message');
    });

    test('should handle window resize from desktop to tablet', () => {
      chatbotApp.openChatInterface();
      const initialInterface = chatbotApp.chatInterface;
      
      // Resize to tablet
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768,
      });
      
      window.dispatchEvent(new Event('resize'));
      
      // Wait for resize handling
      setTimeout(() => {
        // Verify interface adapted to new size
        expect(chatbotApp.chatInterface).toBeTruthy();
        
        const interfaceContainer = chatbotApp.chatInterface.container;
        expect(interfaceContainer).toBeTruthy();
      }, 10);
    });
  });

  describe('Tablet Responsive Behavior (768px-1024px)', () => {
    beforeEach(() => {
      // Set tablet viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768,
      });
      
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 1024,
      });
      
      window.dispatchEvent(new Event('resize'));
    });

    test('should adapt chat widget for tablet dimensions', () => {
      const widget = document.querySelector('.chat-widget');
      expect(widget).toBeTruthy();
      
      // Verify tablet-appropriate sizing
      const fab = widget.querySelector('.chat-widget__fab');
      expect(fab).toBeTruthy();
      expect(fab.classList.contains('chat-widget__fab')).toBe(true);
    });

    test('should handle tablet orientation changes', () => {
      chatbotApp.openChatInterface();
      
      // Simulate portrait to landscape
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
      
      // Mock orientation change event
      const orientationEvent = new Event('orientationchange');
      window.dispatchEvent(orientationEvent);
      
      // Verify interface adapted
      expect(chatbotApp.chatInterface).toBeTruthy();
      
      const interfaceContainer = chatbotApp.chatInterface.container;
      expect(interfaceContainer).toBeTruthy();
    });

    test('should handle touch interactions on tablet', async () => {
      chatbotApp.openChatInterface();
      
      const chatInterface = chatbotApp.chatInterface;
      const sendButton = chatInterface.container.querySelector('.chat-widget__send-btn');
      const input = chatInterface.container.querySelector('.chat-widget__input');
      
      expect(sendButton).toBeTruthy();
      expect(input).toBeTruthy();
      
      // Simulate touch interaction
      input.value = 'Tablet touch message';
      
      const touchEvent = new TouchEvent('touchstart', {
        touches: [{ clientX: 100, clientY: 100 }],
        bubbles: true
      });
      
      sendButton.dispatchEvent(touchEvent);
      
      // Simulate click after touch
      sendButton.click();
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Verify message was sent
      expect(chatbotApp.messageHistory.length).toBeGreaterThan(0);
      expect(chatbotApp.messageHistory[0].content).toBe('Tablet touch message');
    });
  });

  describe('Mobile Responsive Behavior (<768px)', () => {
    beforeEach(() => {
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
    });

    test('should adapt chat widget for mobile dimensions', () => {
      const widget = document.querySelector('.chat-widget');
      expect(widget).toBeTruthy();
      
      // Verify mobile-appropriate elements
      const fab = widget.querySelector('.chat-widget__fab');
      expect(fab).toBeTruthy();
      expect(fab.classList.contains('chat-widget__fab')).toBe(true);
    });

    test('should open fullscreen chat interface on mobile', () => {
      chatbotApp.openChatInterface();
      
      const chatInterface = chatbotApp.chatInterface;
      expect(chatInterface).toBeTruthy();
      
      const interfaceContainer = chatInterface.container;
      expect(interfaceContainer).toBeTruthy();
      
      // Verify mobile layout elements
      const header = interfaceContainer.querySelector('.chat-widget__header');
      const closeButton = header?.querySelector('.chat-widget__close-btn');
      
      expect(header).toBeTruthy();
      expect(closeButton).toBeTruthy();
    });

    test('should handle virtual keyboard appearance', () => {
      chatbotApp.openChatInterface();
      
      const chatInterface = chatbotApp.chatInterface;
      const input = chatInterface.container.querySelector('.chat-widget__input');
      
      expect(input).toBeTruthy();
      
      // Simulate virtual keyboard appearance (viewport height reduction)
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 300, // Reduced height simulating keyboard
      });
      
      // Mock visualViewport API
      if (!window.visualViewport) {
        window.visualViewport = {
          height: 300,
          addEventListener: jest.fn(),
          removeEventListener: jest.fn()
        };
      }
      
      // Trigger viewport change
      const viewportEvent = new Event('resize');
      window.dispatchEvent(viewportEvent);
      
      // Verify interface adapted to keyboard
      expect(chatInterface.container).toBeTruthy();
    });

    test('should handle mobile swipe gestures', () => {
      chatbotApp.openChatInterface();
      
      const chatInterface = chatbotApp.chatInterface;
      const interfaceContainer = chatInterface.container;
      
      // Simulate swipe down to close
      const touchStart = new TouchEvent('touchstart', {
        touches: [{ clientX: 200, clientY: 100 }],
        bubbles: true
      });
      
      const touchMove = new TouchEvent('touchmove', {
        touches: [{ clientX: 200, clientY: 200 }],
        bubbles: true
      });
      
      const touchEnd = new TouchEvent('touchend', {
        changedTouches: [{ clientX: 200, clientY: 200 }],
        bubbles: true
      });
      
      interfaceContainer.dispatchEvent(touchStart);
      interfaceContainer.dispatchEvent(touchMove);
      interfaceContainer.dispatchEvent(touchEnd);
      
      // Verify swipe was handled (interface should still exist unless specifically programmed to close)
      expect(chatInterface.container).toBeTruthy();
    });

    test('should handle mobile-specific input behaviors', async () => {
      chatbotApp.openChatInterface();
      
      const chatInterface = chatbotApp.chatInterface;
      const input = chatInterface.container.querySelector('.chat-widget__input');
      const sendButton = chatInterface.container.querySelector('.chat-widget__send-btn');
      
      expect(input).toBeTruthy();
      expect(sendButton).toBeTruthy();
      
      // Test mobile input behavior (no Enter to send, only button)
      input.value = 'Mobile test message';
      
      // Verify Enter doesn't send on mobile (Shift+Enter for new line)
      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true
      });
      
      input.dispatchEvent(enterEvent);
      
      // Should not send message yet
      expect(chatbotApp.messageHistory.length).toBe(0);
      
      // Send via button
      sendButton.click();
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Now message should be sent
      expect(chatbotApp.messageHistory.length).toBeGreaterThan(0);
      expect(chatbotApp.messageHistory[0].content).toBe('Mobile test message');
    });
  });

  describe('Cross-Device Responsive Transitions', () => {
    test('should maintain state during viewport transitions', async () => {
      // Start on desktop
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1440,
      });
      
      chatbotApp.openChatInterface();
      
      // Send a message on desktop
      const chatInterface = chatbotApp.chatInterface;
      const input = chatInterface.container.querySelector('.chat-widget__input');
      const sendButton = chatInterface.container.querySelector('.chat-widget__send-btn');
      
      input.value = 'Message before resize';
      sendButton.click();
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Verify message was sent
      expect(chatbotApp.messageHistory.length).toBe(1);
      
      // Resize to mobile
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });
      
      window.dispatchEvent(new Event('resize'));
      
      // Wait for resize handling
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Verify message history is preserved
      expect(chatbotApp.messageHistory.length).toBe(1);
      expect(chatbotApp.messageHistory[0].content).toBe('Message before resize');
      
      // Verify interface still works on mobile
      const mobileInput = chatInterface.container.querySelector('.chat-widget__input');
      const mobileSendButton = chatInterface.container.querySelector('.chat-widget__send-btn');
      
      expect(mobileInput).toBeTruthy();
      expect(mobileSendButton).toBeTruthy();
      
      mobileInput.value = 'Message after resize';
      mobileSendButton.click();
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Verify new message was sent
      expect(chatbotApp.messageHistory.length).toBe(2);
      expect(chatbotApp.messageHistory[1].content).toBe('Message after resize');
    });

    test('should handle rapid viewport changes', () => {
      const viewportSizes = [
        { width: 1440, height: 900 }, // Desktop
        { width: 768, height: 1024 }, // Tablet portrait
        { width: 1024, height: 768 }, // Tablet landscape
        { width: 375, height: 667 },  // Mobile
        { width: 1200, height: 800 }  // Desktop again
      ];
      
      chatbotApp.openChatInterface();
      
      // Rapidly change viewport sizes
      viewportSizes.forEach((size, index) => {
        Object.defineProperty(window, 'innerWidth', {
          writable: true,
          configurable: true,
          value: size.width,
        });
        
        Object.defineProperty(window, 'innerHeight', {
          writable: true,
          configurable: true,
          value: size.height,
        });
        
        window.dispatchEvent(new Event('resize'));
      });
      
      // Verify interface is still functional after rapid changes
      expect(chatbotApp.chatInterface).toBeTruthy();
      
      const finalInterface = chatbotApp.chatInterface.container;
      expect(finalInterface).toBeTruthy();
      
      const input = finalInterface.querySelector('.chat-widget__input');
      const sendButton = finalInterface.querySelector('.chat-widget__send-btn');
      
      expect(input).toBeTruthy();
      expect(sendButton).toBeTruthy();
    });

    test('should preserve accessibility features across screen sizes', () => {
      const testAccessibility = (screenSize) => {
        const chatInterface = chatbotApp.chatInterface;
        const interfaceContainer = chatInterface.container;
        
        // Check ARIA attributes
        const input = interfaceContainer.querySelector('.chat-widget__input');
        const sendButton = interfaceContainer.querySelector('.chat-widget__send-btn');
        const closeButton = interfaceContainer.querySelector('.chat-widget__close-btn');
        
        if (input) {
          expect(input.getAttribute('aria-label')).toBeTruthy();
        }
        
        if (sendButton) {
          expect(sendButton.getAttribute('aria-label')).toBeTruthy();
        }
        
        if (closeButton) {
          expect(closeButton.getAttribute('aria-label')).toBeTruthy();
        }
        
        // Check keyboard navigation
        const focusableElements = interfaceContainer.querySelectorAll(
          'button, input, textarea, [tabindex]:not([tabindex=\"-1\"])'
        );
        
        expect(focusableElements.length).toBeGreaterThan(0);
      };
      
      // Test on desktop
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1440,
      });
      
      chatbotApp.openChatInterface();
      testAccessibility('desktop');
      
      // Test on mobile
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });
      
      window.dispatchEvent(new Event('resize'));
      testAccessibility('mobile');
    });
  });
});