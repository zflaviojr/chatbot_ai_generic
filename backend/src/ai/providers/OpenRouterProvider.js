import OpenAI from 'openai';
import { BaseAIProvider } from './BaseAIProvider.js';
import logger from '../../utils/logger.js';

/**
 * Provedor OpenRouter para acesso a múltiplos modelos de IA
 * Usa a interface compatível com OpenAI
 */
export class OpenRouterProvider extends BaseAIProvider {
  constructor(config = {}) {
    super(config);
    this.providerName = 'openrouter';
    this.client = null;
    
    // Configuração específica do OpenRouter
    this.config = {
      apiKey: config.apiKey || process.env.OPENROUTER_API_KEY,
      baseURL: config.baseURL || process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
      model: config.model || 'meta-llama/llama-3.1-8b-instruct:free',
      maxTokens: parseInt(config.maxTokens || '1000'),
      temperature: parseFloat(config.temperature || '0.7'),
      systemPrompt: config.systemPrompt || 'Você é um assistente virtual útil e amigável.',
      timeout: config.timeout || 30000,
      // Headers específicos do OpenRouter
      httpReferer: config.httpReferer || 'http://localhost:3001',
      xTitle: config.xTitle || 'Chatbot Web MCP',
      ...config
    };
  }

  /**
   * Inicializa o cliente OpenRouter
   */
  async initialize() {
    try {
      this.validateConfig(['apiKey', 'model']);
      
      logger.info(`Inicializando provedor OpenRouter`, {
        model: this.config.model,
        baseURL: this.config.baseURL,
        apiKey: this.config.apiKey ? `${this.config.apiKey.substring(0, 7)}...` : 'NÃO CONFIGURADA'
      });

      // OpenRouter usa interface compatível com OpenAI
      this.client = new OpenAI({
        apiKey: this.config.apiKey,
        baseURL: this.config.baseURL,
        timeout: this.config.timeout,
        defaultHeaders: {
          'HTTP-Referer': this.config.httpReferer,
          'X-Title': this.config.xTitle
        }
      });

      // Testa a conexão
      await this.healthCheck();
      this.isConnected = true;
      
      logger.info('Provedor OpenRouter inicializado com sucesso');
      
    } catch (error) {
      logger.error('Erro ao inicializar provedor OpenRouter', { error: error.message });
      throw this.handleProviderError(error, 'Inicialização');
    }
  }

  /**
   * Verifica a saúde da conexão OpenRouter
   */
  async healthCheck() {
    try {
      if (!this.client) {
        throw new Error('Cliente OpenRouter não inicializado');
      }

      // OpenRouter suporta listagem de modelos
      const response = await this.client.models.list();
      
      if (response && response.data) {
        return {
          status: 'ok',
          timestamp: new Date().toISOString(),
          modelsAvailable: response.data.length,
          provider: this.providerName,
          currentModel: this.config.model
        };
      }
      
      throw new Error('Resposta inválida da API OpenRouter');
      
    } catch (error) {
      logger.error('Health check OpenRouter falhou', { error: error.message });
      throw this.handleProviderError(error, 'Health check');
    }
  }

  /**
   * Envia mensagem para o modelo via OpenRouter
   */
  async sendMessage(message, options = {}) {
    try {
      if (!this.isConnected || !this.client) {
        throw new Error('Provedor OpenRouter não está conectado');
      }

      if (!message || typeof message !== 'string' || message.trim().length === 0) {
        throw new Error('Mensagem inválida');
      }

      const startTime = Date.now();
      
      logger.info(`Enviando mensagem para OpenRouter`, {
        model: this.config.model,
        messageLength: message.length,
        sessionId: options.sessionId
      });

      // Prepara as mensagens
      const messages = [
        {
          role: 'system',
          content: options.systemPrompt || this.config.systemPrompt
        },
        {
          role: 'user',
          content: message.trim()
        }
      ];

      // Adiciona histórico se fornecido
      if (options.history && Array.isArray(options.history)) {
        console.log('📚 OpenRouter: Adicionando histórico:', options.history.length, 'mensagens');
        messages.splice(1, 0, ...options.history);
      } else {
        console.log('📚 OpenRouter: Sem histórico fornecido ou inválido:', typeof options.history);
      }

      // Prepara parâmetros da requisição
      const requestParams = {
        model: options.model || this.config.model,
        messages: messages,
        max_tokens: options.maxTokens || this.config.maxTokens,
        temperature: options.temperature || this.config.temperature,
        stream: false
      };

      // Adiciona parâmetros opcionais apenas se não forem null/undefined
      if (options.userId || options.sessionId) {
        requestParams.user = options.userId || options.sessionId;
      }

      // Log do payload final
      logger.info('Parâmetros da requisição OpenRouter:', JSON.stringify({
        model: requestParams.model,
        messages: requestParams.messages
      }));

      // Parâmetros específicos do OpenRouter (apenas se definidos)
      if (options.route) {
        requestParams.route = options.route;
      }

      logger.info('Parâmetros da requisição OpenRouter:', requestParams);

      // Faz a requisição
      const completion = await this.client.chat.completions.create(requestParams);

      const processingTime = Date.now() - startTime;

      // Processa a resposta
      const choice = completion.choices?.[0];
      if (!choice || !choice.message) {
        throw new Error('Resposta inválida da API OpenRouter');
      }

      // Verifica se o conteúdo existe
      const messageContent = choice.message?.content;
      if (!messageContent || typeof messageContent !== 'string') {
        throw new Error('Conteúdo da resposta está vazio ou inválido');
      }
      
      const rawResponse = {
        content: messageContent.trim(),
        model: completion.model || 'unknown',
        usage: {
          promptTokens: completion.usage?.prompt_tokens || 0,
          completionTokens: completion.usage?.completion_tokens || 0,
          totalTokens: completion.usage?.total_tokens || 0
        },
        finishReason: choice.finish_reason || 'unknown',
        processingTime,
        metadata: {
          provider: this.providerName,
          processingTime,
          finishReason: choice.finish_reason || 'unknown',
          // OpenRouter pode fornecer informações adicionais
          actualModel: completion.model || 'unknown',
          cost: completion.usage?.cost || 0
        }
      };

      logger.info(`Resposta OpenRouter recebida`, {
        responseLength: rawResponse.content ? rawResponse.content.length : 0,
        tokensUsed: rawResponse.usage ? rawResponse.usage.totalTokens : 0,
        processingTime,
        finishReason: rawResponse.finishReason,
        actualModel: completion.model,
        cost: completion.usage?.cost
      });

      // Validação final antes de retornar
      if (!rawResponse || typeof rawResponse !== 'object') {
        throw new Error('rawResponse inválido');
      }
      
      if (!rawResponse.content || typeof rawResponse.content !== 'string') {
        throw new Error('Conteúdo da resposta inválido');
      }
      
      return this.standardizeResponse(rawResponse, options.requestId, options.sessionId);

    } catch (error) {
      logger.error('Erro ao enviar mensagem para OpenRouter', {
        error: error.message,
        type: error.type,
        code: error.code
      });

      throw this.handleProviderError(error, 'Envio de mensagem');
    }
  }

  /**
   * Trata erros específicos do OpenRouter
   */
  handleProviderError(error, context = '') {
    logger.error('Erro detalhado do OpenRouter:', {
      message: error.message,
      status: error.status,
      code: error.code,
      type: error.type,
      response: error.response?.data
    });

    // Erros específicos do OpenRouter
    if (error.message.includes('credits') || error.message.includes('balance')) {
      const newError = new Error('Créditos do OpenRouter esgotados. Verifique seu saldo.');
      newError.type = 'quota_exceeded';
      newError.code = 'insufficient_credits';
      newError.provider = this.providerName;
      return newError;
    }
    
    if (error.message.includes('model not found') || error.message.includes('invalid model')) {
      const newError = new Error(`Modelo ${this.config.model} não encontrado no OpenRouter.`);
      newError.type = 'model_not_found';
      newError.code = 'model_not_found';
      newError.provider = this.providerName;
      return newError;
    }
    
    if (error.message.includes('rate limit') || error.status === 429) {
      const newError = new Error('Limite de taxa do OpenRouter excedido. Tente novamente em alguns segundos.');
      newError.type = 'rate_limit';
      newError.code = 'rate_limit_exceeded';
      newError.provider = this.providerName;
      return newError;
    }

    // Erro 400 - Bad Request
    if (error.status === 400 || error.message.includes('400')) {
      const newError = new Error(`Requisição inválida para OpenRouter: ${error.message}`);
      newError.type = 'invalid_request';
      newError.code = 'bad_request';
      newError.provider = this.providerName;
      return newError;
    }

    // Erro de autenticação
    if (error.status === 401 || error.message.includes('unauthorized')) {
      const newError = new Error('Chave de API do OpenRouter inválida ou expirada.');
      newError.type = 'invalid_api_key';
      newError.code = 'unauthorized';
      newError.provider = this.providerName;
      return newError;
    }

    // Usa o tratamento base para outros erros
    return super.handleProviderError(error, context);
  }

  /**
   * Lista modelos disponíveis no OpenRouter
   */
  async listModels() {
    try {
      if (!this.client) {
        throw new Error('Cliente OpenRouter não inicializado');
      }

      const response = await this.client.models.list();
      return response.data.map(model => ({
        id: model.id,
        name: model.name || model.id,
        provider: this.providerName,
        description: model.description,
        pricing: model.pricing,
        context_length: model.context_length,
        architecture: model.architecture,
        top_provider: model.top_provider
      }));

    } catch (error) {
      throw this.handleProviderError(error, 'Listagem de modelos');
    }
  }

  /**
   * Obtém informações específicas do modelo
   */
  async getModelInfo(modelId = null) {
    try {
      const models = await this.listModels();
      const targetModel = modelId || this.config.model;
      
      return models.find(model => model.id === targetModel) || null;

    } catch (error) {
      throw this.handleProviderError(error, 'Informações do modelo');
    }
  }

  /**
   * Obtém modelos gratuitos disponíveis
   */
  async getFreeModels() {
    try {
      const models = await this.listModels();
      return models.filter(model => 
        model.id.includes(':free') || 
        (model.pricing && model.pricing.prompt === 0)
      );

    } catch (error) {
      throw this.handleProviderError(error, 'Modelos gratuitos');
    }
  }
}