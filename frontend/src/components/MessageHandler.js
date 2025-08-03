import analytics from '../utils/Analytics.js';
import { ConversationHistoryManager } from '../utils/ConversationHistoryManager.js';

/**
 * Gerenciador de mensagens WebSocket com auto-reconexão e fila de mensagens
 * Implementa comunicação robusta com o backend do chatbot
 * Integrado com ConversationHistoryManager para continuidade de conversas
 */
export class MessageHandler {
  constructor(websocketUrl, config = {}) {
    this.websocketUrl = websocketUrl;
    this.config = {
      reconnectInterval: config.reconnectInterval || 3000,
      maxReconnectAttempts: config.maxReconnectAttempts || 10,
      heartbeatInterval: config.heartbeatInterval || 30000,
      messageTimeout: config.messageTimeout || 30000,
      queueMaxSize: config.queueMaxSize || 100,
      enableLogging: config.enableLogging !== false,
      // Configurações do histórico
      historyConfig: {
        maxTokens: 4000,
        reserveTokens: 500,
        debug: config.enableLogging !== false,
        ...config.historyConfig
      },
      ...config
    };

    // Estado da conexão
    this.ws = null;
    this.isConnected = false;
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.lastConnectTime = null;

    // Gerenciamento de mensagens
    this.messageQueue = [];
    this.pendingMessages = new Map();
    this.messageIdCounter = 0;

    // Timers
    this.reconnectTimer = null;
    this.heartbeatTimer = null;
    this.messageTimeouts = new Map();

    // Event listeners
    this.eventListeners = new Map();

    // Inicializa gerenciador de histórico
    this.historyManager = new ConversationHistoryManager(this.config.historyConfig);

    this.init();
  }

  /**
   * Inicializa o handler
   */
  init() {
    this.log('MessageHandler inicializado');
    this.connect();
  }

  /**
   * Conecta ao WebSocket
   */
  async connect() {
    if (this.isConnecting || this.isConnected) {
      return;
    }

    this.isConnecting = true;
    this.log(`Conectando ao WebSocket: ${this.websocketUrl}`);

    try {
      this.ws = new WebSocket(this.websocketUrl);
      this.setupWebSocketHandlers();
      
      // Timeout para conexão
      const connectTimeout = setTimeout(() => {
        if (this.ws.readyState === WebSocket.CONNECTING) {
          this.ws.close();
          this.handleConnectionError(new Error('Timeout na conexão'));
        }
      }, 10000);

      this.ws.addEventListener('open', () => {
        clearTimeout(connectTimeout);
      }, { once: true });

    } catch (error) {
      this.handleConnectionError(error);
    }
  }

  /**
   * Configura handlers do WebSocket
   */
  setupWebSocketHandlers() {
    this.ws.addEventListener('open', (event) => {
      this.handleOpen(event);
    });

    this.ws.addEventListener('message', (event) => {
      this.handleMessage(event);
    });

    this.ws.addEventListener('close', (event) => {
      this.handleClose(event);
    });

    this.ws.addEventListener('error', (event) => {
      this.handleError(event);
    });
  }

  /**
   * Trata abertura da conexão
   */
  handleOpen(event) {
    this.log('Conexão WebSocket estabelecida');
    
    this.isConnected = true;
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.lastConnectTime = new Date();

    // Track WebSocket connection
    analytics.trackWebSocketMetrics('connect', {
      reconnectAttempts: this.reconnectAttempts,
      timestamp: Date.now()
    });

    // Inicia heartbeat
    this.startHeartbeat();

    // Processa fila de mensagens
    this.processMessageQueue();

    // Emite evento de conexão
    this.emit('connected', {
      timestamp: this.lastConnectTime,
      reconnectAttempts: this.reconnectAttempts
    });
  }

  /**
   * Trata mensagens recebidas
   */
  handleMessage(event) {
    try {
      const data = JSON.parse(event.data);
      this.log('Mensagem recebida:', data.type);

      // Trata diferentes tipos de mensagem
      switch (data.type) {
        case 'connection':
          this.handleConnectionMessage(data);
          break;
        case 'chat_response':
          this.handleChatResponse(data);
          break;
        case 'chat_error':
          this.handleChatError(data);
          break;
        case 'typing':
          this.handleTypingIndicator(data);
          break;
        case 'pong':
          this.handlePong(data);
          break;
        case 'system':
          this.handleSystemMessage(data);
          break;
        case 'session_started':
          this.handleSessionStarted(data);
          break;
        case 'session_ended':
          this.handleSessionEnded(data);
          break;
        case 'session_reset':
          this.handleSessionReset(data);
          break;
        case 'session_info':
          this.handleSessionInfo(data);
          break;
        case 'session_error':
          this.handleSessionError(data);
          break;
        default:
          this.log('Tipo de mensagem desconhecido:', data.type);
          this.emit('unknownMessage', data);
      }

    } catch (error) {
      this.log('Erro ao processar mensagem:', error);
      this.emit('messageError', { error, rawData: event.data });
    }
  }

  /**
   * Trata fechamento da conexão
   */
  handleClose(event) {
    this.log(`Conexão WebSocket fechada: ${event.code} - ${event.reason}`);
    
    this.isConnected = false;
    this.isConnecting = false;
    
    this.stopHeartbeat();
    this.clearMessageTimeouts();

    // Track WebSocket disconnection
    analytics.trackWebSocketMetrics('disconnect', {
      code: event.code,
      reason: event.reason,
      wasClean: event.wasClean,
      reconnectAttempts: this.reconnectAttempts,
      timestamp: Date.now()
    });

    // Emite evento de desconexão
    this.emit('disconnected', {
      code: event.code,
      reason: event.reason,
      wasClean: event.wasClean
    });

    // Tenta reconectar se não foi fechamento intencional
    if (event.code !== 1000 && this.reconnectAttempts < this.config.maxReconnectAttempts) {
      this.scheduleReconnect();
    } else if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      this.emit('maxReconnectAttemptsReached', {
        attempts: this.reconnectAttempts
      });
    }
  }

  /**
   * Trata erros da conexão
   */
  handleError(event) {
    this.log('Erro na conexão WebSocket:', event);
    this.emit('connectionError', event);
  }

  /**
   * Trata erros de conexão
   */
  handleConnectionError(error) {
    this.log('Erro ao conectar:', error.message);
    this.isConnecting = false;
    
    this.emit('connectionError', error);
    
    if (this.reconnectAttempts < this.config.maxReconnectAttempts) {
      this.scheduleReconnect();
    }
  }

  /**
   * Agenda reconexão
   */
  scheduleReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      this.config.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1),
      30000 // Máximo 30 segundos
    );

    this.log(`Tentativa de reconexão ${this.reconnectAttempts}/${this.config.maxReconnectAttempts} em ${delay}ms`);

    this.emit('reconnectScheduled', {
      attempt: this.reconnectAttempts,
      delay: delay,
      maxAttempts: this.config.maxReconnectAttempts
    });

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Envia mensagem
   */
  sendMessage(type, data = {}) {
    const message = {
      type,
      messageId: this.generateMessageId(),
      timestamp: new Date().toISOString(),
      ...data
    };

    if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
      this.sendMessageNow(message);
    } else {
      this.queueMessage(message);
    }

    return message.messageId;
  }

  /**
   * Envia mensagem imediatamente
   */
  sendMessageNow(message) {
    try {
      const messageStr = JSON.stringify(message);
      this.ws.send(messageStr);
      
      this.log('Mensagem enviada:', message.type);

      // Adiciona timeout para resposta se necessário
      if (message.type === 'chat') {
        this.addMessageTimeout(message.messageId);
      }

      this.emit('messageSent', message);

    } catch (error) {
      this.log('Erro ao enviar mensagem:', error);
      this.queueMessage(message);
      this.emit('sendError', { message, error });
    }
  }

  /**
   * Adiciona mensagem à fila
   */
  queueMessage(message) {
    if (this.messageQueue.length >= this.config.queueMaxSize) {
      const removedMessage = this.messageQueue.shift();
      this.log('Fila de mensagens cheia, removendo mensagem mais antiga');
      this.emit('messageDropped', removedMessage);
    }

    this.messageQueue.push(message);
    this.log(`Mensagem adicionada à fila (${this.messageQueue.length}/${this.config.queueMaxSize})`);
  }

  /**
   * Processa fila de mensagens
   */
  processMessageQueue() {
    if (this.messageQueue.length === 0) return;

    this.log(`Processando ${this.messageQueue.length} mensagens da fila`);

    const messages = [...this.messageQueue];
    this.messageQueue = [];

    messages.forEach(message => {
      this.sendMessageNow(message);
    });
  }

  /**
   * Envia mensagem de chat com histórico
   */
  sendChatMessage(content, sessionId = null) {
    this.log('📤 Enviando mensagem de chat:', content.substring(0, 50) + '...');
    
    // Adiciona mensagem do usuário ao histórico
    this.historyManager.addUserMessage(content);
    
    // Prepara payload com histórico completo
    const historyPayload = this.historyManager.prepareApiPayload();
    
    this.log('📤 Histórico preparado com', historyPayload.length, 'mensagens');
    this.log('📤 Payload completo:', JSON.stringify(historyPayload, null, 2));
    
    // Track chat interaction
    analytics.trackChatInteraction('message_sent', {
      messageLength: content.length,
      sessionId: this.historyManager.sessionId,
      historyLength: historyPayload.length,
      timestamp: Date.now()
    });
    
    // Envia apenas o histórico formatado, não a mensagem individual
    return this.sendMessage('chat', {
      sessionId: this.historyManager.sessionId,
      history: historyPayload // Inclui histórico completo já formatado
    });
  }

  /**
   * Inicia nova sessão
   */
  startSession(context = {}) {
    this.log('🆕 Iniciando nova sessão');
    
    // Inicia nova sessão no gerenciador de histórico
    const sessionId = this.historyManager.startNewSession(context);
    
    return this.sendMessage('session_start', {
      sessionId,
      context
    });
  }

  /**
   * Encerra sessão
   */
  endSession(sessionId = null) {
    const targetSessionId = sessionId || this.historyManager.sessionId;
    this.log('🔚 Encerrando sessão:', targetSessionId);
    
    // Encerra sessão no gerenciador de histórico
    this.historyManager.endSession();
    
    return this.sendMessage('session_end', { sessionId: targetSessionId });
  }

  /**
   * Reseta sessão atual
   */
  resetSession(context = {}) {
    this.log('🔄 Resetando sessão');
    
    // Inicia nova sessão (que automaticamente limpa a anterior)
    const sessionId = this.historyManager.startNewSession(context);
    
    return this.sendMessage('session_reset', {
      sessionId,
      context
    });
  }

  /**
   * Envia ping
   */
  ping() {
    return this.sendMessage('ping');
  }

  /**
   * Inicia heartbeat
   */
  startHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected) {
        this.ping();
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * Para heartbeat
   */
  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Adiciona timeout para mensagem
   */
  addMessageTimeout(messageId) {
    const timeout = setTimeout(() => {
      this.handleMessageTimeout(messageId);
    }, this.config.messageTimeout);

    this.messageTimeouts.set(messageId, timeout);
  }

  /**
   * Remove timeout de mensagem
   */
  removeMessageTimeout(messageId) {
    const timeout = this.messageTimeouts.get(messageId);
    if (timeout) {
      clearTimeout(timeout);
      this.messageTimeouts.delete(messageId);
    }
  }

  /**
   * Limpa todos os timeouts
   */
  clearMessageTimeouts() {
    this.messageTimeouts.forEach(timeout => clearTimeout(timeout));
    this.messageTimeouts.clear();
  }

  /**
   * Trata timeout de mensagem
   */
  handleMessageTimeout(messageId) {
    this.log(`Timeout na mensagem: ${messageId}`);
    this.messageTimeouts.delete(messageId);
    
    this.emit('messageTimeout', {
      messageId,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Handlers para tipos específicos de mensagem
   */
  handleConnectionMessage(data) {
    this.emit('connectionMessage', data);
  }

  handleChatResponse(data) {
    console.log('📨 MessageHandler: handleChatResponse chamado com:', data);
    this.removeMessageTimeout(data.messageId);
    
    // Adiciona resposta do assistente ao histórico
    if (data.content) {
      this.historyManager.addAssistantMessage(data.content, {
        messageId: data.messageId,
        usage: data.usage,
        model: data.metadata?.model,
        processingTime: data.metadata?.processingTime
      });
    }
    
    // Processa e valida resposta MCP
    const processedResponse = this.processMCPResponse(data);
    console.log('📨 MessageHandler: processedResponse:', processedResponse);
    console.log('📨 MessageHandler: Emitindo evento chatResponse...');
    this.emit('chatResponse', processedResponse);
  }

  handleChatError(data) {
    this.removeMessageTimeout(data.messageId);
    
    // Processa erro com informações de retry
    const processedError = this.processChatError(data);
    this.emit('chatError', processedError);
  }

  handleTypingIndicator(data) {
    this.emit('typing', {
      isTyping: data.isTyping,
      timestamp: data.timestamp || new Date().toISOString()
    });
  }

  handlePong(data) {
    this.lastPongTime = new Date();
    this.emit('pong', data);
  }

  handleSystemMessage(data) {
    this.emit('systemMessage', {
      ...data,
      priority: this.getSystemMessagePriority(data.message)
    });
  }

  handleSessionStarted(data) {
    this.currentSessionId = data.sessionId;
    
    // Atualiza contexto no gerenciador de histórico se fornecido
    if (data.context) {
      this.historyManager.updateSessionContext(data.context);
    }
    
    this.emit('sessionStarted', data);
  }

  handleSessionEnded(data) {
    this.currentSessionId = null;
    this.emit('sessionEnded', data);
  }

  handleSessionReset(data) {
    // Limpa histórico atual
    this.historyManager.clearHistory();
    this.emit('sessionReset', data);
  }

  handleSessionInfo(data) {
    // Atualiza contexto da sessão com informações recebidas
    if (data.context) {
      this.historyManager.updateSessionContext(data.context);
    }
    
    this.emit('sessionInfo', data);
  }

  handleSessionError(data) {
    this.emit('sessionError', data);
  }

  /**
   * Processa resposta MCP para melhor exibição
   */
  processMCPResponse(data) {
    const processedResponse = {
      ...data,
      content: this.sanitizeResponseContent(data.content),
      usage: this.formatUsageInfo(data.usage),
      metadata: this.processMetadata(data.metadata),
      displayTimestamp: this.formatDisplayTimestamp(data.timestamp),
      responseTime: this.calculateResponseTime(data.metadata?.processingTime),
      type: 'bot', // Marca como mensagem do bot
      status: 'delivered'
    };

    // Adiciona informações de qualidade da resposta
    processedResponse.quality = this.assessResponseQuality(data);
    
    // Processa links e formatação especial
    processedResponse.formattedContent = this.enhanceContentFormatting(processedResponse.content);
    
    return processedResponse;
  }

  /**
   * Processa erro de chat
   */
  processChatError(data) {
    return {
      ...data,
      displayMessage: this.getDisplayErrorMessage(data.message, data.errorCode),
      canRetry: data.retryable !== false,
      retryDelay: this.getRetryDelay(data.errorCode),
      displayTimestamp: this.formatDisplayTimestamp(data.timestamp)
    };
  }

  /**
   * Sanitiza conteúdo da resposta
   */
  sanitizeResponseContent(content) {
    if (!content || typeof content !== 'string') {
      return 'Resposta não disponível';
    }

    // Remove scripts e tags perigosas
    return content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/javascript:/gi, '')
      .trim();
  }

  /**
   * Formata informações de uso
   */
  formatUsageInfo(usage) {
    if (!usage) return null;

    return {
      promptTokens: usage.promptTokens || 0,
      completionTokens: usage.completionTokens || 0,
      totalTokens: usage.totalTokens || 0,
      displayText: `${usage.totalTokens || 0} tokens utilizados`
    };
  }

  /**
   * Processa metadados
   */
  processMetadata(metadata) {
    if (!metadata) return null;

    return {
      ...metadata,
      displayProcessingTime: this.formatProcessingTime(metadata.processingTime),
      modelDisplayName: this.getModelDisplayName(metadata.model)
    };
  }

  /**
   * Formata timestamp para exibição
   */
  formatDisplayTimestamp(timestamp) {
    if (!timestamp) return '';

    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Agora';
    if (diffMins < 60) return `${diffMins}min`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h`;
    
    return date.toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }

  /**
   * Calcula tempo de resposta
   */
  calculateResponseTime(processingTime) {
    if (!processingTime) return null;

    if (processingTime < 1000) {
      return `${processingTime}ms`;
    } else {
      return `${(processingTime / 1000).toFixed(1)}s`;
    }
  }

  /**
   * Obtém mensagem de erro para exibição
   */
  getDisplayErrorMessage(message, errorCode) {
    const errorMessages = {
      'TIMEOUT': 'A resposta demorou mais que o esperado. Tente novamente.',
      'SERVICE_UNAVAILABLE': 'Serviço temporariamente indisponível.',
      'INVALID_MESSAGE': 'Mensagem inválida. Verifique o formato.',
      'INTERNAL_ERROR': 'Erro interno. Tente novamente.'
    };

    return errorMessages[errorCode] || message || 'Erro desconhecido';
  }

  /**
   * Obtém delay para retry baseado no tipo de erro
   */
  getRetryDelay(errorCode) {
    const retryDelays = {
      'TIMEOUT': 2000,
      'SERVICE_UNAVAILABLE': 5000,
      'INTERNAL_ERROR': 3000
    };

    return retryDelays[errorCode] || 1000;
  }

  /**
   * Obtém prioridade da mensagem do sistema
   */
  getSystemMessagePriority(message) {
    if (message.includes('erro') || message.includes('falha')) {
      return 'high';
    }
    if (message.includes('conectado') || message.includes('disponível')) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Formata tempo de processamento
   */
  formatProcessingTime(time) {
    if (!time) return '';
    
    if (time < 1000) {
      return `${time}ms`;
    } else {
      return `${(time / 1000).toFixed(1)}s`;
    }
  }

  /**
   * Obtém nome de exibição do modelo
   */
  getModelDisplayName(model) {
    const modelNames = {
      'gpt-4': 'GPT-4',
      'gpt-3.5-turbo': 'GPT-3.5',
      'claude-3': 'Claude 3'
    };

    return modelNames[model] || model || 'Modelo desconhecido';
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
          this.log('Erro no event listener:', error);
        }
      });
    }
  }

  /**
   * Avalia qualidade da resposta MCP
   */
  assessResponseQuality(data) {
    const content = data.content || '';
    const usage = data.usage || {};
    
    let score = 0;
    let factors = [];

    // Avalia comprimento da resposta
    if (content.length > 50) {
      score += 20;
      factors.push('comprehensive');
    }
    if (content.length > 200) {
      score += 10;
      factors.push('detailed');
    }

    // Avalia uso de tokens
    if (usage.totalTokens && usage.totalTokens > 100) {
      score += 15;
      factors.push('thorough');
    }

    // Avalia tempo de processamento
    if (data.metadata?.processingTime) {
      if (data.metadata.processingTime < 2000) {
        score += 15;
        factors.push('fast');
      } else if (data.metadata.processingTime < 5000) {
        score += 10;
        factors.push('moderate');
      }
    }

    // Avalia estrutura do conteúdo
    if (content.includes('\n') || content.includes('•') || content.includes('-')) {
      score += 10;
      factors.push('structured');
    }

    // Determina classificação
    let rating = 'poor';
    if (score >= 60) rating = 'excellent';
    else if (score >= 40) rating = 'good';
    else if (score >= 20) rating = 'fair';

    return {
      score,
      rating,
      factors,
      displayText: this.getQualityDisplayText(rating)
    };
  }

  /**
   * Obtém texto de exibição para qualidade
   */
  getQualityDisplayText(rating) {
    const qualityTexts = {
      'excellent': 'Resposta excelente',
      'good': 'Boa resposta',
      'fair': 'Resposta adequada',
      'poor': 'Resposta básica'
    };
    
    return qualityTexts[rating] || 'Resposta processada';
  }

  /**
   * Melhora formatação do conteúdo
   */
  enhanceContentFormatting(content) {
    if (!content || typeof content !== 'string') {
      return content;
    }

    let enhanced = content;

    // Detecta e formata listas
    enhanced = enhanced.replace(/^[-•*]\s+(.+)$/gm, '<li>$1</li>');
    if (enhanced.includes('<li>')) {
      enhanced = enhanced.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
    }

    // Detecta e formata números de lista
    enhanced = enhanced.replace(/^(\d+)\.\s+(.+)$/gm, '<li>$2</li>');
    if (enhanced.includes('<li>') && enhanced.match(/^\d+\./m)) {
      enhanced = enhanced.replace(/(<li>.*<\/li>)/s, '<ol>$1</ol>');
    }

    // Detecta e formata código inline
    enhanced = enhanced.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Detecta e formata blocos de código
    enhanced = enhanced.replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>');

    // Detecta e formata texto em negrito
    enhanced = enhanced.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    // Detecta e formata texto em itálico
    enhanced = enhanced.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // Detecta e formata links
    enhanced = enhanced.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');

    // Preserva quebras de linha
    enhanced = enhanced.replace(/\n/g, '<br>');

    return enhanced;
  }

  /**
   * Gera ID único para mensagem
   */
  generateMessageId() {
    return `msg_${Date.now()}_${++this.messageIdCounter}`;
  }

  /**
   * Logging
   */
  log(...args) {
    if (this.config.enableLogging) {
      console.log('[MessageHandler]', ...args);
    }
  }

  /**
   * Retorna estatísticas
   */
  getStats() {
    const historyInfo = this.historyManager.getSessionInfo();
    
    return {
      isConnected: this.isConnected,
      isConnecting: this.isConnecting,
      reconnectAttempts: this.reconnectAttempts,
      lastConnectTime: this.lastConnectTime,
      queuedMessages: this.messageQueue.length,
      pendingMessages: this.pendingMessages.size,
      activeTimeouts: this.messageTimeouts.size,
      // Informações do histórico
      currentSessionId: historyInfo.sessionId,
      messageCount: historyInfo.messageCount,
      totalTokens: historyInfo.totalTokens,
      sessionContext: historyInfo.context
    };
  }

  /**
   * Obtém histórico da conversa atual
   */
  getConversationHistory() {
    return this.historyManager.exportHistory();
  }

  /**
   * Atualiza contexto da sessão
   */
  updateSessionContext(updates) {
    this.historyManager.updateSessionContext(updates);
    this.log('📝 Contexto da sessão atualizado:', updates);
  }

  /**
   * Força reconexão
   */
  forceReconnect() {
    this.log('Forçando reconexão...');
    
    if (this.ws) {
      this.ws.close(1000, 'Reconexão forçada');
    }
    
    this.reconnectAttempts = 0;
    setTimeout(() => this.connect(), 100);
  }

  /**
   * Desconecta permanentemente
   */
  disconnect() {
    this.log('Desconectando permanentemente...');
    
    // Para tentativas de reconexão
    this.config.maxReconnectAttempts = 0;
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.stopHeartbeat();
    this.clearMessageTimeouts();

    if (this.ws) {
      this.ws.close(1000, 'Desconexão intencional');
    }

    this.isConnected = false;
    this.isConnecting = false;
  }

  /**
   * Destrói o handler
   */
  destroy() {
    this.log('Destruindo MessageHandler...');
    
    this.disconnect();
    this.eventListeners.clear();
    this.messageQueue = [];
    this.pendingMessages.clear();
    
    // Finaliza sessão no gerenciador de histórico
    if (this.historyManager) {
      this.historyManager.endSession();
    }
    
    this.log('MessageHandler destruído');
  }
}