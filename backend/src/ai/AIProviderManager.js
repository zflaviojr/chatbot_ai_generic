import { OpenAIProvider } from './providers/OpenAIProvider.js';
import { OpenRouterProvider } from './providers/OpenRouterProvider.js';
import { MockProvider } from './providers/MockProvider.js';
import logger from '../utils/logger.js';

/**
 * Gerenciador de provedores de IA
 * Responsável por inicializar e gerenciar diferentes provedores de IA
 */
export class AIProviderManager {
  constructor(config = {}) {
    this.config = {
      provider: config.provider || process.env.AI_PROVIDER || 'openai',
      model: config.model || process.env.AI_MODEL,
      maxTokens: parseInt(config.maxTokens || process.env.AI_MAX_TOKENS || '1000'),
      temperature: parseFloat(config.temperature || process.env.AI_TEMPERATURE || '0.7'),
      systemPrompt: config.systemPrompt || process.env.AI_SYSTEM_PROMPT || 'Você é um assistente virtual útil e amigável.',
      ...config
    };

    this.currentProvider = null;
    this.availableProviders = new Map();
    this.isInitialized = false;
  }

  /**
   * Inicializa o gerenciador e o provedor selecionado
   */
  async initialize() {
    try {
      logger.info('Inicializando AIProviderManager', {
        provider: this.config.provider,
        model: this.config.model
      });

      // Registra todos os provedores disponíveis
      this.registerProviders();

      // Inicializa o provedor selecionado
      await this.initializeProvider(this.config.provider);

      this.isInitialized = true;
      logger.info('AIProviderManager inicializado com sucesso', {
        activeProvider: this.currentProvider?.providerName,
        isConnected: this.currentProvider?.isConnected
      });

    } catch (error) {
      logger.error('Erro ao inicializar AIProviderManager', { error: error.message });
      
      // Fallback para mock se nenhum provedor funcionar
      logger.warn('Tentando fallback para provedor mock');
      await this.initializeProvider('mock');
      this.isInitialized = true;
    }
  }

  /**
   * Registra todos os provedores disponíveis
   */
  registerProviders() {
    // OpenAI
    this.availableProviders.set('openai', {
      class: OpenAIProvider,
      config: {
        apiKey: process.env.OPENAI_API_KEY,
        baseURL: process.env.OPENAI_BASE_URL,
        model: this.config.model || 'gpt-3.5-turbo',
        maxTokens: this.config.maxTokens,
        temperature: this.config.temperature,
        systemPrompt: this.config.systemPrompt
      }
    });

    // OpenRouter
    this.availableProviders.set('openrouter', {
      class: OpenRouterProvider,
      config: {
        apiKey: process.env.OPENROUTER_API_KEY,
        baseURL: process.env.OPENROUTER_BASE_URL,
        model: this.config.model || 'z-ai/glm-4.5-air:free',
        maxTokens: this.config.maxTokens,
        temperature: this.config.temperature,
        systemPrompt: this.config.systemPrompt,
        httpReferer: process.env.HTTP_REFERER || 'http://localhost:3001',
        xTitle: process.env.X_TITLE || 'Chatbot Web MCP'
      }
    });

    // Mock (fallback)
    this.availableProviders.set('mock', {
      class: MockProvider,
      config: {
        model: 'mock-model',
        maxTokens: this.config.maxTokens,
        temperature: this.config.temperature,
        systemPrompt: this.config.systemPrompt
      }
    });

    logger.info('Provedores registrados', {
      providers: Array.from(this.availableProviders.keys())
    });
  }

  /**
   * Inicializa um provedor específico
   */
  async initializeProvider(providerName) {
    try {
      const providerInfo = this.availableProviders.get(providerName);
      
      if (!providerInfo) {
        throw new Error(`Provedor '${providerName}' não encontrado`);
      }

      logger.info(`Inicializando provedor: ${providerName}`);

      // Cria instância do provedor
      const ProviderClass = providerInfo.class;
      const provider = new ProviderClass(providerInfo.config);

      // Inicializa o provedor
      await provider.initialize();

      // Define como provedor atual
      this.currentProvider = provider;

      logger.info(`Provedor ${providerName} inicializado com sucesso`);

    } catch (error) {
      logger.error(`Erro ao inicializar provedor ${providerName}`, { error: error.message });
      throw error;
    }
  }

  /**
   * Troca o provedor ativo
   */
  async switchProvider(providerName) {
    try {
      if (this.currentProvider?.providerName === providerName) {
        logger.info(`Provedor ${providerName} já está ativo`);
        return;
      }

      logger.info(`Trocando provedor para: ${providerName}`);

      // Desconecta provedor atual
      if (this.currentProvider) {
        await this.currentProvider.disconnect();
      }

      // Inicializa novo provedor
      await this.initializeProvider(providerName);

      logger.info(`Provedor trocado com sucesso para: ${providerName}`);

    } catch (error) {
      logger.error(`Erro ao trocar provedor para ${providerName}`, { error: error.message });
      throw error;
    }
  }

  /**
   * Envia mensagem usando o provedor ativo
   */
  async sendMessage(message, options = {}) {
    if (!this.isInitialized || !this.currentProvider) {
      throw new Error('AIProviderManager não está inicializado');
    }

    try {
      // Adiciona ID da requisição se não fornecido
      if (!options.requestId) {
        options.requestId = this.generateRequestId();
      }

      logger.info(`Enviando mensagem via ${this.currentProvider.providerName}`, {
        requestId: options.requestId,
        messageLength: message.length,
        sessionId: options.sessionId,
        hasHistory: Array.isArray(options.history) && options.history.length > 0,
        historyLength: Array.isArray(options.history) ? options.history.length : 0
      });

      const response = await this.currentProvider.sendMessage(message, options);

      // Validação da resposta
      if (!response || typeof response !== 'object') {
        throw new Error('Resposta inválida do provedor de IA');
      }
      
      if (!response.message || typeof response.message !== 'string') {
        throw new Error('Conteúdo da mensagem inválido na resposta do provedor');
      }

      logger.info(`Resposta recebida de ${this.currentProvider.providerName}`, {
        requestId: options.requestId,
        responseLength: response.message.length,
        tokensUsed: response.usage ? response.usage.totalTokens : 0
      });

      return response;

    } catch (error) {
      logger.error(`Erro ao enviar mensagem via ${this.currentProvider.providerName}`, {
        error: error.message,
        type: error.type,
        code: error.code
      });

      // Tenta fallback automático se configurado
      if (this.shouldTryFallback(error)) {
        return await this.tryFallback(message, options, error);
      }

      throw error;
    }
  }

  /**
   * Verifica se deve tentar fallback
   */
  shouldTryFallback(error) {
    const fallbackErrors = [
      'quota_exceeded',
      'rate_limit_exceeded',
      'service_unavailable',
      'timeout',
      'model_not_found'
    ];

    return fallbackErrors.includes(error.type) || fallbackErrors.includes(error.code);
  }

  /**
   * Tenta fallback para outro provedor
   */
  async tryFallback(message, options, originalError) {
    logger.warn('Tentando fallback devido ao erro', {
      originalProvider: this.currentProvider.providerName,
      error: originalError.message
    });

    // Lista de provedores para tentar como fallback
    const fallbackOrder = ['openrouter', 'openai'];
    const currentProvider = this.currentProvider.providerName;

    for (const providerName of fallbackOrder) {
      if (providerName === currentProvider) continue;

      try {
        logger.info(`Tentando fallback para: ${providerName}`);
        
        // Temporariamente troca o provedor
        const originalProvider = this.currentProvider;
        await this.initializeProvider(providerName);
        
        // Tenta enviar a mensagem
        const response = await this.currentProvider.sendMessage(message, options);
        
        logger.info(`Fallback para ${providerName} bem-sucedido`);
        return response;

      } catch (fallbackError) {
        logger.warn(`Fallback para ${providerName} falhou`, {
          error: fallbackError.message
        });
        continue;
      }
    }

    // Se todos os fallbacks falharam, usa mock
    logger.error('Todos os provedores falharam, usando mock');
    await this.initializeProvider('mock');
    return await this.currentProvider.sendMessage(message, options);
  }

  /**
   * Verifica a saúde do provedor ativo
   */
  async healthCheck() {
    if (!this.currentProvider) {
      throw new Error('Nenhum provedor ativo');
    }

    return await this.currentProvider.healthCheck();
  }

  /**
   * Lista todos os provedores disponíveis
   */
  getAvailableProviders() {
    return Array.from(this.availableProviders.keys());
  }

  /**
   * Obtém informações do provedor ativo
   */
  getCurrentProviderInfo() {
    if (!this.currentProvider) {
      return null;
    }

    return this.currentProvider.getProviderInfo();
  }

  /**
   * Lista modelos disponíveis do provedor ativo
   */
  async listModels() {
    if (!this.currentProvider || typeof this.currentProvider.listModels !== 'function') {
      throw new Error('Provedor atual não suporta listagem de modelos');
    }

    return await this.currentProvider.listModels();
  }

  /**
   * Obtém estatísticas do gerenciador
   */
  getStats() {
    return {
      isInitialized: this.isInitialized,
      currentProvider: this.currentProvider?.providerName || null,
      isConnected: this.currentProvider?.isConnected || false,
      availableProviders: this.getAvailableProviders(),
      config: {
        provider: this.config.provider,
        model: this.config.model,
        maxTokens: this.config.maxTokens,
        temperature: this.config.temperature
      }
    };
  }

  /**
   * Gera ID único para requisições
   */
  generateRequestId() {
    return `ai_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Desconecta todos os provedores
   */
  async disconnect() {
    if (this.currentProvider) {
      await this.currentProvider.disconnect();
      this.currentProvider = null;
    }

    this.isInitialized = false;
    logger.info('AIProviderManager desconectado');
  }
}