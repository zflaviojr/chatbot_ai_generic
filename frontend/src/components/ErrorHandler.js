/**
 * Sistema de tratamento de erros para o chatbot
 * Gerencia detecção, notificação e recuperação de erros
 */
export class ErrorHandler {
  constructor(config = {}) {
    this.config = {
      enableLogging: config.enableLogging !== false,
      enableUserNotifications: config.enableUserNotifications !== false,
      enableRetry: config.enableRetry !== false,
      maxRetryAttempts: config.maxRetryAttempts || 3,
      retryDelay: config.retryDelay || 2000,
      offlineDetection: config.offlineDetection !== false,
      ...config
    };

    this.errorHistory = [];
    this.retryQueue = new Map();
    this.isOnline = navigator.onLine;
    this.eventListeners = new Map();

    this.init();
  }

  /**
   * Inicializa o sistema de tratamento de erros
   */
  init() {
    this.setupGlobalErrorHandlers();
    this.setupNetworkDetection();
    this.setupUnhandledPromiseRejection();
    
    this.log('ErrorHandler inicializado');
  }

  /**
   * Configura handlers globais de erro
   */
  setupGlobalErrorHandlers() {
    // Captura erros JavaScript não tratados
    window.addEventListener('error', (event) => {
      this.handleGlobalError({
        type: 'javascript',
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error,
        stack: event.error?.stack
      });
    });

    // Captura erros de recursos (imagens, scripts, etc.)
    window.addEventListener('error', (event) => {
      if (event.target !== window) {
        this.handleResourceError({
          type: 'resource',
          element: event.target.tagName,
          source: event.target.src || event.target.href,
          message: `Falha ao carregar recurso: ${event.target.tagName}`
        });
      }
    }, true);
  }

  /**
   * Configura detecção de rede
   */
  setupNetworkDetection() {
    if (!this.config.offlineDetection) return;

    window.addEventListener('online', () => {
      this.handleNetworkChange(true);
    });

    window.addEventListener('offline', () => {
      this.handleNetworkChange(false);
    });

    // Verifica conectividade periodicamente
    setInterval(() => {
      this.checkConnectivity();
    }, 30000); // A cada 30 segundos
  }

  /**
   * Configura captura de promises rejeitadas
   */
  setupUnhandledPromiseRejection() {
    window.addEventListener('unhandledrejection', (event) => {
      this.handlePromiseRejection({
        type: 'promise',
        reason: event.reason,
        message: event.reason?.message || 'Promise rejeitada',
        stack: event.reason?.stack
      });
    });
  }

  /**
   * Trata erro global JavaScript
   */
  handleGlobalError(errorInfo) {
    const error = {
      id: this.generateErrorId(),
      timestamp: new Date().toISOString(),
      category: 'global',
      severity: 'high',
      ...errorInfo,
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    this.recordError(error);
    this.notifyError(error);

    this.log('Erro global capturado:', error);
  }

  /**
   * Trata erro de recurso
   */
  handleResourceError(errorInfo) {
    const error = {
      id: this.generateErrorId(),
      timestamp: new Date().toISOString(),
      category: 'resource',
      severity: 'medium',
      ...errorInfo,
      retryable: true
    };

    this.recordError(error);
    
    // Tenta recarregar recurso automaticamente
    if (this.config.enableRetry) {
      this.scheduleRetry(error, () => {
        this.retryResourceLoad(errorInfo);
      });
    }

    this.log('Erro de recurso capturado:', error);
  }

  /**
   * Trata promise rejeitada
   */
  handlePromiseRejection(errorInfo) {
    const error = {
      id: this.generateErrorId(),
      timestamp: new Date().toISOString(),
      category: 'promise',
      severity: 'medium',
      ...errorInfo
    };

    this.recordError(error);
    this.log('Promise rejeitada capturada:', error);
  }

  /**
   * Trata erro de conexão WebSocket
   */
  handleConnectionError(errorInfo) {
    const error = {
      id: this.generateErrorId(),
      timestamp: new Date().toISOString(),
      category: 'connection',
      severity: 'high',
      retryable: true,
      ...errorInfo
    };

    this.recordError(error);
    this.notifyConnectionError(error);

    // Agenda retry automático para conexões
    if (this.config.enableRetry && error.retryable) {
      this.scheduleRetry(error, errorInfo.retryCallback);
    }

    this.emit('connectionError', error);
    this.log('Erro de conexão:', error);
  }

  /**
   * Trata erro de mensagem
   */
  handleMessageError(errorInfo) {
    const error = {
      id: this.generateErrorId(),
      timestamp: new Date().toISOString(),
      category: 'message',
      severity: 'medium',
      retryable: true,
      ...errorInfo
    };

    this.recordError(error);
    this.notifyMessageError(error);

    this.emit('messageError', error);
    this.log('Erro de mensagem:', error);
  }

  /**
   * Trata mudança de status da rede
   */
  handleNetworkChange(isOnline) {
    const wasOnline = this.isOnline;
    this.isOnline = isOnline;

    if (wasOnline && !isOnline) {
      // Ficou offline
      this.handleOfflineMode();
    } else if (!wasOnline && isOnline) {
      // Voltou online
      this.handleOnlineMode();
    }

    this.emit('networkChange', { isOnline, wasOnline });
    this.log('Status da rede mudou:', { isOnline, wasOnline });
  }

  /**
   * Trata modo offline
   */
  handleOfflineMode() {
    this.showOfflineNotification();
    this.enableOfflineMode();
    this.emit('offline');
  }

  /**
   * Trata volta ao modo online
   */
  handleOnlineMode() {
    this.hideOfflineNotification();
    this.disableOfflineMode();
    this.processRetryQueue();
    this.emit('online');
  }

  /**
   * Verifica conectividade
   */
  async checkConnectivity() {
    try {
      const response = await fetch('/health', {
        method: 'HEAD',
        cache: 'no-cache',
        timeout: 5000
      });
      
      const isConnected = response.ok;
      
      if (this.isOnline !== isConnected) {
        this.handleNetworkChange(isConnected);
      }
    } catch (error) {
      if (this.isOnline) {
        this.handleNetworkChange(false);
      }
    }
  }

  /**
   * Agenda retry para erro
   */
  scheduleRetry(error, retryCallback) {
    if (!retryCallback || !error.retryable) return;

    const retryInfo = this.retryQueue.get(error.id) || {
      attempts: 0,
      maxAttempts: this.config.maxRetryAttempts,
      delay: this.config.retryDelay,
      callback: retryCallback
    };

    if (retryInfo.attempts >= retryInfo.maxAttempts) {
      this.retryQueue.delete(error.id);
      this.notifyRetryFailed(error);
      return;
    }

    retryInfo.attempts++;
    this.retryQueue.set(error.id, retryInfo);

    const delay = retryInfo.delay * Math.pow(2, retryInfo.attempts - 1); // Backoff exponencial

    setTimeout(async () => {
      try {
        await retryCallback();
        this.retryQueue.delete(error.id);
        this.notifyRetrySuccess(error);
      } catch (retryError) {
        this.scheduleRetry(error, retryCallback);
      }
    }, delay);

    this.log(`Retry agendado para erro ${error.id}: tentativa ${retryInfo.attempts}/${retryInfo.maxAttempts} em ${delay}ms`);
  }

  /**
   * Tenta recarregar recurso
   */
  retryResourceLoad(errorInfo) {
    return new Promise((resolve, reject) => {
      if (errorInfo.element === 'IMG') {
        const img = new Image();
        img.onload = resolve;
        img.onerror = reject;
        img.src = errorInfo.source;
      } else if (errorInfo.element === 'SCRIPT') {
        const script = document.createElement('script');
        script.onload = resolve;
        script.onerror = reject;
        script.src = errorInfo.source;
        document.head.appendChild(script);
      } else {
        reject(new Error('Tipo de recurso não suportado para retry'));
      }
    });
  }

  /**
   * Processa fila de retry
   */
  processRetryQueue() {
    for (const [errorId, retryInfo] of this.retryQueue) {
      setTimeout(() => {
        retryInfo.callback();
      }, 1000); // Aguarda 1 segundo antes de tentar
    }
  }

  /**
   * Mostra notificação de offline
   */
  showOfflineNotification() {
    if (!this.config.enableUserNotifications) return;

    this.createNotificationBanner({
      id: 'offline-banner',
      type: 'warning',
      message: 'Você está offline. Algumas funcionalidades podem não estar disponíveis.',
      persistent: true,
      actions: [
        {
          text: 'Tentar reconectar',
          action: () => this.checkConnectivity()
        }
      ]
    });
  }

  /**
   * Esconde notificação de offline
   */
  hideOfflineNotification() {
    this.removeNotificationBanner('offline-banner');
    
    if (this.config.enableUserNotifications) {
      this.createNotificationBanner({
        id: 'online-banner',
        type: 'success',
        message: 'Conexão restaurada!',
        duration: 3000
      });
    }
  }

  /**
   * Habilita modo offline
   */
  enableOfflineMode() {
    document.body.classList.add('chatbot-offline');
    
    // Desabilita funcionalidades que requerem conexão
    const sendButtons = document.querySelectorAll('.chat-interface__send-btn');
    sendButtons.forEach(btn => {
      btn.disabled = true;
      btn.title = 'Indisponível offline';
    });
  }

  /**
   * Desabilita modo offline
   */
  disableOfflineMode() {
    document.body.classList.remove('chatbot-offline');
    
    // Reabilita funcionalidades
    const sendButtons = document.querySelectorAll('.chat-interface__send-btn');
    sendButtons.forEach(btn => {
      btn.disabled = false;
      btn.title = '';
    });
  }

  /**
   * Notifica erro para o usuário
   */
  notifyError(error) {
    if (!this.config.enableUserNotifications) return;

    const userMessage = this.getUserFriendlyMessage(error);
    
    this.createNotificationBanner({
      id: `error-${error.id}`,
      type: 'error',
      message: userMessage,
      duration: error.severity === 'high' ? 0 : 5000, // Erros graves ficam até serem fechados
      actions: error.retryable ? [
        {
          text: 'Tentar novamente',
          action: () => this.emit('retryRequested', error)
        }
      ] : []
    });
  }

  /**
   * Notifica erro de conexão
   */
  notifyConnectionError(error) {
    if (!this.config.enableUserNotifications) return;

    this.createNotificationBanner({
      id: 'connection-error',
      type: 'error',
      message: 'Problema de conexão. Tentando reconectar...',
      persistent: true,
      actions: [
        {
          text: 'Tentar agora',
          action: () => this.emit('reconnectRequested')
        }
      ]
    });
  }

  /**
   * Notifica erro de mensagem
   */
  notifyMessageError(error) {
    if (!this.config.enableUserNotifications) return;

    this.createNotificationBanner({
      id: `message-error-${error.messageId}`,
      type: 'warning',
      message: 'Falha ao enviar mensagem.',
      duration: 5000,
      actions: [
        {
          text: 'Reenviar',
          action: () => this.emit('messageRetryRequested', error)
        }
      ]
    });
  }

  /**
   * Notifica sucesso de retry
   */
  notifyRetrySuccess(error) {
    if (!this.config.enableUserNotifications) return;

    this.createNotificationBanner({
      id: `retry-success-${error.id}`,
      type: 'success',
      message: 'Problema resolvido!',
      duration: 3000
    });
  }

  /**
   * Notifica falha de retry
   */
  notifyRetryFailed(error) {
    if (!this.config.enableUserNotifications) return;

    this.createNotificationBanner({
      id: `retry-failed-${error.id}`,
      type: 'error',
      message: 'Não foi possível resolver o problema automaticamente.',
      duration: 8000,
      actions: [
        {
          text: 'Recarregar página',
          action: () => window.location.reload()
        }
      ]
    });
  }

  /**
   * Cria banner de notificação
   */
  createNotificationBanner(options) {
    // Remove banner existente com mesmo ID
    this.removeNotificationBanner(options.id);

    const banner = document.createElement('div');
    banner.id = options.id;
    banner.className = `chatbot-notification-banner chatbot-notification-banner--${options.type}`;
    
    banner.innerHTML = `
      <div class="chatbot-notification-content">
        <div class="chatbot-notification-icon">
          ${this.getNotificationIcon(options.type)}
        </div>
        <div class="chatbot-notification-message">
          ${options.message}
        </div>
        <div class="chatbot-notification-actions">
          ${options.actions ? options.actions.map(action => 
            `<button class="chatbot-notification-action" data-action="${action.text}">${action.text}</button>`
          ).join('') : ''}
          <button class="chatbot-notification-close" aria-label="Fechar">×</button>
        </div>
      </div>
    `;

    // Adiciona event listeners
    banner.querySelector('.chatbot-notification-close').addEventListener('click', () => {
      this.removeNotificationBanner(options.id);
    });

    if (options.actions) {
      options.actions.forEach(action => {
        const button = banner.querySelector(`[data-action="${action.text}"]`);
        if (button) {
          button.addEventListener('click', () => {
            action.action();
            if (!options.persistent) {
              this.removeNotificationBanner(options.id);
            }
          });
        }
      });
    }

    // Adiciona ao DOM
    document.body.appendChild(banner);

    // Remove automaticamente se tiver duração
    if (options.duration && options.duration > 0) {
      setTimeout(() => {
        this.removeNotificationBanner(options.id);
      }, options.duration);
    }
  }

  /**
   * Remove banner de notificação
   */
  removeNotificationBanner(id) {
    const banner = document.getElementById(id);
    if (banner) {
      banner.remove();
    }
  }

  /**
   * Obtém ícone para tipo de notificação
   */
  getNotificationIcon(type) {
    const icons = {
      error: '⚠️',
      warning: '⚡',
      success: '✅',
      info: 'ℹ️'
    };
    return icons[type] || icons.info;
  }

  /**
   * Obtém mensagem amigável para erro
   */
  getUserFriendlyMessage(error) {
    const messages = {
      'connection': 'Problema de conexão com o servidor',
      'message': 'Erro ao processar mensagem',
      'resource': 'Falha ao carregar recurso',
      'javascript': 'Erro interno da aplicação',
      'promise': 'Erro de processamento'
    };

    return messages[error.category] || 'Ocorreu um erro inesperado';
  }

  /**
   * Registra erro no histórico
   */
  recordError(error) {
    this.errorHistory.push(error);
    
    // Mantém apenas os últimos 100 erros
    if (this.errorHistory.length > 100) {
      this.errorHistory.shift();
    }

    // Emite evento para monitoramento
    this.emit('errorRecorded', error);
  }

  /**
   * Gera ID único para erro
   */
  generateErrorId() {
    return `error_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Sistema de eventos
   */
  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(callback);
  }

  off(event, callback) {
    if (this.eventListeners.has(event)) {
      const listeners = this.eventListeners.get(event);
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  emit(event, data) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Erro no event listener:', error);
        }
      });
    }
  }

  /**
   * Logging
   */
  log(...args) {
    if (this.config.enableLogging) {
      console.log('[ErrorHandler]', ...args);
    }
  }

  /**
   * Obtém estatísticas de erro
   */
  getErrorStats() {
    const stats = {
      totalErrors: this.errorHistory.length,
      errorsByCategory: {},
      errorsBySeverity: {},
      recentErrors: this.errorHistory.slice(-10),
      retryQueueSize: this.retryQueue.size,
      isOnline: this.isOnline
    };

    // Agrupa por categoria
    this.errorHistory.forEach(error => {
      stats.errorsByCategory[error.category] = (stats.errorsByCategory[error.category] || 0) + 1;
      stats.errorsBySeverity[error.severity] = (stats.errorsBySeverity[error.severity] || 0) + 1;
    });

    return stats;
  }

  /**
   * Limpa histórico de erros
   */
  clearErrorHistory() {
    this.errorHistory = [];
    this.log('Histórico de erros limpo');
  }

  /**
   * Força verificação de conectividade
   */
  async forceConnectivityCheck() {
    await this.checkConnectivity();
  }

  /**
   * Destrói o error handler
   */
  destroy() {
    // Remove event listeners globais
    window.removeEventListener('error', this.handleGlobalError);
    window.removeEventListener('online', this.handleNetworkChange);
    window.removeEventListener('offline', this.handleNetworkChange);
    window.removeEventListener('unhandledrejection', this.handlePromiseRejection);

    // Limpa dados
    this.errorHistory = [];
    this.retryQueue.clear();
    this.eventListeners.clear();

    // Remove banners de notificação
    document.querySelectorAll('.chatbot-notification-banner').forEach(banner => {
      banner.remove();
    });

    this.log('ErrorHandler destruído');
  }
}