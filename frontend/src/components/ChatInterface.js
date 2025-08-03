/**
 * Interface de chat responsiva com layout otimizado para mobile
 * Gerencia a área de mensagens, header e input com funcionalidades avançadas
 */
import { LazyLoader } from '../utils/LazyLoader.js';
import { PerformanceOptimizer } from '../utils/PerformanceOptimizer.js';
import { AccessibilityManager } from '../utils/AccessibilityManager.js';

export class ChatInterface {
  constructor(container, config = {}) {
    this.container = container;
    this.config = {
      title: config.title || 'Assistente Virtual',
      placeholder: config.placeholder || 'Digite sua mensagem...',
      maxMessageLength: config.maxMessageLength || 4000,
      autoScroll: config.autoScroll !== false,
      showTimestamps: config.showTimestamps !== false,
      showTypingIndicator: config.showTypingIndicator !== false,
      enableMarkdown: config.enableMarkdown || false,
      enableLazyLoading: config.enableLazyLoading !== false,
      lazyLoadBatchSize: config.lazyLoadBatchSize || 20,
      maxVisibleMessages: config.maxVisibleMessages || 100,
      enableAccessibility: config.enableAccessibility !== false,
      ...config
    };

    this.messages = [];
    this.isTyping = false;
    this.isMinimized = false;
    this.messageIdCounter = 0;
    this.lazyLoader = null;
    this.performanceOptimizer = null;
    this.accessibilityManager = null;
    
    this.init();
  }

  /**
   * Inicializa a interface do chat
   */
  init() {
    this.createInterface();
    this.setupEventListeners();
    this.setupResizeObserver();
    this.setupKeyboardHandlers();
    this.setupLazyLoading();
    this.setupPerformanceOptimization();
    this.setupAccessibility();
    
    console.log('ChatInterface inicializada');
  }

  /**
   * Cria a estrutura da interface
   */
  createInterface() {
    this.container.innerHTML = this.getInterfaceHTML();
    
    // Referências aos elementos
    this.elements = {
      header: this.container.querySelector('.chat-interface__header'),
      title: this.container.querySelector('.chat-interface__title'),
      status: this.container.querySelector('.chat-interface__status'),
      minimizeBtn: this.container.querySelector('.chat-interface__minimize-btn'),
      closeBtn: this.container.querySelector('.chat-interface__close-btn'),
      messagesContainer: this.container.querySelector('.chat-interface__messages'),
      typingIndicator: this.container.querySelector('.chat-interface__typing'),
      inputArea: this.container.querySelector('.chat-interface__input-area'),
      input: this.container.querySelector('.chat-interface__input'),
      sendBtn: this.container.querySelector('.chat-interface__send-btn'),
      charCount: this.container.querySelector('.chat-interface__char-count'),
      attachBtn: this.container.querySelector('.chat-interface__attach-btn')
    };
  }

  /**
   * Retorna o HTML da interface
   */
  getInterfaceHTML() {
    return `
      <div class="chat-interface">
        <!-- Header responsivo -->
        <div class="chat-interface__header">
          <div class="chat-interface__header-content">
            <div class="chat-interface__avatar">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
            </div>
            <div class="chat-interface__header-text">
              <h3 class="chat-interface__title">${this.config.title}</h3>
              <p class="chat-interface__status">Online</p>
            </div>
          </div>
          <div class="chat-interface__header-actions">
            <button class="chat-interface__minimize-btn" aria-label="Minimizar chat">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 13H5v-2h14v2z"/>
              </svg>
            </button>
            <button class="chat-interface__close-btn" aria-label="Fechar chat">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Área de mensagens com scroll automático -->
        <div class="chat-interface__messages-wrapper">
          <div class="chat-interface__messages" role="log" aria-live="polite" aria-label="Mensagens do chat">
            <!-- Mensagens serão inseridas aqui -->
          </div>
          
          <!-- Indicador de digitação -->
          <div class="chat-interface__typing" style="display: none;" aria-label="Assistente está digitando">
            <div class="chat-interface__typing-avatar">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
            </div>
            <div class="chat-interface__typing-content">
              <div class="chat-interface__typing-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <span class="chat-interface__typing-text">Digitando...</span>
            </div>
          </div>
        </div>

        <!-- Área de input otimizada para touch -->
        <div class="chat-interface__input-area">
          <div class="chat-interface__input-container">
            <button class="chat-interface__attach-btn" aria-label="Anexar arquivo" style="display: none;">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"/>
              </svg>
            </button>
            
            <div class="chat-interface__input-wrapper">
              <textarea 
                class="chat-interface__input" 
                placeholder="${this.config.placeholder}"
                rows="1"
                maxlength="${this.config.maxMessageLength}"
                aria-label="Digite sua mensagem"
              ></textarea>
              <div class="chat-interface__input-actions">
                <button class="chat-interface__send-btn" aria-label="Enviar mensagem" disabled>
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
          
          <div class="chat-interface__input-info">
            <span class="chat-interface__char-count">0/${this.config.maxMessageLength}</span>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Configura event listeners
   */
  setupEventListeners() {
    // Botões do header
    this.elements.minimizeBtn.addEventListener('click', () => {
      this.minimize();
    });

    this.elements.closeBtn.addEventListener('click', () => {
      this.close();
    });

    // Input de mensagem
    this.elements.input.addEventListener('input', (e) => {
      this.handleInputChange(e);
    });

    this.elements.input.addEventListener('keydown', (e) => {
      this.handleKeyDown(e);
    });

    this.elements.input.addEventListener('paste', (e) => {
      this.handlePaste(e);
    });

    // Botão enviar
    this.elements.sendBtn.addEventListener('click', () => {
      this.sendMessage();
    });

    // Auto-resize do textarea
    this.elements.input.addEventListener('input', () => {
      this.autoResizeInput();
    });

    // Scroll automático quando novas mensagens chegam
    this.elements.messagesContainer.addEventListener('scroll', () => {
      this.handleScroll();
    });
  }

  /**
   * Configura observer para mudanças de tamanho
   */
  setupResizeObserver() {
    if ('ResizeObserver' in window) {
      this.resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          this.handleResize(entry);
        }
      });
      
      this.resizeObserver.observe(this.container);
    }
  }

  /**
   * Configura handlers para teclado virtual
   */
  setupKeyboardHandlers() {
    // Detecta aparecimento do teclado virtual
    if ('visualViewport' in window) {
      window.visualViewport.addEventListener('resize', () => {
        this.handleViewportChange();
      });
    }

    // Fallback para dispositivos sem visualViewport
    window.addEventListener('resize', () => {
      this.handleViewportChange();
    });
  }

  /**
   * Configura acessibilidade
   */
  setupAccessibility() {
    if (!this.config.enableAccessibility) return;

    this.accessibilityManager = new AccessibilityManager(this.container, {
      enableKeyboardNavigation: true,
      enableScreenReader: true,
      enableFocusManagement: true,
      announceMessages: true,
      keyboardShortcuts: {
        'ctrl+enter': () => this.sendMessage(),
        'escape': () => this.close()
      }
    });
  }

  /**
   * Adiciona mensagem ao chat
   */
  addMessage(message) {
    const messageId = this.generateMessageId();
    const messageData = {
      id: messageId,
      type: message.type || 'user',
      content: message.content,
      timestamp: message.timestamp || new Date().toISOString(),
      status: message.status || 'sent',
      ...message
    };

    this.messages.push(messageData);
    
    const messageElement = this.createMessageElement(messageData);
    this.elements.messagesContainer.appendChild(messageElement);
    
    if (this.config.autoScroll) {
      this.scrollToBottom();
    }

    // Emite evento de nova mensagem
    this.container.dispatchEvent(new CustomEvent('messageAdded', {
      detail: messageData
    }));

    return messageId;
  }

  /**
   * Cria elemento de mensagem
   */
  createMessageElement(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-interface__message chat-interface__message--${message.type}`;
    messageDiv.setAttribute('data-message-id', message.id);
    messageDiv.setAttribute('role', 'article');
    
    const timestamp = this.config.showTimestamps ? 
      this.formatTimestamp(message.timestamp) : '';

    // Constrói conteúdo da mensagem
    let messageContent = `
      <div class="chat-interface__message-avatar">
        ${this.getMessageAvatar(message.type)}
      </div>
      <div class="chat-interface__message-content">
        <div class="chat-interface__message-bubble">
          <div class="chat-interface__message-text">
            ${this.formatMessageContent(message.content)}
          </div>
          ${message.status ? `<div class="chat-interface__message-status">${this.getStatusIcon(message.status)}</div>` : ''}
        </div>
    `;

    // Adiciona metadados para mensagens do bot
    if (message.type === 'bot' && message.metadata) {
      messageContent += this.createMetadataSection(message.metadata);
    }

    // Adiciona informações de uso se disponível
    if (message.usage && message.usage.displayText) {
      messageContent += `
        <div class="chat-interface__message-usage">
          <span class="chat-interface__usage-text">${message.usage.displayText}</span>
        </div>
      `;
    }

    // Adiciona timestamp
    if (timestamp) {
      messageContent += `<div class="chat-interface__message-time">${timestamp}</div>`;
    }

    // Adiciona tempo de resposta se disponível
    if (message.responseTime) {
      messageContent += `
        <div class="chat-interface__message-response-time">
          <span class="chat-interface__response-time-text">Respondido em ${message.responseTime}</span>
        </div>
      `;
    }

    messageContent += '</div>';
    messageDiv.innerHTML = messageContent;

    // Adiciona classes especiais baseadas no conteúdo
    if (message.type === 'bot') {
      if (message.content && message.content.length > 500) {
        messageDiv.classList.add('chat-interface__message--long');
      }
      if (message.metadata?.model) {
        messageDiv.classList.add(`chat-interface__message--${message.metadata.model.replace(/[^a-zA-Z0-9]/g, '-')}`);
      }
    }

    // Animação de entrada
    messageDiv.style.opacity = '0';
    messageDiv.style.transform = 'translateY(10px)';
    
    requestAnimationFrame(() => {
      messageDiv.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      messageDiv.style.opacity = '1';
      messageDiv.style.transform = 'translateY(0)';
    });

    return messageDiv;
  }

  /**
   * Cria seção de metadados
   */
  createMetadataSection(metadata) {
    if (!metadata) return '';

    let metadataHtml = '<div class="chat-interface__message-metadata">';
    
    if (metadata.modelDisplayName) {
      metadataHtml += `
        <span class="chat-interface__metadata-item chat-interface__metadata-model">
          <svg viewBox="0 0 24 24" fill="currentColor" class="chat-interface__metadata-icon">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
          ${metadata.modelDisplayName}
        </span>
      `;
    }

    if (metadata.displayProcessingTime) {
      metadataHtml += `
        <span class="chat-interface__metadata-item chat-interface__metadata-time">
          <svg viewBox="0 0 24 24" fill="currentColor" class="chat-interface__metadata-icon">
            <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M12.5,7V12.25L17,14.92L16.25,16.15L11,13V7H12.5Z"/>
          </svg>
          ${metadata.displayProcessingTime}
        </span>
      `;
    }

    metadataHtml += '</div>';
    return metadataHtml;
  }

  /**
   * Retorna avatar para o tipo de mensagem
   */
  getMessageAvatar(type) {
    if (type === 'user') {
      return `
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
        </svg>
      `;
    } else {
      return `
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
      `;
    }
  }

  /**
   * Formata conteúdo da mensagem
   */
  formatMessageContent(content) {
    if (this.config.enableMarkdown) {
      // Implementação básica de markdown
      return content
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code>$1</code>')
        .replace(/\n/g, '<br>');
    }
    
    return content.replace(/\n/g, '<br>');
  }

  /**
   * Retorna ícone de status
   */
  getStatusIcon(status) {
    const icons = {
      sending: '⏳',
      sent: '✓',
      delivered: '✓✓',
      read: '✓✓',
      error: '❌'
    };
    
    return icons[status] || '';
  }

  /**
   * Formata timestamp
   */
  formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) {
      return 'Agora';
    } else if (diffMins < 60) {
      return `${diffMins}min`;
    } else if (diffMins < 1440) {
      return `${Math.floor(diffMins / 60)}h`;
    } else {
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  }

  /**
   * Envia mensagem
   */
  sendMessage() {
    const content = this.elements.input.value.trim();
    
    if (!content) return;

    // Adiciona mensagem do usuário
    const messageId = this.addMessage({
      type: 'user',
      content: content,
      status: 'sending'
    });

    // Limpa input
    this.elements.input.value = '';
    this.updateCharCount();
    this.autoResizeInput();
    this.updateSendButton();

    // Emite evento de envio
    this.container.dispatchEvent(new CustomEvent('messageSent', {
      detail: {
        messageId,
        content,
        timestamp: new Date().toISOString()
      }
    }));

    // Atualiza status da mensagem para enviada
    setTimeout(() => {
      this.updateMessageStatus(messageId, 'sent');
    }, 500);
  }

  /**
   * Atualiza status de uma mensagem
   */
  updateMessageStatus(messageId, status) {
    const messageElement = this.container.querySelector(`[data-message-id="${messageId}"]`);
    if (messageElement) {
      const statusElement = messageElement.querySelector('.chat-interface__message-status');
      if (statusElement) {
        statusElement.innerHTML = this.getStatusIcon(status);
      }
    }

    // Atualiza no array de mensagens
    const message = this.messages.find(m => m.id === messageId);
    if (message) {
      message.status = status;
    }
  }

  /**
   * Mostra indicador de digitação
   */
  showTypingIndicator() {
    if (!this.config.showTypingIndicator) return;
    
    this.isTyping = true;
    this.elements.typingIndicator.style.display = 'flex';
    
    // Emite evento para acessibilidade
    this.container.dispatchEvent(new CustomEvent('typingStarted'));
    
    if (this.config.autoScroll) {
      this.scrollToBottom();
    }
  }

  /**
   * Esconde indicador de digitação
   */
  hideTypingIndicator() {
    this.isTyping = false;
    this.elements.typingIndicator.style.display = 'none';
    
    // Emite evento para acessibilidade
    this.container.dispatchEvent(new CustomEvent('typingStopped'));
  }

  /**
   * Trata mudanças no input
   */
  handleInputChange(e) {
    this.updateCharCount();
    this.updateSendButton();
    this.autoResizeInput();

    // Emite evento de digitação
    this.container.dispatchEvent(new CustomEvent('userTyping', {
      detail: {
        content: e.target.value,
        length: e.target.value.length
      }
    }));
  }

  /**
   * Trata teclas pressionadas
   */
  handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.sendMessage();
    } else if (e.key === 'Escape') {
      this.elements.input.blur();
    }
  }

  /**
   * Trata colagem de texto
   */
  handlePaste(e) {
    // Permite colagem normal, mas verifica limite de caracteres
    setTimeout(() => {
      const content = this.elements.input.value;
      if (content.length > this.config.maxMessageLength) {
        this.elements.input.value = content.substring(0, this.config.maxMessageLength);
        this.updateCharCount();
      }
    }, 0);
  }

  /**
   * Auto-resize do input
   */
  autoResizeInput() {
    const input = this.elements.input;
    input.style.height = 'auto';
    
    const maxHeight = 120; // ~5 linhas
    const newHeight = Math.min(input.scrollHeight, maxHeight);
    input.style.height = newHeight + 'px';

    // Ajusta scroll se necessário
    if (input.scrollHeight > maxHeight) {
      input.style.overflowY = 'auto';
    } else {
      input.style.overflowY = 'hidden';
    }
  }

  /**
   * Atualiza contador de caracteres
   */
  updateCharCount() {
    const length = this.elements.input.value.length;
    const max = this.config.maxMessageLength;
    
    this.elements.charCount.textContent = `${length}/${max}`;
    this.elements.charCount.classList.toggle('chat-interface__char-count--warning', length > max * 0.9);
    this.elements.charCount.classList.toggle('chat-interface__char-count--error', length >= max);
  }

  /**
   * Atualiza estado do botão enviar
   */
  updateSendButton() {
    const hasContent = this.elements.input.value.trim().length > 0;
    const isValid = this.elements.input.value.length <= this.config.maxMessageLength;
    
    this.elements.sendBtn.disabled = !hasContent || !isValid;
    this.elements.sendBtn.classList.toggle('chat-interface__send-btn--active', hasContent && isValid);
  }

  /**
   * Rola para o final das mensagens
   */
  scrollToBottom(smooth = true) {
    const container = this.elements.messagesContainer;
    const scrollOptions = {
      top: container.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto'
    };
    
    container.scrollTo(scrollOptions);
  }

  /**
   * Trata scroll manual
   */
  handleScroll() {
    const container = this.elements.messagesContainer;
    const isAtBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 10;
    
    // Desabilita auto-scroll se usuário rolou para cima
    if (!isAtBottom && this.config.autoScroll) {
      this.config.autoScroll = false;
      // Reabilita após 5 segundos
      clearTimeout(this.autoScrollTimeout);
      this.autoScrollTimeout = setTimeout(() => {
        this.config.autoScroll = true;
      }, 5000);
    }
  }

  /**
   * Trata redimensionamento
   */
  handleResize(entry) {
    // Ajusta layout baseado no tamanho
    const width = entry.contentRect.width;
    
    this.container.classList.toggle('chat-interface--compact', width < 300);
    this.container.classList.toggle('chat-interface--mobile', width < 480);
  }

  /**
   * Trata mudanças no viewport (teclado virtual)
   */
  handleViewportChange() {
    if ('visualViewport' in window) {
      const viewport = window.visualViewport;
      const isKeyboardOpen = viewport.height < window.screen.height * 0.75;
      
      this.container.classList.toggle('chat-interface--keyboard-open', isKeyboardOpen);
      
      if (isKeyboardOpen && this.config.autoScroll) {
        setTimeout(() => this.scrollToBottom(false), 100);
      }
    }
  }

  /**
   * Minimiza a interface
   */
  minimize() {
    this.isMinimized = true;
    this.container.classList.add('chat-interface--minimized');
    
    this.container.dispatchEvent(new CustomEvent('interfaceMinimized'));
  }

  /**
   * Restaura a interface
   */
  restore() {
    this.isMinimized = false;
    this.container.classList.remove('chat-interface--minimized');
    
    this.container.dispatchEvent(new CustomEvent('interfaceRestored'));
  }

  /**
   * Fecha a interface
   */
  close() {
    this.container.dispatchEvent(new CustomEvent('interfaceClosed'));
  }

  /**
   * Atualiza status da conexão
   */
  updateConnectionStatus(status, message) {
    this.elements.status.textContent = message || status;
    this.elements.status.className = `chat-interface__status chat-interface__status--${status}`;
  }

  /**
   * Limpa todas as mensagens
   */
  clearMessages() {
    this.messages = [];
    this.elements.messagesContainer.innerHTML = '';
    
    this.container.dispatchEvent(new CustomEvent('messagesCleared'));
  }

  /**
   * Gera ID único para mensagem
   */
  generateMessageId() {
    return `msg_${Date.now()}_${++this.messageIdCounter}`;
  }

  /**
   * Foca no input
   */
  focusInput() {
    this.elements.input.focus();
  }

  /**
   * Retorna estatísticas da interface
   */
  getStats() {
    return {
      messageCount: this.messages.length,
      isTyping: this.isTyping,
      isMinimized: this.isMinimized,
      autoScroll: this.config.autoScroll
    };
  }

  /**
   * Configura lazy loading para mensagens
   */
  setupLazyLoading() {
    if (!this.config.enableLazyLoading) return;

    const messagesContainer = this.elements.messagesContainer;
    if (!messagesContainer) return;

    this.lazyLoader = new LazyLoader(messagesContainer, {
      itemHeight: 80, // Altura estimada de uma mensagem
      bufferSize: 5,
      batchSize: this.config.lazyLoadBatchSize,
      enableVirtualScrolling: this.messages.length > 50
    });

    // Listener para carregar mais mensagens
    messagesContainer.addEventListener('loadMore', (e) => {
      this.loadMoreMessages(e.detail.batchSize);
    });
  }

  /**
   * Configura otimização de performance
   */
  setupPerformanceOptimization() {
    this.performanceOptimizer = new PerformanceOptimizer({
      enableMemoryMonitoring: true,
      enableFPSMonitoring: false,
      debounceDelay: 16
    });

    // Debounce input handling para melhor performance
    this.debouncedInputHandler = this.performanceOptimizer.debounce(
      this.handleInputChange.bind(this), 
      16
    );

    // Throttle scroll handling
    this.throttledScrollHandler = this.performanceOptimizer.throttle(
      this.handleScroll.bind(this), 
      16
    );
  }

  /**
   * Carrega mais mensagens (implementação placeholder)
   */
  async loadMoreMessages(batchSize) {
    // Esta função seria implementada para carregar mensagens antigas
    // Por enquanto, é um placeholder
    console.log(`Carregando ${batchSize} mensagens antigas...`);
    
    // Simula carregamento
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Emite evento de mensagens carregadas
    this.container.dispatchEvent(new CustomEvent('messagesLoaded', {
      detail: { count: 0, hasMore: false }
    }));
  }

  /**
   * Adiciona mensagem com otimização de performance
   */
  addMessageOptimized(message) {
    // Limita número de mensagens visíveis para performance
    if (this.messages.length > this.config.maxVisibleMessages) {
      this.removeOldMessages();
    }

    // Usa lazy loader se disponível
    if (this.lazyLoader) {
      this.lazyLoader.addItems([message]);
    } else {
      this.addMessage(message);
    }
  }

  /**
   * Remove mensagens antigas para economizar memória
   */
  removeOldMessages() {
    const messagesToRemove = this.messages.length - this.config.maxVisibleMessages + 10;
    
    if (messagesToRemove > 0) {
      // Remove mensagens do array
      this.messages.splice(0, messagesToRemove);
      
      // Remove elementos DOM
      const messageElements = this.elements.messagesContainer.querySelectorAll('.chat-interface__message');
      for (let i = 0; i < messagesToRemove && i < messageElements.length; i++) {
        messageElements[i].remove();
      }
      
      console.log(`Removidas ${messagesToRemove} mensagens antigas para otimização`);
    }
  }

  /**
   * Override do handleInputChange para usar versão otimizada
   */
  handleInputChange(e) {
    // Usa versão debounced se disponível
    if (this.debouncedInputHandler) {
      this.debouncedInputHandler(e);
      return;
    }

    // Fallback para versão original
    this.updateCharCount();
    this.updateSendButton();
    this.autoResizeInput();

    // Emite evento de digitação
    this.container.dispatchEvent(new CustomEvent('userTyping', {
      detail: {
        content: e.target.value,
        length: e.target.value.length
      }
    }));
  }

  /**
   * Override do handleScroll para usar versão otimizada
   */
  handleScroll() {
    // Usa versão throttled se disponível
    if (this.throttledScrollHandler) {
      this.throttledScrollHandler();
      return;
    }

    // Fallback para versão original
    const container = this.elements.messagesContainer;
    const isAtBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 10;
    
    // Desabilita auto-scroll se usuário rolou para cima
    if (!isAtBottom && this.config.autoScroll) {
      this.config.autoScroll = false;
      // Reabilita após 5 segundos
      clearTimeout(this.autoScrollTimeout);
      this.autoScrollTimeout = setTimeout(() => {
        this.config.autoScroll = true;
      }, 5000);
    }
  }

  /**
   * Destrói a interface
   */
  destroy() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    
    if (this.lazyLoader) {
      this.lazyLoader.destroy();
    }
    
    if (this.performanceOptimizer) {
      this.performanceOptimizer.destroy();
    }
    
    if (this.accessibilityManager) {
      this.accessibilityManager.destroy();
    }
    
    clearTimeout(this.autoScrollTimeout);
    
    this.container.innerHTML = '';
    console.log('ChatInterface destruída');
  }
}