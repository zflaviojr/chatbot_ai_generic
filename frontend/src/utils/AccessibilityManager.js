/**
 * Accessibility Manager
 * Handles keyboard navigation, screen reader support, and ARIA attributes
 */
export class AccessibilityManager {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      enableKeyboardNavigation: options.enableKeyboardNavigation !== false,
      enableScreenReader: options.enableScreenReader !== false,
      enableFocusManagement: options.enableFocusManagement !== false,
      enableAriaLiveRegions: options.enableAriaLiveRegions !== false,
      announceMessages: options.announceMessages !== false,
      keyboardShortcuts: options.keyboardShortcuts || {},
      ...options
    };

    this.focusableElements = [];
    this.currentFocusIndex = -1;
    this.lastFocusedElement = null;
    this.ariaLiveRegion = null;
    this.keyboardListeners = new Map();
    
    this.init();
  }

  /**
   * Initialize accessibility features
   */
  init() {
    if (!this.container) return;

    this.setupAriaAttributes();
    this.setupKeyboardNavigation();
    this.setupFocusManagement();
    this.setupAriaLiveRegions();
    this.setupScreenReaderSupport();
    
    console.log('AccessibilityManager initialized');
  }

  /**
   * Setup ARIA attributes
   */
  setupAriaAttributes() {
    // Main container
    this.container.setAttribute('role', 'application');
    this.container.setAttribute('aria-label', 'Chat Widget');
    
    // Chat interface
    const chatInterface = this.container.querySelector('.chat-interface, .chat-widget__interface');
    if (chatInterface) {
      chatInterface.setAttribute('role', 'dialog');
      chatInterface.setAttribute('aria-modal', 'true');
      chatInterface.setAttribute('aria-labelledby', 'chat-title');
    }

    // Messages container
    const messagesContainer = this.container.querySelector('.chat-interface__messages, .chat-widget__messages');
    if (messagesContainer) {
      messagesContainer.setAttribute('role', 'log');
      messagesContainer.setAttribute('aria-live', 'polite');
      messagesContainer.setAttribute('aria-label', 'Mensagens do chat');
      messagesContainer.setAttribute('aria-atomic', 'false');
    }

    // Input field
    const input = this.container.querySelector('.chat-interface__input, .chat-widget__input');
    if (input) {
      input.setAttribute('role', 'textbox');
      input.setAttribute('aria-label', 'Digite sua mensagem');
      input.setAttribute('aria-multiline', 'true');
      input.setAttribute('aria-required', 'false');
    }

    // Buttons
    this.setupButtonAria();
  }

  /**
   * Setup ARIA attributes for buttons
   */
  setupButtonAria() {
    const buttons = this.container.querySelectorAll('button');
    
    buttons.forEach(button => {
      if (!button.getAttribute('aria-label')) {
        // Determine button purpose from class or content
        if (button.classList.contains('send-btn') || button.classList.contains('chat-widget__send-btn')) {
          button.setAttribute('aria-label', 'Enviar mensagem');
          button.setAttribute('aria-keyshortcuts', 'Enter');
        } else if (button.classList.contains('close-btn') || button.classList.contains('chat-widget__close-btn')) {
          button.setAttribute('aria-label', 'Fechar chat');
          button.setAttribute('aria-keyshortcuts', 'Escape');
        } else if (button.classList.contains('minimize-btn') || button.classList.contains('chat-widget__minimize-btn')) {
          button.setAttribute('aria-label', 'Minimizar chat');
        } else if (button.classList.contains('fab') || button.classList.contains('chat-widget__fab')) {
          button.setAttribute('aria-label', 'Abrir chat');
          button.setAttribute('aria-expanded', 'false');
        }
      }

      // Add role if not present
      if (!button.getAttribute('role')) {
        button.setAttribute('role', 'button');
      }
    });
  }

  /**
   * Setup keyboard navigation
   */
  setupKeyboardNavigation() {
    if (!this.options.enableKeyboardNavigation) return;

    // Global keyboard shortcuts
    document.addEventListener('keydown', this.handleGlobalKeydown.bind(this));
    
    // Container-specific keyboard navigation
    this.container.addEventListener('keydown', this.handleContainerKeydown.bind(this));
    
    // Setup tab navigation
    this.setupTabNavigation();
    
    // Setup arrow key navigation
    this.setupArrowKeyNavigation();
  }

  /**
   * Handle global keyboard shortcuts
   */
  handleGlobalKeydown(e) {
    // Alt + C: Toggle chat
    if (e.altKey && e.key.toLowerCase() === 'c') {
      e.preventDefault();
      this.toggleChat();
      this.announce('Chat alternado');
    }

    // Escape: Close chat if open
    if (e.key === 'Escape') {
      const isOpen = this.container.classList.contains('chat-widget--open') || 
                     this.container.querySelector('.chat-interface');
      if (isOpen) {
        e.preventDefault();
        this.closeChat();
        this.announce('Chat fechado');
      }
    }

    // Custom keyboard shortcuts
    Object.entries(this.options.keyboardShortcuts).forEach(([shortcut, action]) => {
      if (this.matchesShortcut(e, shortcut)) {
        e.preventDefault();
        action();
      }
    });
  }

  /**
   * Handle container-specific keyboard events
   */
  handleContainerKeydown(e) {
    const activeElement = document.activeElement;
    
    // Don't interfere with input typing
    if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
      this.handleInputKeydown(e);
      return;
    }

    switch (e.key) {
      case 'Tab':
        this.handleTabNavigation(e);
        break;
      case 'ArrowUp':
      case 'ArrowDown':
        this.handleArrowNavigation(e);
        break;
      case 'Enter':
      case ' ':
        this.handleActivation(e);
        break;
      case 'Home':
        this.focusFirst();
        e.preventDefault();
        break;
      case 'End':
        this.focusLast();
        e.preventDefault();
        break;
    }
  }

  /**
   * Handle input field keyboard events
   */
  handleInputKeydown(e) {
    const input = e.target;
    
    // Enter to send (if not shift+enter)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.sendMessage();
      this.announce('Mensagem enviada');
    }

    // Escape to close
    if (e.key === 'Escape') {
      input.blur();
      this.closeChat();
    }

    // Ctrl+A to select all
    if (e.ctrlKey && e.key.toLowerCase() === 'a') {
      // Let default behavior happen
    }
  }

  /**
   * Setup tab navigation
   */
  setupTabNavigation() {
    this.updateFocusableElements();
    
    // Trap focus within chat when open
    this.container.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        this.trapFocus(e);
      }
    });
  }

  /**
   * Setup arrow key navigation
   */
  setupArrowKeyNavigation() {
    // Arrow keys navigate between messages
    const messagesContainer = this.container.querySelector('.chat-interface__messages, .chat-widget__messages');
    if (messagesContainer) {
      messagesContainer.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          this.navigateMessages(e);
        }
      });
    }
  }

  /**
   * Handle tab navigation
   */
  handleTabNavigation(e) {
    this.updateFocusableElements();
    
    if (this.focusableElements.length === 0) return;

    const currentIndex = this.focusableElements.indexOf(document.activeElement);
    let nextIndex;

    if (e.shiftKey) {
      // Shift+Tab: previous element
      nextIndex = currentIndex <= 0 ? this.focusableElements.length - 1 : currentIndex - 1;
    } else {
      // Tab: next element
      nextIndex = currentIndex >= this.focusableElements.length - 1 ? 0 : currentIndex + 1;
    }

    this.focusableElements[nextIndex].focus();
    e.preventDefault();
  }

  /**
   * Handle arrow key navigation
   */
  handleArrowNavigation(e) {
    const messages = this.container.querySelectorAll('.chat-interface__message, .chat-widget__message');
    if (messages.length === 0) return;

    const currentMessage = document.activeElement.closest('.chat-interface__message, .chat-widget__message');
    if (!currentMessage) return;

    const currentIndex = Array.from(messages).indexOf(currentMessage);
    let nextIndex;

    if (e.key === 'ArrowUp') {
      nextIndex = Math.max(0, currentIndex - 1);
    } else {
      nextIndex = Math.min(messages.length - 1, currentIndex + 1);
    }

    messages[nextIndex].focus();
    e.preventDefault();
  }

  /**
   * Handle activation (Enter/Space)
   */
  handleActivation(e) {
    const activeElement = document.activeElement;
    
    if (activeElement.tagName === 'BUTTON') {
      activeElement.click();
      e.preventDefault();
    }
  }

  /**
   * Trap focus within container
   */
  trapFocus(e) {
    this.updateFocusableElements();
    
    if (this.focusableElements.length === 0) return;

    const firstElement = this.focusableElements[0];
    const lastElement = this.focusableElements[this.focusableElements.length - 1];

    if (e.shiftKey) {
      // Shift+Tab
      if (document.activeElement === firstElement) {
        lastElement.focus();
        e.preventDefault();
      }
    } else {
      // Tab
      if (document.activeElement === lastElement) {
        firstElement.focus();
        e.preventDefault();
      }
    }
  }

  /**
   * Update list of focusable elements
   */
  updateFocusableElements() {
    const focusableSelectors = [
      'button:not([disabled])',
      'input:not([disabled])',
      'textarea:not([disabled])',
      'select:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])'
    ];

    this.focusableElements = Array.from(
      this.container.querySelectorAll(focusableSelectors.join(', '))
    ).filter(el => {
      return el.offsetParent !== null && // Element is visible
             getComputedStyle(el).visibility !== 'hidden' &&
             !el.hasAttribute('aria-hidden');
    });
  }

  /**
   * Setup focus management
   */
  setupFocusManagement() {
    if (!this.options.enableFocusManagement) return;

    // Save focus when chat opens
    this.container.addEventListener('chatOpened', () => {
      this.lastFocusedElement = document.activeElement;
      this.focusFirstElement();
    });

    // Restore focus when chat closes
    this.container.addEventListener('chatClosed', () => {
      if (this.lastFocusedElement && this.lastFocusedElement.focus) {
        this.lastFocusedElement.focus();
      }
    });

    // Focus management for new messages
    this.container.addEventListener('messageAdded', (e) => {
      if (e.detail.type === 'bot') {
        this.focusLatestMessage();
      }
    });
  }

  /**
   * Setup ARIA live regions
   */
  setupAriaLiveRegions() {
    if (!this.options.enableAriaLiveRegions) return;

    // Create live region for announcements
    this.ariaLiveRegion = document.createElement('div');
    this.ariaLiveRegion.setAttribute('aria-live', 'polite');
    this.ariaLiveRegion.setAttribute('aria-atomic', 'true');
    this.ariaLiveRegion.className = 'sr-only';
    this.ariaLiveRegion.style.cssText = `
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    `;
    
    document.body.appendChild(this.ariaLiveRegion);
  }

  /**
   * Setup screen reader support
   */
  setupScreenReaderSupport() {
    if (!this.options.enableScreenReader) return;

    // Add screen reader only text
    this.addScreenReaderText();
    
    // Setup message announcements
    if (this.options.announceMessages) {
      this.setupMessageAnnouncements();
    }

    // Add skip links
    this.addSkipLinks();
  }

  /**
   * Add screen reader only text
   */
  addScreenReaderText() {
    const srTexts = [
      { selector: '.chat-widget__fab', text: 'Botão para abrir chat. Use Alt+C como atalho.' },
      { selector: '.chat-interface__messages', text: 'Área de mensagens do chat' },
      { selector: '.chat-interface__input', text: 'Campo de texto para digitar mensagem. Pressione Enter para enviar.' }
    ];

    srTexts.forEach(({ selector, text }) => {
      const element = this.container.querySelector(selector);
      if (element) {
        const srText = document.createElement('span');
        srText.className = 'sr-only';
        srText.textContent = text;
        srText.style.cssText = `
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        `;
        element.appendChild(srText);
      }
    });
  }

  /**
   * Setup message announcements
   */
  setupMessageAnnouncements() {
    this.container.addEventListener('messageAdded', (e) => {
      const { type, content } = e.detail;
      
      if (type === 'bot') {
        this.announce(`Nova mensagem do assistente: ${content}`);
      } else if (type === 'system') {
        this.announce(`Mensagem do sistema: ${content}`);
      }
    });

    // Announce typing indicator
    this.container.addEventListener('typingStarted', () => {
      this.announce('Assistente está digitando');
    });

    this.container.addEventListener('typingStopped', () => {
      this.announce('Assistente parou de digitar');
    });
  }

  /**
   * Add skip links
   */
  addSkipLinks() {
    const skipLink = document.createElement('a');
    skipLink.href = '#chat-input';
    skipLink.textContent = 'Pular para campo de mensagem';
    skipLink.className = 'skip-link';
    skipLink.style.cssText = `
      position: absolute;
      top: -40px;
      left: 6px;
      background: #000;
      color: #fff;
      padding: 8px;
      text-decoration: none;
      z-index: 10001;
      border-radius: 4px;
    `;
    
    skipLink.addEventListener('focus', () => {
      skipLink.style.top = '6px';
    });
    
    skipLink.addEventListener('blur', () => {
      skipLink.style.top = '-40px';
    });

    this.container.insertBefore(skipLink, this.container.firstChild);
  }

  /**
   * Focus first focusable element
   */
  focusFirstElement() {
    this.updateFocusableElements();
    if (this.focusableElements.length > 0) {
      this.focusableElements[0].focus();
    }
  }

  /**
   * Focus last focusable element
   */
  focusLastElement() {
    this.updateFocusableElements();
    if (this.focusableElements.length > 0) {
      this.focusableElements[this.focusableElements.length - 1].focus();
    }
  }

  /**
   * Focus first element
   */
  focusFirst() {
    this.focusFirstElement();
  }

  /**
   * Focus last element
   */
  focusLast() {
    this.focusLastElement();
  }

  /**
   * Focus latest message
   */
  focusLatestMessage() {
    const messages = this.container.querySelectorAll('.chat-interface__message, .chat-widget__message');
    if (messages.length > 0) {
      const latestMessage = messages[messages.length - 1];
      latestMessage.setAttribute('tabindex', '0');
      latestMessage.focus();
    }
  }

  /**
   * Navigate between messages
   */
  navigateMessages(e) {
    const messages = this.container.querySelectorAll('.chat-interface__message, .chat-widget__message');
    if (messages.length === 0) return;

    // Make messages focusable
    messages.forEach((msg, index) => {
      msg.setAttribute('tabindex', '0');
      msg.setAttribute('role', 'article');
      msg.setAttribute('aria-posinset', index + 1);
      msg.setAttribute('aria-setsize', messages.length);
    });

    this.handleArrowNavigation(e);
  }

  /**
   * Announce message to screen readers
   */
  announce(message, priority = 'polite') {
    if (!this.ariaLiveRegion) return;

    this.ariaLiveRegion.setAttribute('aria-live', priority);
    this.ariaLiveRegion.textContent = message;

    // Clear after announcement
    setTimeout(() => {
      this.ariaLiveRegion.textContent = '';
    }, 1000);
  }

  /**
   * Toggle chat (for keyboard shortcut)
   */
  toggleChat() {
    const fab = this.container.querySelector('.chat-widget__fab');
    if (fab) {
      fab.click();
    }
  }

  /**
   * Close chat (for keyboard shortcut)
   */
  closeChat() {
    const closeBtn = this.container.querySelector('.chat-widget__close-btn, .chat-interface__close-btn');
    if (closeBtn) {
      closeBtn.click();
    }
  }

  /**
   * Send message (for keyboard shortcut)
   */
  sendMessage() {
    const sendBtn = this.container.querySelector('.chat-widget__send-btn, .chat-interface__send-btn');
    if (sendBtn && !sendBtn.disabled) {
      sendBtn.click();
    }
  }

  /**
   * Check if keyboard event matches shortcut
   */
  matchesShortcut(e, shortcut) {
    const parts = shortcut.toLowerCase().split('+');
    const key = parts.pop();
    
    const modifiers = {
      ctrl: e.ctrlKey,
      alt: e.altKey,
      shift: e.shiftKey,
      meta: e.metaKey
    };

    // Check if all required modifiers are pressed
    const requiredModifiers = parts.filter(part => modifiers.hasOwnProperty(part));
    const hasAllModifiers = requiredModifiers.every(mod => modifiers[mod]);
    
    // Check if no extra modifiers are pressed
    const extraModifiers = Object.keys(modifiers).filter(mod => 
      modifiers[mod] && !requiredModifiers.includes(mod)
    );
    
    return hasAllModifiers && extraModifiers.length === 0 && e.key.toLowerCase() === key;
  }

  /**
   * Update button states for screen readers
   */
  updateButtonStates() {
    // Update FAB expanded state
    const fab = this.container.querySelector('.chat-widget__fab');
    const isOpen = this.container.classList.contains('chat-widget--open');
    
    if (fab) {
      fab.setAttribute('aria-expanded', isOpen.toString());
      fab.setAttribute('aria-label', isOpen ? 'Fechar chat' : 'Abrir chat');
    }

    // Update send button state
    const sendBtn = this.container.querySelector('.chat-widget__send-btn, .chat-interface__send-btn');
    const input = this.container.querySelector('.chat-widget__input, .chat-interface__input');
    
    if (sendBtn && input) {
      const hasContent = input.value.trim().length > 0;
      sendBtn.setAttribute('aria-disabled', (!hasContent).toString());
    }
  }

  /**
   * Get accessibility stats
   */
  getStats() {
    return {
      focusableElements: this.focusableElements.length,
      hasAriaLiveRegion: !!this.ariaLiveRegion,
      keyboardNavigationEnabled: this.options.enableKeyboardNavigation,
      screenReaderEnabled: this.options.enableScreenReader,
      focusManagementEnabled: this.options.enableFocusManagement
    };
  }

  /**
   * Destroy accessibility manager
   */
  destroy() {
    // Remove event listeners
    document.removeEventListener('keydown', this.handleGlobalKeydown);
    this.container.removeEventListener('keydown', this.handleContainerKeydown);

    // Remove ARIA live region
    if (this.ariaLiveRegion) {
      this.ariaLiveRegion.remove();
    }

    // Clear references
    this.focusableElements = [];
    this.keyboardListeners.clear();
    
    console.log('AccessibilityManager destroyed');
  }
}