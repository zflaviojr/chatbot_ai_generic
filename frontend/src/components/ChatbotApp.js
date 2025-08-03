/**
 * Aplicação principal do chatbot que integra MessageHandler e ChatInterface
 * Gerencia o fluxo completo de mensagens MCP
 */
import { MessageHandler } from './MessageHandler.js';
// import { ChatInterface } from './ChatInterface.js'; // Removido - usando apenas ChatWidget
import { ChatWidget } from './ChatWidget.js';
import { ErrorHandler } from './ErrorHandler.js';

export class ChatbotApp {
  constructor(config = {}) {
    this.config = {
      websocketUrl: config.websocketUrl || 'ws://localhost:3001/ws',
      title: config.title || 'Assistente Virtual',
      position: config.position || 'bottom-right',
      enableNotifications: config.enableNotifications !== false,
      enableSounds: config.enableSounds !== false,
      autoStart: config.autoStart !== false,
      ...config
    };

    this.isInitialized = false;
    this.currentSessionId = null;
    this.messageHistory = [];
    this.retryQueue = new Map();

    this.init();
  }

  /**
   * Inicializa a aplicação do chatbot
   */
  async init() {
    try {
      // Cria container principal
      this.createContainer();

      // Inicializa componentes
      this.initializeComponents();

      // Configura integração MCP
      this.setupMCPIntegration();

      // Configura event listeners
      this.setupEventListeners();

      this.isInitialized = true;
      console.log('ChatbotApp inicializado com sucesso');
      
      // Auto-inicia se configurado (comentado para debug)
      if (this.config.autoStart) {
        console.log('Auto-start habilitado - inicializando sem sessão');
        // await this.start(); // Comentado temporariamente
      }

    } catch (error) {
      console.error('Erro ao inicializar ChatbotApp:', error);
      this.handleInitializationError(error);
    }
  }

  /**
   * Cria container principal da aplicação
   */
  createContainer() {
    this.container = document.createElement('div');
    this.container.id = 'chatbot-app';
    this.container.className = `chatbot-app chatbot-app--${this.config.position}`;
    
    // Adiciona ao DOM
    document.body.appendChild(this.container);
  }

  /**
   * Inicializa componentes principais
   */
  initializeComponents() {
    // Inicializa ErrorHandler
    this.errorHandler = new ErrorHandler({
      enableLogging: this.config.enableLogging,
      enableUserNotifications: this.config.enableNotifications,
      enableRetry: true,
      maxRetryAttempts: 3,
      retryDelay: 2000,
      offlineDetection: true
    });

    // Inicializa MessageHandler
    this.messageHandler = new MessageHandler(this.config.websocketUrl, {
      enableLogging: this.config.enableLogging,
      maxReconnectAttempts: this.config.maxReconnectAttempts || 5,
      messageTimeout: this.config.messageTimeout || 30000
    });

    // Container criado com sucesso
    
    // Inicializa ChatWidget
    this.chatWidget = new ChatWidget(this.container, {
      title: this.config.title,
      position: this.config.position,
      websocketUrl: this.config.websocketUrl
    });

    // Inicializa ChatInterface (será criada quando widget for aberto)
    this.chatInterface = null;
  }

  /**
   * Configura integração MCP
   */
  setupMCPIntegration() {
    // Processa respostas MCP
    this.messageHandler.on('chatResponse', (response) => {
      this.handleMCPResponse(response);
    });

    // Processa erros MCP
    this.messageHandler.on('chatError', (error) => {
      this.handleMCPError(error);
    });

    // Processa indicador de digitação
    this.messageHandler.on('typing', (data) => {
      this.handleTypingIndicator(data);
    });

    // Processa mensagens do sistema
    this.messageHandler.on('systemMessage', (message) => {
      this.handleSystemMessage(message);
    });

    // Processa eventos de conexão
    this.messageHandler.on('connected', () => {
      this.handleConnectionStatus('connected');
    });

    this.messageHandler.on('disconnected', () => {
      this.handleConnectionStatus('disconnected');
    });

    this.messageHandler.on('reconnectScheduled', (data) => {
      this.handleReconnectScheduled(data);
    });

    // Processa eventos de sessão
    this.messageHandler.on('sessionEnded', (data) => {
      this.handleSessionEndedResponse(data);
    });

    this.messageHandler.on('sessionReset', (data) => {
      this.handleSessionResetResponse(data);
    });

    this.messageHandler.on('sessionError', (data) => {
      this.handleSessionErrorResponse(data);
    });

    // Processa erros de conexão
    this.messageHandler.on('connectionError', (error) => {
      this.errorHandler.handleConnectionError({
        message: error.message,
        timestamp: new Date().toISOString(),
        retryCallback: () => this.messageHandler.forceReconnect()
      });
    });

    // Processa timeout de mensagens
    this.messageHandler.on('messageTimeout', (data) => {
      this.errorHandler.handleMessageError({
        messageId: data.messageId,
        message: 'Timeout na resposta',
        timestamp: data.timestamp,
        retryable: true
      });
    });
  }

  /**
   * Configura event listeners dos componentes
   */
  setupEventListeners() {
    console.log('ChatbotApp: Configurando event listeners no container:', this.container);
    
    // Widget events via DOM events (substituindo EventEmitter)
    this.container.addEventListener('chatMessage', (event) => {
      console.log('ChatbotApp: Mensagem recebida do widget:', event.detail.message);
      this.handleUserMessage({
        content: event.detail.message,
        messageId: this.generateMessageId(),
        timestamp: new Date().toISOString()
      });
    });

    // Session control events
    this.container.addEventListener('sessionEnd', (event) => {
      console.log('ChatbotApp: Comando para finalizar sessão');
      this.handleSessionEnd();
    });

    this.container.addEventListener('sessionReset', (event) => {
      console.log('ChatbotApp: Comando para nova sessão');
      this.handleSessionReset();
    });
    
    console.log('ChatbotApp: Event listener configurado');

    // Interface events (serão configurados quando interface for criada)
    this.setupInterfaceEventListeners();

    // Error handler events
    this.setupErrorHandlerListeners();
  }

  /**
   * Configura event listeners da interface de chat - DESABILITADO
   */
  setupInterfaceEventListeners() {
    console.log('🤖 ChatbotApp: setupInterfaceEventListeners desabilitado - usando apenas ChatWidget');
    // Método desabilitado
    return;
  }

  /**
   * Configura event listeners do error handler
   */
  setupErrorHandlerListeners() {
    // Eventos de rede
    this.errorHandler.on('online', () => {
      this.handleConnectionStatus('connected');
      if (this.chatInterface) {
        this.chatInterface.addMessage({
          type: 'system',
          content: 'Conexão restaurada!',
          timestamp: new Date().toISOString()
        });
      }
    });

    this.errorHandler.on('offline', () => {
      this.handleConnectionStatus('disconnected');
      if (this.chatInterface) {
        this.chatInterface.addMessage({
          type: 'system',
          content: 'Você está offline. Algumas funcionalidades podem não estar disponíveis.',
          timestamp: new Date().toISOString()
        });
      }
    });

    // Eventos de retry
    this.errorHandler.on('retryRequested', (error) => {
      if (error.category === 'connection') {
        this.messageHandler.forceReconnect();
      } else if (error.category === 'message') {
        this.retryMessage(error.messageId);
      }
    });

    this.errorHandler.on('reconnectRequested', () => {
      this.messageHandler.forceReconnect();
    });

    this.errorHandler.on('messageRetryRequested', (error) => {
      this.retryMessage(error.messageId);
    });

    // Eventos de erro
    this.errorHandler.on('errorRecorded', (error) => {
      console.log('Erro registrado:', error);
      
      // Emite evento para monitoramento externo se necessário
      if (this.config.enableLogging) {
        console.warn('Error recorded:', {
          id: error.id,
          category: error.category,
          severity: error.severity,
          message: error.message
        });
      }
    });
  }

  /**
   * Inicia a aplicação
   */
  async start() {
    if (!this.isInitialized) {
      throw new Error('ChatbotApp não foi inicializado');
    }

    try {
      // Inicia sessão se não existir
      if (!this.currentSessionId) {
        await this.startSession();
      }

      console.log('ChatbotApp iniciado');

    } catch (error) {
      console.error('Erro ao iniciar ChatbotApp:', error);
      throw error;
    }
  }

  /**
   * Abre interface de chat - DESABILITADO (usando apenas ChatWidget)
   */
  openChatInterface() {
    console.log('🤖 ChatbotApp: openChatInterface desabilitado - usando apenas ChatWidget');
    // Método desabilitado para evitar criar interface extra
    return;
  }

  /**
   * Fecha interface de chat - DESABILITADO (usando apenas ChatWidget)
   */
  closeChatInterface() {
    console.log('🤖 ChatbotApp: closeChatInterface desabilitado - usando apenas ChatWidget');
    // Método desabilitado
    return;
  }

  /**
   * Inicia nova sessão de chat
   */
  async startSession() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout ao iniciar sessão'));
      }, 10000);

      this.messageHandler.once('sessionStarted', (data) => {
        clearTimeout(timeout);
        this.currentSessionId = data.sessionId;
        console.log('Sessão iniciada:', this.currentSessionId);
        resolve(data.sessionId);
      });

      this.messageHandler.startSession();
    });
  }

  /**
   * Processa mensagem do usuário
   */
  async handleUserMessage(messageData) {
    try {
      // Mostra indicador de digitação no ChatWidget
      if (this.chatWidget) {
        this.chatWidget.showTypingIndicator();
      }
      
      // ChatInterface removida - usando apenas ChatWidget

      // Adiciona ao histórico
      this.messageHistory.push({
        ...messageData,
        type: 'user',
        timestamp: new Date().toISOString()
      });

      // Envia via WebSocket
      const sentMessageId = this.messageHandler.sendChatMessage(
        messageData.content,
        this.currentSessionId
      );

      // Atualiza status na interface
      if (this.chatInterface) {
        setTimeout(() => {
          this.chatInterface.updateMessageStatus(messageData.messageId, 'sent');
        }, 500);
      }

      console.log('Mensagem enviada:', sentMessageId);

    } catch (error) {
      console.error('Erro ao processar mensagem do usuário:', error);
      
      if (this.chatInterface) {
        this.chatInterface.updateMessageStatus(messageData.messageId, 'error');
        this.showErrorMessage('Erro ao enviar mensagem. Tente novamente.');
      }
    }
  }

  /**
   * Processa resposta MCP
   */
  handleMCPResponse(response) {
    console.log('🤖 ChatbotApp: Resposta MCP recebida para ChatWidget');

    // Adiciona ao histórico
    this.messageHistory.push({
      ...response,
      timestamp: new Date().toISOString()
    });

    // Adiciona à interface do ChatWidget (janelinha lateral)
    if (this.chatWidget) {
      // Para o indicador de digitação
      this.chatWidget.hideTypingIndicator();
      
      // Adiciona mensagem do bot
      this.chatWidget.addMessage({
        type: 'bot',
        content: response.formattedContent || response.content,
        timestamp: response.timestamp || new Date().toISOString()
      });

      // Atualiza informações da sessão se disponível
      if (response.context) {
        this.chatWidget.updateSessionInfo({
          context: response.context,
          sessionId: response.sessionId
        });
      }
    }
    
    // ChatInterface removida - usando apenas ChatWidget

    // Atualiza widget com nova mensagem
    this.chatWidget.updateLastMessage(response.content);

    // Notificação se interface estiver fechada
    if (!this.chatInterface && this.config.enableNotifications) {
      this.showNotification('Nova mensagem do assistente', response.content);
    }

    // Som de notificação
    if (this.config.enableSounds) {
      this.playNotificationSound();
    }
  }

  /**
   * Finaliza sessão atual
   */
  handleSessionEnd() {
    console.log('ChatbotApp: Finalizando sessão atual');
    
    if (this.currentSessionId) {
      // Envia comando para finalizar sessão via WebSocket
      if (this.messageHandler && this.messageHandler.ws && this.messageHandler.ws.readyState === WebSocket.OPEN) {
        this.messageHandler.ws.send(JSON.stringify({
          type: 'session_end',
          sessionId: this.currentSessionId,
          timestamp: new Date().toISOString()
        }));
        console.log('ChatbotApp: Comando session_end enviado');
      } else {
        console.warn('ChatbotApp: WebSocket não está conectado para enviar session_end');
      }
    } else {
      console.warn('ChatbotApp: Nenhuma sessão ativa para finalizar');
    }
  }

  /**
   * Inicia nova sessão
   */
  handleSessionReset() {
    console.log('ChatbotApp: Iniciando nova sessão');
    
    if (this.currentSessionId) {
      // Envia comando para resetar sessão via WebSocket
      if (this.messageHandler && this.messageHandler.ws && this.messageHandler.ws.readyState === WebSocket.OPEN) {
        this.messageHandler.ws.send(JSON.stringify({
          type: 'session_reset',
          sessionId: this.currentSessionId,
          timestamp: new Date().toISOString()
        }));
        console.log('ChatbotApp: Comando session_reset enviado');
      } else {
        console.warn('ChatbotApp: WebSocket não está conectado para enviar session_reset');
      }
    } else {
      // Se não há sessão, inicia uma nova
      console.log('ChatbotApp: Nenhuma sessão ativa, iniciando nova sessão');
      this.startSession();
    }
  }

  /**
   * Trata resposta de sessão finalizada
   */
  handleSessionEndedResponse(data) {
    console.log('ChatbotApp: Sessão finalizada:', data);
    
    if (this.chatWidget) {
      this.chatWidget.addMessage({
        type: 'system',
        content: data.message || 'Atendimento finalizado com sucesso!',
        timestamp: new Date().toISOString()
      });
    }
    
    // Limpa ID da sessão atual
    this.currentSessionId = null;
  }

  /**
   * Trata resposta de sessão resetada
   */
  handleSessionResetResponse(data) {
    console.log('ChatbotApp: Sessão resetada:', data);
    
    if (this.chatWidget) {
      this.chatWidget.addMessage({
        type: 'system',
        content: data.message || 'Novo atendimento iniciado!',
        timestamp: new Date().toISOString()
      });
    }
    
    // Atualiza ID da sessão
    this.currentSessionId = data.sessionId;
  }

  /**
   * Trata erro de sessão
   */
  handleSessionErrorResponse(data) {
    console.error('ChatbotApp: Erro de sessão:', data);
    
    if (this.chatWidget) {
      this.chatWidget.addMessage({
        type: 'system',
        content: `Erro: ${data.message}`,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Processa erro MCP
   */
  handleMCPError(error) {
    console.error('Erro MCP:', error);

    // Adiciona mensagem de erro à interface
    if (this.chatInterface) {
      this.chatInterface.addMessage({
        type: 'system',
        content: error.displayMessage,
        timestamp: error.timestamp,
        isError: true
      });

      // Oferece retry se aplicável
      if (error.canRetry) {
        this.offerRetry(error);
      }
    }

    // Atualiza widget
    this.chatWidget.updateStatus('error', 'Erro na resposta');
  }

  /**
   * Processa indicador de digitação
   */
  handleTypingIndicator(data) {
    // Atualiza no ChatWidget (janelinha lateral)
    if (this.chatWidget) {
      if (data.isTyping) {
        this.chatWidget.showTypingIndicator();
      } else {
        this.chatWidget.hideTypingIndicator();
      }
    }
    
    // ChatInterface removida - usando apenas ChatWidget
  }

  /**
   * Processa mensagens do sistema
   */
  handleSystemMessage(message) {
    console.log('Mensagem do sistema:', message);

    if (this.chatInterface) {
      this.chatInterface.addMessage({
        type: 'system',
        content: message.message,
        timestamp: message.timestamp,
        priority: message.priority
      });
    }

    // Atualiza status do widget baseado na prioridade
    if (message.priority === 'high') {
      this.chatWidget.updateStatus('error', message.message);
    } else if (message.priority === 'medium') {
      this.chatWidget.updateStatus('warning', message.message);
    }
  }

  /**
   * Processa status de conexão
   */
  handleConnectionStatus(status) {
    console.log('Status de conexão:', status);

    const statusMessages = {
      'connected': 'Conectado',
      'disconnected': 'Desconectado',
      'connecting': 'Conectando...'
    };

    const statusMessage = statusMessages[status] || status;

    // Atualiza interface
    if (this.chatInterface) {
      this.chatInterface.updateConnectionStatus(status, statusMessage);
    }

    // Atualiza widget
    this.chatWidget.updateStatus(status, statusMessage);

    // Mensagem do sistema na interface
    if (status === 'connected' && this.chatInterface) {
      this.chatInterface.addMessage({
        type: 'system',
        content: 'Conectado ao assistente virtual',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Processa agendamento de reconexão
   */
  handleReconnectScheduled(data) {
    const message = `Tentando reconectar... (${data.attempt}/${data.maxAttempts})`;
    
    if (this.chatInterface) {
      this.chatInterface.updateConnectionStatus('connecting', message);
    }
    
    this.chatWidget.updateStatus('connecting', message);
  }

  /**
   * Oferece opção de retry para mensagem com erro
   */
  offerRetry(error) {
    if (!this.chatInterface || !error.canRetry) return;

    const retryButton = document.createElement('button');
    retryButton.className = 'chatbot-retry-button';
    retryButton.textContent = 'Tentar novamente';
    retryButton.onclick = () => {
      this.retryMessage(error.messageId);
      retryButton.remove();
    };

    // Adiciona botão à última mensagem de erro
    const lastMessage = this.chatInterface.container.querySelector('.chat-interface__message:last-child');
    if (lastMessage) {
      lastMessage.appendChild(retryButton);
    }
  }

  /**
   * Tenta reenviar mensagem
   */
  async retryMessage(messageId) {
    const originalMessage = this.messageHistory.find(m => m.id === messageId);
    if (!originalMessage) return;

    try {
      // Remove da fila de retry
      this.retryQueue.delete(messageId);

      // Reenvia mensagem
      await this.handleUserMessage({
        content: originalMessage.content,
        messageId: this.generateMessageId()
      });

    } catch (error) {
      console.error('Erro ao tentar reenviar mensagem:', error);
      this.showErrorMessage('Erro ao tentar reenviar. Tente novamente.');
    }
  }

  /**
   * Restaura histórico de mensagens na interface
   */
  restoreMessageHistory() {
    if (!this.chatInterface || this.messageHistory.length === 0) return;

    // Adiciona mensagens do histórico (últimas 20)
    const recentMessages = this.messageHistory.slice(-20);
    
    recentMessages.forEach(message => {
      this.chatInterface.addMessage(message);
    });
  }

  /**
   * Mostra mensagem de erro
   */
  showErrorMessage(message) {
    if (this.chatInterface) {
      this.chatInterface.addMessage({
        type: 'system',
        content: message,
        timestamp: new Date().toISOString(),
        isError: true
      });
    }
  }

  /**
   * Mostra notificação do sistema
   */
  showNotification(title, body) {
    if (!('Notification' in window)) return;

    if (Notification.permission === 'granted') {
      new Notification(title, {
        body: body.substring(0, 100) + (body.length > 100 ? '...' : ''),
        icon: '/favicon.ico',
        tag: 'chatbot-notification'
      });
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          this.showNotification(title, body);
        }
      });
    }
  }

  /**
   * Reproduz som de notificação
   */
  playNotificationSound() {
    try {
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT');
      audio.volume = 0.3;
      audio.play().catch(() => {
        // Ignora erro se não conseguir reproduzir
      });
    } catch (error) {
      // Ignora erro de áudio
    }
  }

  /**
   * Trata erro de inicialização
   */
  handleInitializationError(error) {
    console.error('Erro crítico na inicialização:', error);
    
    // Mostra mensagem de erro para o usuário
    if (this.container) {
      this.container.innerHTML = `
        <div class="chatbot-error">
          <h3>Erro ao carregar chatbot</h3>
          <p>Ocorreu um erro ao inicializar o assistente virtual.</p>
          <button onclick="location.reload()">Recarregar página</button>
        </div>
      `;
    }
  }

  /**
   * Gera ID único para mensagem
   */
  generateMessageId() {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Retorna estatísticas da aplicação
   */
  getStats() {
    return {
      isInitialized: this.isInitialized,
      currentSessionId: this.currentSessionId,
      messageCount: this.messageHistory.length,
      isWidgetOpen: this.chatWidget ? this.chatWidget.isOpen : false,
      connectionStats: this.messageHandler?.getStats(),
      retryQueueSize: this.retryQueue.size
    };
  }

  /**
   * Limpa histórico de mensagens
   */
  clearHistory() {
    this.messageHistory = [];
    
    // ChatInterface removida - histórico apenas em memória
    console.log('Histórico de mensagens limpo');
  }

  /**
   * Encerra sessão atual
   */
  async endSession() {
    if (this.currentSessionId) {
      this.messageHandler.endSession(this.currentSessionId);
      this.currentSessionId = null;
      console.log('Sessão encerrada');
    }
  }

  /**
   * Destrói a aplicação
   */
  destroy() {
    console.log('Destruindo ChatbotApp...');

    // Encerra sessão
    this.endSession();

    // Destrói componentes
    if (this.messageHandler) {
      this.messageHandler.destroy();
    }

    if (this.chatInterface) {
      this.chatInterface.destroy();
    }

    if (this.chatWidget) {
      this.chatWidget.destroy();
    }

    // Remove container
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }

    // Limpa dados
    this.messageHistory = [];
    this.retryQueue.clear();
    this.isInitialized = false;

    console.log('ChatbotApp destruído');
  }
}