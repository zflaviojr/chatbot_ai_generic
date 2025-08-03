/**
 * Widget de chat responsivo com ícone flutuante
 * Implementa design mobile-first com animações suaves e otimizações para mobile
 */
// Importações comentadas temporariamente para debug
// import { TouchGestureHandler } from '../utils/TouchGestureHandler.js';
// import { PerformanceOptimizer } from '../utils/PerformanceOptimizer.js';
// import { AccessibilityManager } from '../utils/AccessibilityManager.js';
// import analytics from '../utils/Analytics.js';

export class ChatWidget {
  constructor(containerId, config = {}) {
    this.containerId = containerId;
    this.config = {
      websocketUrl: config.websocketUrl || 'ws://localhost:3001/ws',
      position: config.position || 'bottom-right',
      theme: config.theme || 'light',
      showWelcomeMessage: config.showWelcomeMessage !== false,
      welcomeMessage: config.welcomeMessage || 'Olá! Como posso ajudar você hoje?',
      placeholder: config.placeholder || 'Digite sua mensagem...',
      title: config.title || 'Assistente Virtual',
      enableTouchGestures: config.enableTouchGestures !== false,
      enablePerformanceOptimization: config.enablePerformanceOptimization !== false,
      enableAccessibility: config.enableAccessibility !== false,
      ...config
    };

    this.isOpen = false;
    this.isMinimized = false;
    this.container = null;
    this.chatInterface = null;
    // Utilitários comentados para debug
    // this.touchGestureHandler = null;
    // this.performanceOptimizer = null;
    // this.accessibilityManager = null;
    
    this.init();
  }

  /**
   * Inicializa o widget
   */
  init() {
    this.createContainer();
    this.createFloatingButton();
    this.setupEventListeners();
    this.setupResponsiveHandlers();
    // this.setupMobileOptimizations(); // Comentado para debug
    
    console.log('ChatWidget inicializado');
  }

  /**
   * Cria o container principal do widget
   */
  createContainer() {
    let targetElement;
    
    // Verificando tipo do container
    
    // Aceita tanto ID quanto elemento DOM
    if (typeof this.containerId === 'string') {
      targetElement = document.getElementById(this.containerId);
      if (!targetElement) {
        throw new Error(`Elemento com ID '${this.containerId}' não encontrado`);
      }
    } else if (this.containerId && this.containerId.nodeType === Node.ELEMENT_NODE) {
      targetElement = this.containerId;
    } else {
      throw new Error('containerId deve ser um ID válido ou elemento DOM');
    }

    this.container = document.createElement('div');
    this.container.className = `chat-widget chat-widget--${this.config.position} chat-widget--${this.config.theme}`;
    this.container.innerHTML = this.getWidgetHTML();
    
    targetElement.appendChild(this.container);
  }

  /**
   * Retorna o HTML do widget
   */
  getWidgetHTML() {
    return `
      <!-- Botão flutuante -->
      <div class="chat-widget__fab" id="chat-fab">
        <div class="chat-widget__fab-icon">
          <svg class="chat-widget__fab-icon-chat" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4l4 4 4-4h4c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
          </svg>
          <svg class="chat-widget__fab-icon-close" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </div>
        <div class="chat-widget__fab-badge" id="chat-badge" style="display: none;">
          <span id="chat-badge-count">1</span>
        </div>
      </div>

      <!-- Interface do chat -->
      <div class="chat-widget__interface" id="chat-interface">
        <div class="chat-widget__header">
          <div class="chat-widget__header-info">
            <div class="chat-widget__avatar">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
            </div>
            <div class="chat-widget__header-text">
              <h3 class="chat-widget__title">${this.config.title}</h3>
              <p class="chat-widget__status" id="chat-status">Online</p>
            </div>
          </div>
          <div class="chat-widget__header-actions">
            <button class="chat-widget__minimize-btn" id="minimize-btn" aria-label="Minimizar">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 13H5v-2h14v2z"/>
              </svg>
            </button>
            <button class="chat-widget__close-btn" id="close-btn" aria-label="Fechar">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
          </div>
        </div>

        <div class="chat-widget__messages" id="chat-messages">
          <!-- Mensagens serão inseridas aqui -->
        </div>

        <div class="chat-widget__typing" id="typing-indicator" style="display: none;">
          <div class="chat-widget__typing-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
          <span class="chat-widget__typing-text">Digitando...</span>
        </div>

        <div class="chat-widget__input-area">
          <div class="chat-widget__input-container">
            <textarea 
              class="chat-widget__input" 
              id="chat-input" 
              placeholder="${this.config.placeholder}"
              rows="1"
              maxlength="4000"
            ></textarea>
            <button class="chat-widget__send-btn" id="send-btn" aria-label="Enviar mensagem">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
              </svg>
            </button>
          </div>
          <div class="chat-widget__input-info">
            <span class="chat-widget__char-count" id="char-count">0/4000</span>
          </div>
        </div>

        <div class="chat-widget__session-controls">
          <button class="chat-widget__session-btn" id="end-session-btn" title="Finalizar Atendimento">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M16 17v2H2v-2s0-4 7-4 7 4 7 4m-3.5-9.5A3.5 3.5 0 1 0 9 11a3.5 3.5 0 0 0 3.5-3.5z"/>
            </svg>
            Finalizar
          </button>
          <button class="chat-widget__session-btn" id="new-session-btn" title="Novo Atendimento">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
            </svg>
            Novo
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Cria o botão flutuante
   */
  createFloatingButton() {
    // O botão já é criado no HTML, apenas configuramos os eventos
    this.fabButton = this.container.querySelector('#chat-fab');
    this.badge = this.container.querySelector('#chat-badge');
  }

  /**
   * Configura os event listeners
   */
  setupEventListeners() {
    // Botão flutuante
    this.fabButton.addEventListener('click', () => {
      this.toggle();
    });

    // Botões do header
    const closeBtn = this.container.querySelector('#close-btn');
    const minimizeBtn = this.container.querySelector('#minimize-btn');
    
    closeBtn.addEventListener('click', () => {
      this.close();
    });

    minimizeBtn.addEventListener('click', () => {
      this.minimize();
    });

    // Input de mensagem
    const chatInput = this.container.querySelector('#chat-input');
    const sendBtn = this.container.querySelector('#send-btn');
    const charCount = this.container.querySelector('#char-count');

    chatInput.addEventListener('input', (e) => {
      this.handleInputChange(e);
      this.updateCharCount();
    });

    chatInput.addEventListener('keydown', (e) => {
      this.handleKeyDown(e);
    });

    sendBtn.addEventListener('click', () => {
      console.log('ChatWidget: Botão de enviar clicado');
      this.sendMessage();
    });

    // Botões de controle de sessão
    const endSessionBtn = this.container.querySelector('#end-session-btn');
    const newSessionBtn = this.container.querySelector('#new-session-btn');

    if (endSessionBtn) {
      endSessionBtn.addEventListener('click', (e) => {
        console.log('ChatWidget: Botão Finalizar clicado');
        e.preventDefault();
        this.endSession();
      });
      console.log('ChatWidget: Event listener do botão Finalizar configurado');
    } else {
      console.error('ChatWidget: Botão #end-session-btn não encontrado');
    }

    if (newSessionBtn) {
      newSessionBtn.addEventListener('click', (e) => {
        console.log('ChatWidget: Botão Novo clicado');
        e.preventDefault();
        this.startNewSession();
      });
      console.log('ChatWidget: Event listener do botão Novo configurado');
    } else {
      console.error('ChatWidget: Botão #new-session-btn não encontrado');
    }

    // Auto-resize do textarea
    chatInput.addEventListener('input', () => {
      this.autoResizeTextarea(chatInput);
    });

    // Clique fora para fechar (apenas em desktop)
    document.addEventListener('click', (e) => {
      if (window.innerWidth > 768 && this.isOpen && !this.container.contains(e.target)) {
        this.close();
      }
    });
  }

  /**
   * Configura handlers responsivos
   */
  setupResponsiveHandlers() {
    // Listener para mudanças de orientação e resize
    window.addEventListener('resize', () => {
      this.handleResize();
    });

    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        this.handleResize();
      }, 100);
    });

    // Detecta aparecimento do teclado virtual
    if ('visualViewport' in window) {
      window.visualViewport.addEventListener('resize', () => {
        this.handleViewportChange();
      });
    }
  }

  /**
   * Abre o widget
   */
  open() {
    if (this.isOpen) return;

    this.isOpen = true;
    this.isMinimized = false;
    this.container.classList.add('chat-widget--open');
    this.container.classList.remove('chat-widget--minimized');
    
    // Track widget interaction (comentado para debug)
    // analytics.trackWidgetInteraction('open', {
    //   timestamp: Date.now(),
    //   viewport: {
    //     width: window.innerWidth,
    //     height: window.innerHeight
    //   }
    // });
    
    // Emite evento para acessibilidade
    this.container.dispatchEvent(new CustomEvent('chatOpened'));
    
    // Foca no input após a animação
    setTimeout(() => {
      const input = this.container.querySelector('#chat-input');
      if (input && window.innerWidth > 768) {
        input.focus();
      }
    }, 300);

    // Mostra mensagem de boas-vindas se configurado
    if (this.config.showWelcomeMessage && !this.hasWelcomeMessage) {
      this.showWelcomeMessage();
      this.hasWelcomeMessage = true;
    }

    this.hideBadge();
    console.log('Chat widget aberto');
  }

  /**
   * Fecha o widget
   */
  close() {
    if (!this.isOpen) return;

    this.isOpen = false;
    this.isMinimized = false;
    this.container.classList.remove('chat-widget--open', 'chat-widget--minimized');
    
    // Track widget interaction (comentado para debug)
    // analytics.trackWidgetInteraction('close', {
    //   timestamp: Date.now(),
    //   sessionDuration: Date.now() - (this.openTime || Date.now())
    // });
    
    // Emite evento para acessibilidade
    this.container.dispatchEvent(new CustomEvent('chatClosed'));
    
    console.log('Chat widget fechado');
  }

  /**
   * Minimiza o widget
   */
  minimize() {
    if (!this.isOpen) return;

    this.isMinimized = true;
    
    // Track widget interaction (comentado para debug)
    // analytics.trackWidgetInteraction('minimize', {
    //   timestamp: Date.now()
    // });
    this.container.classList.add('chat-widget--minimized');
    
    console.log('Chat widget minimizado');
  }

  /**
   * Alterna entre aberto/fechado
   */
  toggle() {
    if (this.isOpen) {
      if (this.isMinimized) {
        this.minimize();
      } else {
        this.close();
      }
    } else {
      this.open();
    }
  }

  /**
   * Mostra mensagem de boas-vindas
   */
  showWelcomeMessage() {
    this.addMessage({
      type: 'bot',
      content: this.config.welcomeMessage,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Adiciona mensagem ao chat
   */
  addMessage(message) {
    const messagesContainer = this.container.querySelector('#chat-messages');
    const messageElement = this.createMessageElement(message);
    
    messagesContainer.appendChild(messageElement);
    this.scrollToBottom();
  }

  /**
   * Cria elemento de mensagem
   */
  createMessageElement(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-widget__message chat-widget__message--${message.type}`;
    
    const time = new Date(message.timestamp).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });

    messageDiv.innerHTML = `
      <div class="chat-widget__message-content">
        ${message.content}
      </div>
      <div class="chat-widget__message-time">${time}</div>
    `;

    return messageDiv;
  }

  /**
   * Envia mensagem
   */
  sendMessage() {
    console.log('ChatWidget: sendMessage() chamado');
    const input = this.container.querySelector('#chat-input');
    const message = input.value.trim();
    console.log('ChatWidget: Mensagem capturada:', message);
    
    if (!message) {
      console.log('ChatWidget: Mensagem vazia, retornando');
      return;
    }

    // Adiciona mensagem do usuário
    this.addMessage({
      type: 'user',
      content: message,
      timestamp: new Date().toISOString()
    });

    // Limpa input
    input.value = '';
    this.updateCharCount();
    this.autoResizeTextarea(input);

    // Mostra indicador de digitação
    this.showTypingIndicator();

    // Emite evento para ser capturado pelo MessageHandler
    console.log('ChatWidget: Disparando evento chatMessage com:', message);
    this.container.dispatchEvent(new CustomEvent('chatMessage', {
      detail: { message },
      bubbles: true // Permite que o evento faça bubble up
    }));
    console.log('ChatWidget: Evento chatMessage disparado');
  }

  /**
   * Mostra indicador de digitação
   */
  showTypingIndicator() {
    const indicator = this.container.querySelector('#typing-indicator');
    indicator.style.display = 'flex';
    this.scrollToBottom();
  }

  /**
   * Esconde indicador de digitação
   */
  hideTypingIndicator() {
    const indicator = this.container.querySelector('#typing-indicator');
    indicator.style.display = 'none';
  }

  /**
   * Atualiza contador de caracteres
   */
  updateCharCount() {
    const input = this.container.querySelector('#chat-input');
    const charCount = this.container.querySelector('#char-count');
    const count = input.value.length;
    
    charCount.textContent = `${count}/4000`;
    charCount.classList.toggle('chat-widget__char-count--warning', count > 3500);
  }

  /**
   * Auto-resize do textarea
   */
  autoResizeTextarea(textarea) {
    textarea.style.height = 'auto';
    const maxHeight = 120; // Máximo 5 linhas aproximadamente
    const newHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = newHeight + 'px';
  }

  /**
   * Trata mudanças no input
   */
  handleInputChange(e) {
    const sendBtn = this.container.querySelector('#send-btn');
    sendBtn.classList.toggle('chat-widget__send-btn--active', e.target.value.trim().length > 0);
  }

  /**
   * Trata teclas pressionadas
   */
  handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.sendMessage();
    }
  }

  /**
   * Rola para o final das mensagens
   */
  scrollToBottom() {
    const messagesContainer = this.container.querySelector('#chat-messages');
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  /**
   * Trata redimensionamento da janela
   */
  handleResize() {
    // Ajusta posicionamento em telas pequenas
    if (window.innerWidth <= 768) {
      this.container.classList.add('chat-widget--mobile');
    } else {
      this.container.classList.remove('chat-widget--mobile');
    }
  }

  /**
   * Trata mudanças no viewport (teclado virtual)
   */
  handleViewportChange() {
    if (this.isOpen && window.innerWidth <= 768) {
      const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      const isKeyboardOpen = viewportHeight < window.screen.height * 0.75;
      
      this.container.classList.toggle('chat-widget--keyboard-open', isKeyboardOpen);
    }
  }

  /**
   * Mostra badge com contador
   */
  showBadge(count = 1) {
    const badge = this.container.querySelector('#chat-badge');
    const badgeCount = this.container.querySelector('#chat-badge-count');
    
    badgeCount.textContent = count;
    badge.style.display = 'block';
  }

  /**
   * Esconde badge
   */
  hideBadge() {
    const badge = this.container.querySelector('#chat-badge');
    badge.style.display = 'none';
  }

  /**
   * Finaliza a sessão atual
   */
  endSession() {
    console.log('ChatWidget: Finalizando sessão - método chamado');
    
    // Adiciona mensagem do sistema
    this.addMessage({
      type: 'system',
      content: 'Finalizando atendimento...',
      timestamp: new Date().toISOString()
    });

    // Envia comando para finalizar sessão
    console.log('ChatWidget: Disparando evento sessionEnd');
    const event = new CustomEvent('sessionEnd', {
      detail: { action: 'end' },
      bubbles: true
    });
    this.container.dispatchEvent(event);
    console.log('ChatWidget: Evento sessionEnd disparado');
  }

  /**
   * Inicia nova sessão
   */
  startNewSession() {
    console.log('ChatWidget: Iniciando nova sessão - método chamado');
    
    // Limpa mensagens
    const messagesContainer = this.container.querySelector('#chat-messages');
    messagesContainer.innerHTML = '';
    
    // Adiciona mensagem do sistema
    this.addMessage({
      type: 'system',
      content: 'Iniciando novo atendimento...',
      timestamp: new Date().toISOString()
    });

    // Envia comando para nova sessão
    console.log('ChatWidget: Disparando evento sessionReset');
    const event = new CustomEvent('sessionReset', {
      detail: { action: 'reset' },
      bubbles: true
    });
    this.container.dispatchEvent(event);
    console.log('ChatWidget: Evento sessionReset disparado');

    // Mostra mensagem de boas-vindas
    setTimeout(() => {
      if (this.config.showWelcomeMessage) {
        this.showWelcomeMessage();
      }
    }, 500);
  }

  /**
   * Atualiza informações da sessão
   */
  updateSessionInfo(sessionInfo) {
    console.log('ChatWidget: Atualizando informações da sessão:', sessionInfo);
    
    // Atualiza título se houver nome do cliente
    if (sessionInfo.context && sessionInfo.context.customerName) {
      const titleElement = this.container.querySelector('.chat-widget__title');
      titleElement.textContent = `${this.config.title} - ${sessionInfo.context.customerName}`;
    }

    // Atualiza status baseado no estágio
    if (sessionInfo.context && sessionInfo.context.stage) {
      const stageMessages = {
        greeting: 'Iniciando atendimento',
        information_gathering: 'Coletando informações',
        service_discussion: 'Discutindo serviços',
        closing: 'Finalizando atendimento'
      };
      
      const statusMessage = stageMessages[sessionInfo.context.stage] || 'Online';
      this.updateStatus('connected', statusMessage);
    }
  }

  /**
   * Atualiza status da conexão
   */
  updateStatus(status, message) {
    const statusElement = this.container.querySelector('#chat-status');
    statusElement.textContent = message || status;
    statusElement.className = `chat-widget__status chat-widget__status--${status}`;
    
    // Emite evento para acessibilidade
    this.container.dispatchEvent(new CustomEvent('statusChanged', {
      detail: { status: message || status }
    }));
  }

  /**
   * Configura otimizações para mobile
   */
  setupMobileOptimizations() {
    // Inicializa otimizador de performance
    if (this.config.enablePerformanceOptimization) {
      this.performanceOptimizer = new PerformanceOptimizer({
        enableMemoryMonitoring: true,
        enableFPSMonitoring: false, // Desabilitado por padrão para economizar recursos
        memoryThreshold: 70
      });

      // Aplica otimizações para dispositivos low-end
      if (this.performanceOptimizer.isLowEndDevice()) {
        this.applyLowEndOptimizations();
      }
    }

    // Inicializa handler de gestos touch
    if (this.config.enableTouchGestures && 'ontouchstart' in window) {
      this.touchGestureHandler = new TouchGestureHandler(this.container, {
        enableSwipeToClose: true,
        swipeThreshold: 50
      });

      this.setupTouchGestureListeners();
    }

    // Otimiza imagens para mobile
    this.optimizeForMobile();

    // Inicializa gerenciador de acessibilidade
    if (this.config.enableAccessibility) {
      this.accessibilityManager = new AccessibilityManager(this.container, {
        enableKeyboardNavigation: true,
        enableScreenReader: true,
        enableFocusManagement: true,
        announceMessages: true,
        keyboardShortcuts: {
          'alt+c': () => this.toggle(),
          'escape': () => this.close()
        }
      });

      this.setupAccessibilityListeners();
    }
  }

  /**
   * Configura listeners para gestos touch
   */
  setupTouchGestureListeners() {
    if (!this.touchGestureHandler) return;

    // Swipe para fechar
    this.container.addEventListener('gestureSwipe', (e) => {
      const { direction } = e.detail;
      if ((direction === 'down' || direction === 'right') && this.isOpen) {
        this.close();
      }
    });

    // Tap no FAB
    this.container.addEventListener('gestureTap', (e) => {
      if (e.target.closest('.chat-widget__fab')) {
        this.toggle();
      }
    });
  }

  /**
   * Aplica otimizações para dispositivos low-end
   */
  applyLowEndOptimizations() {
    // Reduz animações
    this.container.classList.add('chat-widget--low-end');
    
    // Aumenta delays de debounce
    this.config.debounceDelay = 32; // Reduz para 30fps
    
    // Desabilita animações não essenciais
    this.config.enableAnimations = false;
    
    console.log('Aplicadas otimizações para dispositivo low-end');
  }

  /**
   * Otimiza para mobile
   */
  optimizeForMobile() {
    if (window.innerWidth <= 768) {
      // Otimiza imagens se houver
      if (this.performanceOptimizer) {
        this.performanceOptimizer.optimizeImages(this.container);
      }

      // Adiciona classe mobile
      this.container.classList.add('chat-widget--mobile-optimized');
      
      // Preload recursos críticos para mobile
      this.preloadMobileResources();
    }
  }

  /**
   * Preload recursos críticos para mobile
   */
  preloadMobileResources() {
    if (this.performanceOptimizer) {
      this.performanceOptimizer.preloadCriticalResources([
        { url: '/src/components/ChatInterface.js', type: 'script' },
        { url: '/src/components/MessageHandler.js', type: 'script' }
      ]);
    }
  }

  /**
   * Configura listeners para acessibilidade
   */
  setupAccessibilityListeners() {
    if (!this.accessibilityManager) return;

    // Atualiza estados dos botões quando widget abre/fecha
    this.container.addEventListener('chatOpened', () => {
      this.accessibilityManager.updateButtonStates();
    });

    this.container.addEventListener('chatClosed', () => {
      this.accessibilityManager.updateButtonStates();
    });

    // Anuncia mudanças de status
    this.container.addEventListener('statusChanged', (e) => {
      this.accessibilityManager.announce(`Status: ${e.detail.status}`);
    });
  }

  /**
   * Destrói o widget
   */
  destroy() {
    // Cleanup mobile optimizations
    if (this.touchGestureHandler) {
      this.touchGestureHandler.destroy();
    }
    
    if (this.performanceOptimizer) {
      this.performanceOptimizer.destroy();
    }
    
    if (this.accessibilityManager) {
      this.accessibilityManager.destroy();
    }

    if (this.container) {
      this.container.remove();
    }
    console.log('ChatWidget destruído');
  }
}