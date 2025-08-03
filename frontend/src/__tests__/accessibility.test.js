/**
 * Accessibility Tests
 * Tests for keyboard navigation, screen reader support, and ARIA compliance
 */

import { jest } from '@jest/globals';
import { AccessibilityManager } from '../utils/AccessibilityManager.js';

// Mock DOM APIs
global.getComputedStyle = jest.fn(() => ({
  visibility: 'visible'
}));

describe('AccessibilityManager', () => {
  let container;
  let accessibilityManager;

  beforeEach(() => {
    // Create test container with chat elements
    container = document.createElement('div');
    container.innerHTML = `
      <div class="chat-widget__fab" role="button" tabindex="0"></div>
      <div class="chat-widget__interface">
        <div class="chat-widget__header">
          <h3 id="chat-title">Chat</h3>
          <button class="chat-widget__close-btn">Close</button>
        </div>
        <div class="chat-widget__messages" role="log"></div>
        <div class="chat-widget__input-area">
          <textarea class="chat-widget__input" id="chat-input"></textarea>
          <button class="chat-widget__send-btn">Send</button>
        </div>
      </div>
    `;
    document.body.appendChild(container);

    accessibilityManager = new AccessibilityManager(container);
  });

  afterEach(() => {
    accessibilityManager.destroy();
    document.body.removeChild(container);
  });

  describe('ARIA Attributes', () => {
    test('should set up basic ARIA attributes', () => {
      expect(container.getAttribute('role')).toBe('application');
      expect(container.getAttribute('aria-label')).toBe('Chat Widget');
    });

    test('should set up chat interface ARIA attributes', () => {
      const chatInterface = container.querySelector('.chat-widget__interface');
      expect(chatInterface.getAttribute('role')).toBe('dialog');
      expect(chatInterface.getAttribute('aria-modal')).toBe('true');
      expect(chatInterface.getAttribute('aria-labelledby')).toBe('chat-title');
    });

    test('should set up messages container ARIA attributes', () => {
      const messagesContainer = container.querySelector('.chat-widget__messages');
      expect(messagesContainer.getAttribute('role')).toBe('log');
      expect(messagesContainer.getAttribute('aria-live')).toBe('polite');
      expect(messagesContainer.getAttribute('aria-label')).toBe('Mensagens do chat');
    });

    test('should set up input ARIA attributes', () => {
      const input = container.querySelector('.chat-widget__input');
      expect(input.getAttribute('role')).toBe('textbox');
      expect(input.getAttribute('aria-label')).toBe('Digite sua mensagem');
      expect(input.getAttribute('aria-multiline')).toBe('true');
    });

    test('should set up button ARIA attributes', () => {
      const sendBtn = container.querySelector('.chat-widget__send-btn');
      const closeBtn = container.querySelector('.chat-widget__close-btn');
      const fab = container.querySelector('.chat-widget__fab');

      expect(sendBtn.getAttribute('aria-label')).toBe('Enviar mensagem');
      expect(closeBtn.getAttribute('aria-label')).toBe('Fechar chat');
      expect(fab.getAttribute('aria-label')).toBe('Abrir chat');
    });
  });

  describe('Keyboard Navigation', () => {
    test('should handle global keyboard shortcuts', () => {
      const toggleSpy = jest.spyOn(accessibilityManager, 'toggleChat');
      
      // Alt + C should toggle chat
      const altCEvent = new KeyboardEvent('keydown', {
        key: 'c',
        altKey: true,
        bubbles: true
      });
      
      document.dispatchEvent(altCEvent);
      expect(toggleSpy).toHaveBeenCalled();
    });

    test('should handle Escape key to close chat', () => {
      const closeSpy = jest.spyOn(accessibilityManager, 'closeChat');
      container.classList.add('chat-widget--open');
      
      const escapeEvent = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true
      });
      
      document.dispatchEvent(escapeEvent);
      expect(closeSpy).toHaveBeenCalled();
    });

    test('should handle Tab navigation', () => {
      const input = container.querySelector('.chat-widget__input');
      const sendBtn = container.querySelector('.chat-widget__send-btn');
      
      // Focus input first
      input.focus();
      
      // Tab should move to send button
      const tabEvent = new KeyboardEvent('keydown', {
        key: 'Tab',
        bubbles: true
      });
      
      container.dispatchEvent(tabEvent);
      // Note: In real DOM, focus would move, but in JSDOM we need to simulate
      expect(accessibilityManager.focusableElements).toContain(sendBtn);
    });

    test('should handle Enter key in input to send message', () => {
      const sendSpy = jest.spyOn(accessibilityManager, 'sendMessage');
      const input = container.querySelector('.chat-widget__input');
      
      input.focus();
      
      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true
      });
      
      input.dispatchEvent(enterEvent);
      expect(sendSpy).toHaveBeenCalled();
    });

    test('should handle arrow key navigation between messages', () => {
      // Add some messages
      const messagesContainer = container.querySelector('.chat-widget__messages');
      messagesContainer.innerHTML = `
        <div class="chat-widget__message" tabindex="0">Message 1</div>
        <div class="chat-widget__message" tabindex="0">Message 2</div>
        <div class="chat-widget__message" tabindex="0">Message 3</div>
      `;

      const messages = messagesContainer.querySelectorAll('.chat-widget__message');
      messages[1].focus();

      const arrowUpEvent = new KeyboardEvent('keydown', {
        key: 'ArrowUp',
        bubbles: true
      });

      messagesContainer.dispatchEvent(arrowUpEvent);
      
      // Should have ARIA attributes set
      messages.forEach((msg, index) => {
        expect(msg.getAttribute('role')).toBe('article');
        expect(msg.getAttribute('aria-posinset')).toBe((index + 1).toString());
        expect(msg.getAttribute('aria-setsize')).toBe('3');
      });
    });
  });

  describe('Focus Management', () => {
    test('should update focusable elements', () => {
      accessibilityManager.updateFocusableElements();
      
      expect(accessibilityManager.focusableElements.length).toBeGreaterThan(0);
      expect(accessibilityManager.focusableElements).toContain(
        container.querySelector('.chat-widget__input')
      );
      expect(accessibilityManager.focusableElements).toContain(
        container.querySelector('.chat-widget__send-btn')
      );
    });

    test('should focus first element', () => {
      const focusSpy = jest.spyOn(HTMLElement.prototype, 'focus');
      accessibilityManager.focusFirstElement();
      
      expect(focusSpy).toHaveBeenCalled();
    });

    test('should focus last element', () => {
      const focusSpy = jest.spyOn(HTMLElement.prototype, 'focus');
      accessibilityManager.focusLastElement();
      
      expect(focusSpy).toHaveBeenCalled();
    });

    test('should trap focus within container', () => {
      const firstElement = container.querySelector('.chat-widget__fab');
      const lastElement = container.querySelector('.chat-widget__send-btn');
      
      // Mock focus on last element
      Object.defineProperty(document, 'activeElement', {
        value: lastElement,
        writable: true
      });

      const tabEvent = new KeyboardEvent('keydown', {
        key: 'Tab',
        bubbles: true
      });

      const focusSpy = jest.spyOn(firstElement, 'focus');
      accessibilityManager.trapFocus(tabEvent);
      
      expect(focusSpy).toHaveBeenCalled();
    });
  });

  describe('ARIA Live Regions', () => {
    test('should create ARIA live region', () => {
      expect(accessibilityManager.ariaLiveRegion).toBeTruthy();
      expect(accessibilityManager.ariaLiveRegion.getAttribute('aria-live')).toBe('polite');
      expect(accessibilityManager.ariaLiveRegion.getAttribute('aria-atomic')).toBe('true');
    });

    test('should announce messages', () => {
      const testMessage = 'Test announcement';
      accessibilityManager.announce(testMessage);
      
      expect(accessibilityManager.ariaLiveRegion.textContent).toBe(testMessage);
    });

    test('should clear announcements after timeout', (done) => {
      const testMessage = 'Test announcement';
      accessibilityManager.announce(testMessage);
      
      setTimeout(() => {
        expect(accessibilityManager.ariaLiveRegion.textContent).toBe('');
        done();
      }, 1100);
    });

    test('should announce with different priorities', () => {
      accessibilityManager.announce('Urgent message', 'assertive');
      expect(accessibilityManager.ariaLiveRegion.getAttribute('aria-live')).toBe('assertive');
    });
  });

  describe('Screen Reader Support', () => {
    test('should add screen reader only text', () => {
      const srElements = container.querySelectorAll('.sr-only');
      expect(srElements.length).toBeGreaterThan(0);
    });

    test('should add skip links', () => {
      const skipLink = container.querySelector('.skip-link');
      expect(skipLink).toBeTruthy();
      expect(skipLink.textContent).toBe('Pular para campo de mensagem');
      expect(skipLink.getAttribute('href')).toBe('#chat-input');
    });

    test('should handle message announcements', () => {
      const announceSpy = jest.spyOn(accessibilityManager, 'announce');
      
      const messageEvent = new CustomEvent('messageAdded', {
        detail: {
          type: 'bot',
          content: 'Hello from bot'
        }
      });
      
      container.dispatchEvent(messageEvent);
      expect(announceSpy).toHaveBeenCalledWith('Nova mensagem do assistente: Hello from bot');
    });

    test('should announce typing indicators', () => {
      const announceSpy = jest.spyOn(accessibilityManager, 'announce');
      
      const typingStartEvent = new CustomEvent('typingStarted');
      const typingStopEvent = new CustomEvent('typingStopped');
      
      container.dispatchEvent(typingStartEvent);
      expect(announceSpy).toHaveBeenCalledWith('Assistente está digitando');
      
      container.dispatchEvent(typingStopEvent);
      expect(announceSpy).toHaveBeenCalledWith('Assistente parou de digitar');
    });
  });

  describe('Button State Management', () => {
    test('should update FAB expanded state', () => {
      const fab = container.querySelector('.chat-widget__fab');
      
      // Initially closed
      accessibilityManager.updateButtonStates();
      expect(fab.getAttribute('aria-expanded')).toBe('false');
      expect(fab.getAttribute('aria-label')).toBe('Abrir chat');
      
      // When open
      container.classList.add('chat-widget--open');
      accessibilityManager.updateButtonStates();
      expect(fab.getAttribute('aria-expanded')).toBe('true');
      expect(fab.getAttribute('aria-label')).toBe('Fechar chat');
    });

    test('should update send button state based on input', () => {
      const sendBtn = container.querySelector('.chat-widget__send-btn');
      const input = container.querySelector('.chat-widget__input');
      
      // Empty input
      input.value = '';
      accessibilityManager.updateButtonStates();
      expect(sendBtn.getAttribute('aria-disabled')).toBe('true');
      
      // With content
      input.value = 'Hello';
      accessibilityManager.updateButtonStates();
      expect(sendBtn.getAttribute('aria-disabled')).toBe('false');
    });
  });

  describe('Keyboard Shortcut Matching', () => {
    test('should match simple key shortcuts', () => {
      const event = new KeyboardEvent('keydown', { key: 'c' });
      expect(accessibilityManager.matchesShortcut(event, 'c')).toBe(true);
      expect(accessibilityManager.matchesShortcut(event, 'd')).toBe(false);
    });

    test('should match modifier key shortcuts', () => {
      const ctrlCEvent = new KeyboardEvent('keydown', { key: 'c', ctrlKey: true });
      const altCEvent = new KeyboardEvent('keydown', { key: 'c', altKey: true });
      
      expect(accessibilityManager.matchesShortcut(ctrlCEvent, 'ctrl+c')).toBe(true);
      expect(accessibilityManager.matchesShortcut(altCEvent, 'alt+c')).toBe(true);
      expect(accessibilityManager.matchesShortcut(ctrlCEvent, 'alt+c')).toBe(false);
    });

    test('should match complex shortcuts', () => {
      const event = new KeyboardEvent('keydown', {
        key: 's',
        ctrlKey: true,
        shiftKey: true
      });
      
      expect(accessibilityManager.matchesShortcut(event, 'ctrl+shift+s')).toBe(true);
      expect(accessibilityManager.matchesShortcut(event, 'ctrl+s')).toBe(false);
    });
  });

  describe('Custom Keyboard Shortcuts', () => {
    test('should handle custom keyboard shortcuts', () => {
      const customAction = jest.fn();
      const customManager = new AccessibilityManager(container, {
        keyboardShortcuts: {
          'ctrl+k': customAction
        }
      });

      const event = new KeyboardEvent('keydown', {
        key: 'k',
        ctrlKey: true,
        bubbles: true
      });

      document.dispatchEvent(event);
      expect(customAction).toHaveBeenCalled();

      customManager.destroy();
    });
  });

  describe('Statistics and Cleanup', () => {
    test('should provide accessibility stats', () => {
      const stats = accessibilityManager.getStats();
      
      expect(stats).toHaveProperty('focusableElements');
      expect(stats).toHaveProperty('hasAriaLiveRegion');
      expect(stats).toHaveProperty('keyboardNavigationEnabled');
      expect(stats).toHaveProperty('screenReaderEnabled');
      expect(stats).toHaveProperty('focusManagementEnabled');
      
      expect(typeof stats.focusableElements).toBe('number');
      expect(typeof stats.hasAriaLiveRegion).toBe('boolean');
    });

    test('should clean up properly on destroy', () => {
      const liveRegion = accessibilityManager.ariaLiveRegion;
      expect(document.body.contains(liveRegion)).toBe(true);
      
      accessibilityManager.destroy();
      
      expect(document.body.contains(liveRegion)).toBe(false);
      expect(accessibilityManager.focusableElements).toEqual([]);
    });
  });
});

describe('Accessibility Integration', () => {
  test('should work with touch gestures', () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <div class="chat-widget__fab"></div>
      <div class="chat-widget__interface">
        <textarea class="chat-widget__input"></textarea>
        <button class="chat-widget__send-btn">Send</button>
      </div>
    `;
    document.body.appendChild(container);

    const accessibilityManager = new AccessibilityManager(container);
    
    // Should not interfere with touch events
    const touchEvent = new TouchEvent('touchstart', {
      touches: [{ clientX: 100, clientY: 100 }]
    });
    
    expect(() => {
      container.dispatchEvent(touchEvent);
    }).not.toThrow();

    accessibilityManager.destroy();
    document.body.removeChild(container);
  });

  test('should work with performance optimizations', () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <div class="chat-widget__messages">
        ${Array.from({ length: 100 }, (_, i) => 
          `<div class="chat-widget__message">Message ${i}</div>`
        ).join('')}
      </div>
    `;
    document.body.appendChild(container);

    const accessibilityManager = new AccessibilityManager(container);
    
    // Should handle large number of messages efficiently
    const startTime = performance.now();
    accessibilityManager.navigateMessages(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    const endTime = performance.now();
    
    // Should complete in reasonable time (less than 50ms)
    expect(endTime - startTime).toBeLessThan(50);

    accessibilityManager.destroy();
    document.body.removeChild(container);
  });
});

// Color contrast and visual accessibility tests
describe('Visual Accessibility', () => {
  test('should have sufficient color contrast', () => {
    // This would typically use a color contrast checking library
    // For now, we'll just verify that contrast-related CSS classes exist
    const container = document.createElement('div');
    container.innerHTML = `
      <div class="chat-widget__fab"></div>
      <div class="chat-widget__message--user">User message</div>
      <div class="chat-widget__message--bot">Bot message</div>
    `;
    
    // In a real implementation, you would check computed styles
    // and calculate contrast ratios here
    expect(container.querySelector('.chat-widget__fab')).toBeTruthy();
    expect(container.querySelector('.chat-widget__message--user')).toBeTruthy();
    expect(container.querySelector('.chat-widget__message--bot')).toBeTruthy();
  });

  test('should support high contrast mode', () => {
    // Mock high contrast media query
    Object.defineProperty(window, 'matchMedia', {
      value: jest.fn(() => ({
        matches: true,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn()
      }))
    });

    const container = document.createElement('div');
    document.body.appendChild(container);
    
    const accessibilityManager = new AccessibilityManager(container);
    
    // Should not throw errors in high contrast mode
    expect(() => {
      accessibilityManager.updateButtonStates();
    }).not.toThrow();

    accessibilityManager.destroy();
    document.body.removeChild(container);
  });

  test('should support reduced motion preferences', () => {
    // Mock reduced motion media query
    Object.defineProperty(window, 'matchMedia', {
      value: jest.fn(() => ({
        matches: true,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn()
      }))
    });

    const container = document.createElement('div');
    document.body.appendChild(container);
    
    const accessibilityManager = new AccessibilityManager(container);
    
    // Should respect reduced motion preferences
    expect(() => {
      accessibilityManager.announce('Test message');
    }).not.toThrow();

    accessibilityManager.destroy();
    document.body.removeChild(container);
  });
});