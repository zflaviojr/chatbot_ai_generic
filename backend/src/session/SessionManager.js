import { EventEmitter } from 'events';
import logger from '../utils/logger.js';

/**
 * Gerenciador de sessões de chat
 * Mantém o contexto das conversas e controla o ciclo de vida das sessões
 */
export class SessionManager extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      maxHistoryLength: config.maxHistoryLength || 20, // Máximo de mensagens no histórico
      sessionTimeout: config.sessionTimeout || 30 * 60 * 1000, // 30 minutos
      maxSessions: config.maxSessions || 1000, // Máximo de sessões ativas
      ...config
    };

    this.sessions = new Map(); // sessionId -> sessionData
    this.sessionTimeouts = new Map(); // sessionId -> timeoutId
    
    // Limpa sessões expiradas a cada 5 minutos
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, 5 * 60 * 1000);

    logger.info('SessionManager inicializado', {
      maxHistoryLength: this.config.maxHistoryLength,
      sessionTimeout: this.config.sessionTimeout,
      maxSessions: this.config.maxSessions
    });
  }

  /**
   * Cria uma nova sessão
   */
  createSession(clientId = null) {
    const sessionId = this.generateSessionId();
    const now = new Date();
    
    const sessionData = {
      id: sessionId,
      clientId: clientId,
      createdAt: now,
      lastActivity: now,
      status: 'active', // active, paused, ended
      messageHistory: [],
      context: {
        customerName: null,
        customerInfo: {},
        currentTopic: null,
        stage: 'greeting', // greeting, information_gathering, service_discussion, closing
        preferences: {}
      },
      metadata: {
        messageCount: 0,
        totalTokens: 0,
        averageResponseTime: 0
      }
    };

    // Verifica limite de sessões
    if (this.sessions.size >= this.config.maxSessions) {
      this.cleanupOldestSessions(10); // Remove 10 sessões mais antigas
    }

    this.sessions.set(sessionId, sessionData);
    this.resetSessionTimeout(sessionId);

    logger.info('Nova sessão criada', {
      sessionId,
      clientId,
      totalSessions: this.sessions.size
    });

    this.emit('sessionCreated', sessionData);
    return sessionData;
  }

  /**
   * Obtém dados da sessão
   */
  getSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.updateLastActivity(sessionId);
    }
    return session;
  }

  /**
   * Adiciona mensagem ao histórico da sessão
   */
  addMessage(sessionId, message) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      logger.warn('Tentativa de adicionar mensagem a sessão inexistente', { sessionId });
      return false;
    }

    const messageData = {
      id: this.generateMessageId(),
      role: message.role, // 'user' ou 'assistant'
      content: message.content,
      timestamp: new Date(),
      tokens: message.tokens || 0,
      metadata: message.metadata || {}
    };

    session.messageHistory.push(messageData);
    session.metadata.messageCount++;
    session.metadata.totalTokens += messageData.tokens;

    // Mantém apenas as últimas N mensagens
    if (session.messageHistory.length > this.config.maxHistoryLength) {
      const removed = session.messageHistory.splice(0, session.messageHistory.length - this.config.maxHistoryLength);
      logger.debug('Mensagens antigas removidas do histórico', {
        sessionId,
        removedCount: removed.length
      });
    }

    this.updateLastActivity(sessionId);
    this.resetSessionTimeout(sessionId);

    // Atualiza contexto baseado na mensagem
    this.updateSessionContext(sessionId, messageData);

    logger.debug('Mensagem adicionada ao histórico', {
      sessionId,
      role: messageData.role,
      contentLength: messageData.content.length,
      historyLength: session.messageHistory.length
    });

    this.emit('messageAdded', { sessionId, message: messageData });
    return messageData;
  }

  /**
   * Obtém histórico de mensagens formatado para IA
   */
  getFormattedHistory(sessionId, includeSystem = true) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return [];
    }

    const messages = [];

    // Adiciona prompt de sistema com contexto se solicitado
    if (includeSystem) {
      messages.push({
        role: 'system',
        content: this.buildSystemPrompt(session)
      });
    }

    // Adiciona histórico de mensagens
    session.messageHistory.forEach(msg => {
      messages.push({
        role: msg.role,
        content: msg.content
      });
    });

    return messages;
  }

  /**
   * Constrói prompt de sistema com contexto da sessão
   */
  buildSystemPrompt(session) {
    const basePrompt = process.env.AI_SYSTEM_PROMPT || 'Você é um assistente virtual útil e amigável.';
    
    let contextPrompt = basePrompt;

    // Adiciona informações do cliente se disponível
    if (session.context.customerName) {
      contextPrompt += `\n\nInformações do cliente atual:`;
      contextPrompt += `\n- Nome: ${session.context.customerName}`;
      
      if (Object.keys(session.context.customerInfo).length > 0) {
        Object.entries(session.context.customerInfo).forEach(([key, value]) => {
          contextPrompt += `\n- ${key}: ${value}`;
        });
      }
    }

    // Adiciona contexto do estágio da conversa
    const stageInstructions = {
      greeting: 'Você está no início do atendimento. Seja caloroso e descubra como pode ajudar.',
      information_gathering: 'Você está coletando informações do cliente. Faça perguntas relevantes para entender suas necessidades.',
      service_discussion: 'Você está discutindo serviços específicos. Seja detalhado sobre preços e benefícios.',
      closing: 'Você está finalizando o atendimento. Confirme próximos passos e agradeça.'
    };

    if (stageInstructions[session.context.stage]) {
      contextPrompt += `\n\nEstágio atual do atendimento: ${stageInstructions[session.context.stage]}`;
    }

    // Adiciona tópico atual se disponível
    if (session.context.currentTopic) {
      contextPrompt += `\n\nTópico atual da conversa: ${session.context.currentTopic}`;
    }

    // Adiciona comandos especiais
    contextPrompt += `\n\nComandos especiais disponíveis:`;
    contextPrompt += `\n- Se o cliente disser "finalizar atendimento" ou "encerrar", finalize educadamente e informe que um novo atendimento pode ser iniciado.`;
    contextPrompt += `\n- Se o cliente disser "novo atendimento", trate como um novo cliente.`;

    return contextPrompt;
  }

  /**
   * Atualiza contexto da sessão baseado na mensagem
   */
  updateSessionContext(sessionId, message) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const content = message.content.toLowerCase();

    // Detecta nome do cliente
    if (message.role === 'user' && !session.context.customerName) {
      const namePatterns = [
        /(?:me chamo|meu nome é|sou (?:a |o )?|eu sou (?:a |o )?)([\w\s]+)/i,
        /(?:nome|chamo)(?:\s+é|\s+:)?\s+([\w\s]+)/i
      ];

      for (const pattern of namePatterns) {
        const match = message.content.match(pattern);
        if (match && match[1]) {
          const name = match[1].trim().split(' ')[0]; // Pega apenas o primeiro nome
          if (name.length > 1 && name.length < 20) {
            session.context.customerName = name;
            logger.info('Nome do cliente detectado', { sessionId, customerName: name });
            break;
          }
        }
      }
    }

    // Detecta informações do cliente
    const infoPatterns = {
      telefone: /(?:telefone|whatsapp|contato)(?:\s+é|\s+:)?\s*(\d{10,11})/i,
      idade: /(?:tenho|idade)(?:\s+é|\s+:)?\s*(\d{1,2})\s*anos?/i,
      peso: /(?:peso|quilos?)(?:\s+é|\s+:)?\s*(\d{2,3})\s*k?g?/i,
      altura: /(?:altura|metro)(?:\s+é|\s+:)?\s*(\d{1}\.\d{2}|\d{3})/i
    };

    if (message.role === 'user') {
      Object.entries(infoPatterns).forEach(([key, pattern]) => {
        const match = message.content.match(pattern);
        if (match && match[1]) {
          session.context.customerInfo[key] = match[1];
          logger.debug('Informação do cliente detectada', { sessionId, key, value: match[1] });
        }
      });
    }

    // Detecta tópicos de interesse
    const topics = {
      'botox': ['botox', 'rugas', 'expressão'],
      'emagrecimento': ['emagrecer', 'perder peso', 'gordura'],
      'criolipólise': ['criolipólise', 'gordura localizada'],
      'estrias': ['estrias', 'marca'],
      'vasinhos': ['vasinhos', 'varizes', 'veias'],
      'limpeza': ['limpeza de pele', 'acne', 'cravos']
    };

    if (message.role === 'user') {
      Object.entries(topics).forEach(([topic, keywords]) => {
        if (keywords.some(keyword => content.includes(keyword))) {
          session.context.currentTopic = topic;
          session.context.stage = 'service_discussion';
          logger.debug('Tópico detectado', { sessionId, topic });
        }
      });
    }

    // Detecta comandos especiais
    if (message.role === 'user') {
      if (content.includes('finalizar') || content.includes('encerrar') || content.includes('tchau')) {
        session.context.stage = 'closing';
      } else if (content.includes('novo atendimento')) {
        this.resetSessionContext(sessionId);
      }
    }
  }

  /**
   * Reseta o contexto da sessão (novo atendimento)
   */
  resetSessionContext(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.context = {
      customerName: null,
      customerInfo: {},
      currentTopic: null,
      stage: 'greeting',
      preferences: {}
    };

    // Limpa histórico
    session.messageHistory = [];
    session.metadata.messageCount = 0;

    logger.info('Contexto da sessão resetado', { sessionId });
    this.emit('sessionReset', { sessionId });
  }

  /**
   * Finaliza uma sessão
   */
  endSession(sessionId, reason = 'manual') {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    session.status = 'ended';
    session.endedAt = new Date();
    session.endReason = reason;

    // Remove timeout
    const timeoutId = this.sessionTimeouts.get(sessionId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.sessionTimeouts.delete(sessionId);
    }

    logger.info('Sessão finalizada', {
      sessionId,
      reason,
      duration: session.endedAt - session.createdAt,
      messageCount: session.metadata.messageCount
    });

    this.emit('sessionEnded', session);

    // Remove da memória após um tempo
    setTimeout(() => {
      this.sessions.delete(sessionId);
    }, 5 * 60 * 1000); // 5 minutos

    return true;
  }

  /**
   * Atualiza última atividade da sessão
   */
  updateLastActivity(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = new Date();
    }
  }

  /**
   * Reseta timeout da sessão
   */
  resetSessionTimeout(sessionId) {
    // Remove timeout existente
    const existingTimeout = this.sessionTimeouts.get(sessionId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Cria novo timeout
    const timeoutId = setTimeout(() => {
      logger.info('Sessão expirada por inatividade', { sessionId });
      this.endSession(sessionId, 'timeout');
    }, this.config.sessionTimeout);

    this.sessionTimeouts.set(sessionId, timeoutId);
  }

  /**
   * Limpa sessões expiradas
   */
  cleanupExpiredSessions() {
    const now = new Date();
    let cleanedCount = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      const timeSinceLastActivity = now - session.lastActivity;
      
      if (timeSinceLastActivity > this.config.sessionTimeout) {
        this.endSession(sessionId, 'expired');
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info('Sessões expiradas limpas', { count: cleanedCount });
    }
  }

  /**
   * Remove sessões mais antigas
   */
  cleanupOldestSessions(count) {
    const sessions = Array.from(this.sessions.entries())
      .sort(([,a], [,b]) => a.lastActivity - b.lastActivity)
      .slice(0, count);

    sessions.forEach(([sessionId]) => {
      this.endSession(sessionId, 'cleanup');
    });

    logger.info('Sessões antigas removidas', { count: sessions.length });
  }

  /**
   * Obtém estatísticas das sessões
   */
  getStats() {
    const activeSessions = Array.from(this.sessions.values()).filter(s => s.status === 'active');
    
    return {
      totalSessions: this.sessions.size,
      activeSessions: activeSessions.length,
      averageMessageCount: activeSessions.reduce((sum, s) => sum + s.metadata.messageCount, 0) / activeSessions.length || 0,
      averageSessionDuration: activeSessions.reduce((sum, s) => sum + (new Date() - s.createdAt), 0) / activeSessions.length || 0
    };
  }

  /**
   * Gera ID único para sessão
   */
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Gera ID único para mensagem
   */
  generateMessageId() {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Destrói o gerenciador
   */
  destroy() {
    // Limpa interval de limpeza
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Limpa todos os timeouts
    for (const timeoutId of this.sessionTimeouts.values()) {
      clearTimeout(timeoutId);
    }

    // Finaliza todas as sessões ativas
    for (const sessionId of this.sessions.keys()) {
      this.endSession(sessionId, 'shutdown');
    }

    this.sessions.clear();
    this.sessionTimeouts.clear();

    logger.info('SessionManager destruído');
  }
}