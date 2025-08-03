import { EventEmitter } from 'events';
import OpenAI from 'openai';
import logger from '../utils/logger.js';
import monitoring from '../utils/monitoring.js';
import { handleMCPError } from '../middleware/errorHandler.js';

/**
 * Gerenciador de conexão MCP para integração com ChatGPT
 * Implementa o protocolo MCP para comunicação com modelos de linguagem
 */
export class MCPConnectionManager extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      apiKey: config.apiKey || process.env.OPENAI_API_KEY,
      modelName: config.modelName || process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
      maxTokens: parseInt(config.maxTokens || process.env.OPENAI_MAX_TOKENS || '1000'),
      temperature: parseFloat(config.temperature || process.env.OPENAI_TEMPERATURE || '0.7'),
      timeout: config.timeout || 30000, // 30 segundos
      retryAttempts: config.retryAttempts || 3,
      retryDelay: config.retryDelay || 1000,
      systemPrompt: config.systemPrompt || process.env.OPENAI_SYSTEM_PROMPT || 'Você é um assistente virtual útil e amigável.'
    };

    this.isConnected = false;
    this.connectionAttempts = 0;
    this.activeRequests = new Map();
    this.openai = null;
    
    this.validateConfiguration();
    this.initializeOpenAI();
  }

  /**
   * Valida a configuração necessária para conexão OpenAI
   */
  validateConfiguration() {
    console.log('🔧 Validando configuração OpenAI...');
    console.log('🔧 Configuração recebida:', {
      apiKey: this.config.apiKey ? `${this.config.apiKey.substring(0, 7)}...` : 'AUSENTE',
      modelName: this.config.modelName,
      maxTokens: this.config.maxTokens,
      temperature: this.config.temperature
    });
    
    const requiredFields = ['apiKey', 'modelName'];
    const missingFields = requiredFields.filter(field => !this.config[field]);
    
    if (missingFields.length > 0) {
      console.error('❌ Campos obrigatórios ausentes:', missingFields);
      throw new Error(`Configuração OpenAI inválida. Campos obrigatórios ausentes: ${missingFields.join(', ')}`);
    }

    if (this.config.maxTokens <= 0 || this.config.maxTokens > 4000) {
      throw new Error('maxTokens deve estar entre 1 e 4000');
    }

    if (this.config.temperature < 0 || this.config.temperature > 2) {
      throw new Error('temperature deve estar entre 0 e 2');
    }

    // Valida se a chave API tem o formato correto
    if (!this.config.apiKey.startsWith('sk-')) {
      console.error('❌ Chave API inválida. Deve começar com "sk-"');
      throw new Error('Chave API OpenAI deve começar com "sk-"');
    }
    
    console.log('✅ Configuração OpenAI válida');
  }

  /**
   * Inicializa o cliente OpenAI
   */
  initializeOpenAI() {
    try {
      console.log('🔧 Inicializando cliente OpenAI...');
      console.log('🔧 API Key configurada:', this.config.apiKey ? `${this.config.apiKey.substring(0, 7)}...` : 'NÃO CONFIGURADA');
      console.log('🔧 Modelo:', this.config.modelName);
      
      this.openai = new OpenAI({
        apiKey: this.config.apiKey,
        timeout: this.config.timeout
      });
      
      console.log('✅ Cliente OpenAI inicializado com sucesso');
      logger.info('Cliente OpenAI inicializado com sucesso', {
        model: this.config.modelName,
        maxTokens: this.config.maxTokens,
        temperature: this.config.temperature
      });
      
    } catch (error) {
      console.error('❌ Erro ao inicializar cliente OpenAI:', error.message);
      logger.error('Erro ao inicializar cliente OpenAI', { error: error.message });
      throw error;
    }
  }

  /**
   * Estabelece conexão com a API OpenAI
   */
  async connect() {
    try {
      this.connectionAttempts++;
      logger.info(`Tentativa de conexão OpenAI #${this.connectionAttempts}`);

      // Testa a conexão fazendo uma requisição simples
      const response = await this.healthCheck();
      
      if (response.status === 'ok') {
        this.isConnected = true;
        this.connectionAttempts = 0;
        this.emit('connected');
        logger.info('Conexão OpenAI estabelecida com sucesso');
        return true;
      }
      
      throw new Error('API OpenAI não está respondendo adequadamente');
      
    } catch (error) {
      this.isConnected = false;
      this.emit('error', error);
      
      if (this.connectionAttempts < this.config.retryAttempts) {
        logger.warn(`Erro na conexão OpenAI: ${error.message}. Tentando novamente em ${this.config.retryDelay}ms...`);
        setTimeout(() => this.connect(), this.config.retryDelay);
      } else {
        logger.error(`Falha na conexão OpenAI após ${this.config.retryAttempts} tentativas`, { error: error.message });
        this.emit('connectionFailed', error);
      }
      
      return false;
    }
  }

  /**
   * Verifica a saúde da conexão OpenAI
   */
  async healthCheck() {
    try {
      // Faz uma requisição simples para testar a API
      const response = await this.openai.models.list();
      
      if (response && response.data) {
        return { 
          status: 'ok', 
          timestamp: new Date().toISOString(),
          modelsAvailable: response.data.length
        };
      }
      
      throw new Error('Resposta inválida da API OpenAI');
      
    } catch (error) {
      logger.error('Health check OpenAI falhou', { error: error.message });
      throw new Error(`Health check falhou: ${error.message}`);
    }
  }

  /**
   * Envia mensagem para o ChatGPT via OpenAI API
   */
  async sendMessage(message, sessionId = null) {
    if (!this.isConnected) {
      throw new Error('Conexão OpenAI não estabelecida');
    }

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      throw new Error('Mensagem inválida');
    }

    // Valida tamanho da mensagem
    if (message.length > 8000) {
      throw new Error('Mensagem muito longa. Máximo 8000 caracteres.');
    }

    const requestId = this.generateRequestId();
    const requestData = {
      id: requestId,
      sessionId,
      message: message.trim(),
      model: this.config.modelName,
      maxTokens: this.config.maxTokens,
      temperature: this.config.temperature,
      timestamp: new Date().toISOString()
    };

    try {
      // Adiciona à lista de requisições ativas
      const startTime = Date.now();
      this.activeRequests.set(requestId, {
        ...requestData,
        startTime
      });

      logger.info(`Enviando mensagem OpenAI [${requestId}]`, { 
        messagePreview: message.substring(0, 100),
        sessionId,
        model: this.config.modelName
      });

      // Faz a requisição real para OpenAI
      const response = await this.makeRequest(requestData);
      
      // Remove da lista de requisições ativas
      this.activeRequests.delete(requestId);
      
      // Track successful request
      const responseTime = Date.now() - startTime;
      monitoring.trackMCPRequest(true, responseTime);
      
      logger.info(`Resposta OpenAI recebida [${requestId}]`, { 
        responseTime,
        tokensUsed: response.usage.totalTokens
      });
      
      return response;

    } catch (error) {
      // Calcula tempo de resposta se possível
      const activeRequest = this.activeRequests.get(requestId);
      const responseTime = activeRequest ? Date.now() - activeRequest.startTime : 0;
      
      this.activeRequests.delete(requestId);
      
      // Track failed request
      monitoring.trackMCPRequest(false, responseTime);
      
      logger.error(`Erro ao enviar mensagem OpenAI [${requestId}]`, { 
        error: error.message,
        type: error.type,
        code: error.code
      });
      throw error;
    }
  }

  /**
   * Faz a requisição real para a API OpenAI
   */
  async makeRequest(requestData) {
    try {
      logger.info(`Enviando requisição para OpenAI [${requestData.id}]`, {
        model: requestData.model,
        messageLength: requestData.message.length,
        sessionId: requestData.sessionId
      });

      // Prepara as mensagens para o ChatGPT
      const messages = [
        {
          role: 'system',
          content: this.config.systemPrompt
        },
        {
          role: 'user',
          content: requestData.message
        }
      ];

      // Faz a requisição para a API OpenAI
      const completion = await this.openai.chat.completions.create({
        model: requestData.model,
        messages: messages,
        max_tokens: requestData.maxTokens,
        temperature: requestData.temperature,
        stream: false
      });

      // Processa a resposta
      const choice = completion.choices[0];
      if (!choice || !choice.message) {
        throw new Error('Resposta inválida da API OpenAI');
      }

      const response = {
        id: requestData.id,
        sessionId: requestData.sessionId,
        message: choice.message.content.trim(),
        model: completion.model,
        usage: {
          promptTokens: completion.usage?.prompt_tokens || 0,
          completionTokens: completion.usage?.completion_tokens || 0,
          totalTokens: completion.usage?.total_tokens || 0
        },
        finishReason: choice.finish_reason,
        timestamp: new Date().toISOString()
      };

      logger.info(`Resposta OpenAI recebida [${requestData.id}]`, {
        responseLength: response.message.length,
        tokensUsed: response.usage.totalTokens,
        finishReason: response.finishReason
      });

      return response;

    } catch (error) {
      logger.error(`Erro na requisição OpenAI [${requestData.id}]`, {
        error: error.message,
        type: error.type,
        code: error.code
      });

      // Verifica se deve usar fallback
      if (process.env.ENABLE_MOCK_RESPONSES === 'true' && this.shouldUseFallback(error)) {
        logger.info(`Usando resposta de fallback para [${requestData.id}]`);
        return this.generateMockResponse(requestData);
      }

      // Trata diferentes tipos de erro da OpenAI
      if (error.type === 'insufficient_quota') {
        throw new Error('Cota da API OpenAI esgotada. Verifique seu plano.');
      } else if (error.type === 'invalid_request_error') {
        throw new Error('Requisição inválida para a API OpenAI.');
      } else if (error.code === 'rate_limit_exceeded') {
        throw new Error('Limite de taxa da API OpenAI excedido. Tente novamente em alguns segundos.');
      } else if (error.code === 'model_not_found') {
        throw new Error(`Modelo ${requestData.model} não encontrado.`);
      } else {
        throw new Error(`Erro na API OpenAI: ${error.message}`);
      }
    }
  }

  /**
   * Verifica se deve usar fallback baseado no tipo de erro
   */
  shouldUseFallback(error) {
    const fallbackErrors = [
      'insufficient_quota',
      'rate_limit_exceeded',
      'service_unavailable',
      'timeout'
    ];
    
    return fallbackErrors.includes(error.type) || 
           fallbackErrors.includes(error.code) ||
           error.message.includes('quota') ||
           error.message.includes('rate limit');
  }

  /**
   * Gera resposta mock para desenvolvimento/fallback
   */
  generateMockResponse(requestData) {
    const mockResponses = [
      "Olá! Sou seu assistente virtual da clínica de estética. Como posso ajudá-la hoje? Temos diversos tratamentos disponíveis como Botox, Criolipólise, e muito mais!",
      "Que bom falar com você! Nossa clínica oferece os melhores tratamentos de estética facial e corporal. Gostaria de saber mais sobre algum procedimento específico?",
      "Oi! Fico feliz em atendê-la. Temos pacotes especiais com ótimos preços. Que tal agendar uma avaliação gratuita para conhecer melhor suas necessidades?",
      "Olá! Bem-vinda à nossa clínica! Somos especialistas em estética e temos tratamentos incríveis. Em que posso ajudá-la hoje?",
      "Oi! É um prazer falar com você. Nossa equipe está pronta para cuidar da sua beleza com os melhores tratamentos. O que gostaria de saber?"
    ];

    const randomResponse = mockResponses[Math.floor(Math.random() * mockResponses.length)];
    
    return {
      id: requestData.id,
      sessionId: requestData.sessionId,
      message: randomResponse,
      model: `${requestData.model} (mock)`,
      usage: {
        promptTokens: 50,
        completionTokens: 100,
        totalTokens: 150
      },
      finishReason: 'stop',
      timestamp: new Date().toISOString(),
      isMockResponse: true
    };
  }

  /**
   * Gera ID único para requisições
   */
  generateRequestId() {
    return `mcp_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Desconecta do servidor MCP
   */
  async disconnect() {
    try {
      // Cancela todas as requisições ativas
      for (const [requestId] of this.activeRequests) {
        logger.info(`Cancelando requisição ativa: ${requestId}`);
      }
      this.activeRequests.clear();

      this.isConnected = false;
      this.emit('disconnected');
      logger.info('Conexão MCP encerrada');
      
    } catch (error) {
      logger.error('Erro ao desconectar MCP', { error: error.message });
      throw error;
    }
  }

  /**
   * Retorna estatísticas da conexão
   */
  getStats() {
    return {
      isConnected: this.isConnected,
      activeRequests: this.activeRequests.size,
      connectionAttempts: this.connectionAttempts,
      config: {
        modelName: this.config.modelName,
        maxTokens: this.config.maxTokens,
        temperature: this.config.temperature,
        timeout: this.config.timeout
      }
    };
  }
}