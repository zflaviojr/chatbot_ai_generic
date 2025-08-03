/**
 * ConversationHistoryManager - Sistema simples e eficiente de gerenciamento de histórico
 * Mantém continuidade das conversas, gerencia tokens e persiste dados localmente
 */

export class ConversationHistoryManager {
  constructor(config = {}) {
    this.config = {
      maxTokens: config.maxTokens || 4000,
      reserveTokens: config.reserveTokens || 500,
      maxSessions: config.maxSessions || 10,
      storageKey: config.storageKey || 'chatbot_history',
      debug: config.debug || false,
      ...config
    };

    // Estado atual
    this.sessionId = null;
    this.messages = [];
    this.systemMessage = null;
    this.sessionContext = {};
    
    // Inicialização
    this.init();
  }

  /**
   * Inicializa o gerenciador
   */
  init() {
    this.log('Inicializando ConversationHistoryManager');
    
    // Tenta recuperar sessão ativa
    this.loadActiveSession();
    
    // Se não há sessão ativa, cria uma nova
    if (!this.sessionId) {
      this.startNewSession();
    }
    
    this.log(`Sessão ativa: ${this.sessionId}`);
  }

  /**
   * Inicia uma nova sessão
   */
  startNewSession(context = {}) {
    this.log('Iniciando nova sessão');
    
    // Gera ID único para a sessão
    this.sessionId = this.generateSessionId();
    this.messages = [];
    this.sessionContext = { ...context };
    
    // Gera system message baseado no contexto
    this.generateSystemMessage();
    
    // Salva nova sessão
    this.saveSession();
    this.setActiveSession(this.sessionId);
    
    this.log(`Nova sessão criada: ${this.sessionId}`);
    return this.sessionId;
  }

  /**
   * Adiciona mensagem do usuário
   */
  addUserMessage(content, metadata = {}) {
    const message = this.createMessage('user', content, metadata);
    this.messages.push(message);
    this.saveSession();
    
    this.log(`Mensagem do usuário adicionada: ${content.substring(0, 50)}...`);
    return message;
  }

  /**
   * Adiciona mensagem do assistente
   */
  addAssistantMessage(content, metadata = {}) {
    const message = this.createMessage('assistant', content, metadata);
    this.messages.push(message);
    this.saveSession();
    
    this.log(`Mensagem do assistente adicionada: ${content.substring(0, 50)}...`);
    return message;
  }

  /**
   * Cria objeto de mensagem padronizado
   */
  createMessage(role, content, metadata = {}) {
    return {
      id: this.generateMessageId(),
      sessionId: this.sessionId,
      role,
      content: content.trim(),
      timestamp: new Date().toISOString(),
      tokenCount: this.estimateTokens(content),
      metadata: {
        ...metadata
      }
    };
  }

  /**
   * Prepara histórico formatado para envio à API
   */
  prepareApiPayload(provider = 'openai') {
    this.log('Preparando payload para API');
    this.log(`Histórico atual tem ${this.messages.length} mensagens`);
    
    // Verifica e trunca se necessário
    const truncatedMessages = this.checkAndTruncateHistory();
    this.log(`Após truncamento: ${truncatedMessages.length} mensagens`);
    
    // Formata mensagens para a API
    const formattedMessages = this.formatMessagesForApi(truncatedMessages, provider);
    
    this.log(`Payload final preparado com ${formattedMessages.length} mensagens`);
    
    // Log detalhado para debug
    formattedMessages.forEach((msg, index) => {
      this.log(`Mensagem ${index}: ${msg.role} - ${msg.content.substring(0, 50)}...`);
    });
    
    return formattedMessages;
  }

  /**
   * Formata mensagens para diferentes provedores de API
   */
  formatMessagesForApi(messages, provider = 'openai') {
    const formatted = [];
    
    // NÃO inclui system message - será gerenciado pelo backend
    // System message vem do AI_SYSTEM_PROMPT do .env no backend
    
    // Adiciona apenas mensagens do histórico (user/assistant)
    messages.forEach(msg => {
      if (msg.role !== 'system') {
        // Corrige role "assistant" se estiver como "assistent"
        const role = msg.role === 'assistent' ? 'assistant' : msg.role;
        
        formatted.push({
          role: role,
          content: msg.content
        });
      }
    });
    
    this.log(`Mensagens formatadas para API: ${formatted.length} mensagens (sem system message)`);
    this.log('Payload formatado:', JSON.stringify(formatted, null, 2));
    
    return formatted;
  }

  /**
   * Verifica limites de tokens e trunca se necessário
   */
  checkAndTruncateHistory() {
    const totalTokens = this.calculateTotalTokens();
    const maxAllowed = this.config.maxTokens - this.config.reserveTokens;
    
    if (totalTokens <= maxAllowed) {
      return this.messages;
    }
    
    this.log(`Truncando histórico: ${totalTokens} > ${maxAllowed} tokens`);
    return this.truncateHistory(maxAllowed);
  }

  /**
   * Trunca histórico usando estratégia de janela deslizante
   */
  truncateHistory(maxTokens) {
    // System message agora é gerenciado pelo backend, usa todos os tokens disponíveis
    let availableTokens = maxTokens;
    
    // Mantém mensagens mais recentes
    const truncated = [];
    for (let i = this.messages.length - 1; i >= 0; i--) {
      const message = this.messages[i];
      if (availableTokens >= message.tokenCount) {
        truncated.unshift(message);
        availableTokens -= message.tokenCount;
      } else {
        break;
      }
    }
    
    this.log(`Histórico truncado: ${this.messages.length} -> ${truncated.length} mensagens`);
    return truncated;
  }

  /**
   * Calcula total de tokens no histórico
   */
  calculateTotalTokens() {
    // System message agora é gerenciado pelo backend, não conta nos tokens do frontend
    const messageTokens = this.messages.reduce((total, msg) => total + msg.tokenCount, 0);
    return messageTokens;
  }

  /**
   * Estimativa simples de tokens (aproximação por caracteres)
   */
  estimateTokens(text) {
    if (!text) return 0;
    // Aproximação: 1 token ≈ 4 caracteres para português
    return Math.ceil(text.length / 4);
  }

  /**
   * Gera system message baseado no contexto (REMOVIDO - agora usa AI_SYSTEM_PROMPT do backend)
   */
  generateSystemMessage() {
    // System message agora é gerenciado pelo backend usando AI_SYSTEM_PROMPT
    // Não geramos mais system message no frontend
    this.systemMessage = null;
    this.log('System message será gerenciado pelo backend via AI_SYSTEM_PROMPT');
  }

  /**
   * Atualiza contexto da sessão
   */
  updateSessionContext(updates) {
    this.sessionContext = { ...this.sessionContext, ...updates };
    this.generateSystemMessage(); // Regenera system message
    this.saveSession();
    
    this.log('Contexto da sessão atualizado:', updates);
  }

  /**
   * Salva sessão no localStorage
   */
  saveSession() {
    try {
      const sessionData = {
        id: this.sessionId,
        messages: this.messages,
        systemMessage: this.systemMessage,
        context: this.sessionContext,
        createdAt: this.getSessionCreatedAt(),
        updatedAt: new Date().toISOString()
      };
      
      const key = `${this.config.storageKey}_${this.sessionId}`;
      localStorage.setItem(key, JSON.stringify(sessionData));
      
      // Atualiza lista de sessões
      this.updateSessionsList();
      
    } catch (error) {
      this.log('Erro ao salvar sessão:', error);
      // Continua funcionando apenas em memória
    }
  }

  /**
   * Carrega sessão do localStorage
   */
  loadSession(sessionId) {
    try {
      const key = `${this.config.storageKey}_${sessionId}`;
      const data = localStorage.getItem(key);
      
      if (!data) {
        this.log(`Sessão ${sessionId} não encontrada`);
        return false;
      }
      
      const sessionData = JSON.parse(data);
      
      this.sessionId = sessionData.id;
      this.messages = sessionData.messages || [];
      this.systemMessage = sessionData.systemMessage;
      this.sessionContext = sessionData.context || {};
      
      this.log(`Sessão ${sessionId} carregada com ${this.messages.length} mensagens`);
      return true;
      
    } catch (error) {
      this.log('Erro ao carregar sessão:', error);
      return false;
    }
  }

  /**
   * Carrega sessão ativa (última usada)
   */
  loadActiveSession() {
    try {
      const activeSessionId = localStorage.getItem(`${this.config.storageKey}_active`);
      if (activeSessionId) {
        return this.loadSession(activeSessionId);
      }
    } catch (error) {
      this.log('Erro ao carregar sessão ativa:', error);
    }
    return false;
  }

  /**
   * Define sessão como ativa
   */
  setActiveSession(sessionId) {
    try {
      localStorage.setItem(`${this.config.storageKey}_active`, sessionId);
    } catch (error) {
      this.log('Erro ao definir sessão ativa:', error);
    }
  }

  /**
   * Atualiza lista de sessões para limpeza
   */
  updateSessionsList() {
    try {
      const sessions = this.getSessionsList();
      
      // Adiciona sessão atual se não existir
      if (!sessions.includes(this.sessionId)) {
        sessions.push(this.sessionId);
      }
      
      // Mantém apenas as mais recentes
      if (sessions.length > this.config.maxSessions) {
        const toRemove = sessions.slice(0, sessions.length - this.config.maxSessions);
        toRemove.forEach(id => this.deleteSession(id));
        sessions.splice(0, toRemove.length);
      }
      
      localStorage.setItem(`${this.config.storageKey}_sessions`, JSON.stringify(sessions));
      
    } catch (error) {
      this.log('Erro ao atualizar lista de sessões:', error);
    }
  }

  /**
   * Obtém lista de sessões
   */
  getSessionsList() {
    try {
      const data = localStorage.getItem(`${this.config.storageKey}_sessions`);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      this.log('Erro ao obter lista de sessões:', error);
      return [];
    }
  }

  /**
   * Deleta sessão
   */
  deleteSession(sessionId) {
    try {
      const key = `${this.config.storageKey}_${sessionId}`;
      localStorage.removeItem(key);
      this.log(`Sessão ${sessionId} deletada`);
    } catch (error) {
      this.log('Erro ao deletar sessão:', error);
    }
  }

  /**
   * Limpa histórico atual
   */
  clearHistory() {
    this.messages = [];
    this.saveSession();
    this.log('Histórico limpo');
  }

  /**
   * Finaliza sessão atual
   */
  endSession() {
    this.log(`Finalizando sessão ${this.sessionId}`);
    
    // Remove como sessão ativa
    try {
      localStorage.removeItem(`${this.config.storageKey}_active`);
    } catch (error) {
      this.log('Erro ao remover sessão ativa:', error);
    }
    
    // Reset estado
    this.sessionId = null;
    this.messages = [];
    this.systemMessage = null;
    this.sessionContext = {};
  }

  /**
   * Obtém data de criação da sessão
   */
  getSessionCreatedAt() {
    if (this.messages.length > 0) {
      return this.messages[0].timestamp;
    }
    return new Date().toISOString();
  }

  /**
   * Gera ID único para sessão
   */
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Gera ID único para mensagem
   */
  generateMessageId() {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Log de debug
   */
  log(...args) {
    if (this.config.debug) {
      console.log('[ConversationHistoryManager]', ...args);
    }
  }

  /**
   * Obtém informações da sessão atual
   */
  getSessionInfo() {
    return {
      sessionId: this.sessionId,
      messageCount: this.messages.length,
      totalTokens: this.calculateTotalTokens(),
      context: this.sessionContext,
      systemMessage: this.systemMessage,
      createdAt: this.getSessionCreatedAt(),
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Exporta histórico para debugging
   */
  exportHistory() {
    return {
      session: this.getSessionInfo(),
      messages: this.messages,
      formattedForApi: this.prepareApiPayload()
    };
  }
}