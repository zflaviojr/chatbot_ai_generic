import OpenAI from 'openai';
import { BaseAIProvider } from './BaseAIProvider.js';
import logger from '../../utils/logger.js';

/**
 * Provedor OpenAI para integração com GPT models
 */
export class OpenAIProvider extends BaseAIProvider {
  constructor(config = {}) {
    super(config);
    this.providerName = 'openai';
    this.client = null;
    
    // Configuração específica do OpenAI
    this.config = {
      apiKey: config.apiKey || process.env.OPENAI_API_KEY,
      baseURL: config.baseURL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
      model: config.model || 'gpt-3.5-turbo',
      maxTokens: parseInt(config.maxTokens || '1000'),
      temperature: parseFloat(config.temperature || '0.7'),
      systemPrompt: config.systemPrompt || 'Você é um assistente virtual útil e amigável.',
      timeout: config.timeout || 30000,
      ...config
    };
  }

  /**
   * Inicializa o cliente OpenAI
   */
  async initialize() {
    try {
      this.validateConfig(['apiKey', 'model']);
      
      logger.info(`Inicializando provedor OpenAI`, {
        model: this.config.model,
        baseURL: this.config.baseURL,
        apiKey: this.config.apiKey ? `${this.config.apiKey.substring(0, 7)}...` : 'NÃO CONFIGURADA'
      });

      this.client = new OpenAI({
        apiKey: this.config.apiKey,
        baseURL: this.config.baseURL,
        timeout: this.config.timeout
      });

      // Testa a conexão
      await this.healthCheck();
      this.isConnected = true;
      
      logger.info('Provedor OpenAI inicializado com sucesso');
      
    } catch (error) {
      logger.error('Erro ao inicializar provedor OpenAI', { error: error.message });
      throw this.handleProviderError(error, 'Inicialização');
    }
  }

  /**
   * Verifica a saúde da conexão OpenAI
   */
  async healthCheck() {
    try {
      if (!this.client) {
        throw new Error('Cliente OpenAI não inicializado');
      }

      // Faz uma requisição simples para testar a API
      const response = await this.client.models.list();
      
      if (response && response.data) {
        return {
          status: 'ok',
          timestamp: new Date().toISOString(),
          modelsAvailable: response.data.length,
          provider: this.providerName
        };
      }
      
      throw new Error('Resposta inválida da API OpenAI');
      
    } catch (error) {
      logger.error('Health check OpenAI falhou', { error: error.message });
      throw this.handleProviderError(error, 'Health check');
    }
  }

  /**
   * Envia mensagem para o modelo OpenAI
   */
  async sendMessage(message, options = {}) {
    try {
      if (!this.isConnected || !this.client) {
        throw new Error('Provedor OpenAI não está conectado');
      }

      if (!message || typeof message !== 'string' || message.trim().length === 0) {
        throw new Error('Mensagem inválida');
      }

      const startTime = Date.now();
      
      logger.info(`Enviando mensagem para OpenAI`, {
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
        messages.splice(1, 0, ...options.history);
      }

      // Faz a requisição
      const completion = await this.client.chat.completions.create({
        model: options.model || this.config.model,
        messages: messages,
        max_tokens: options.maxTokens || this.config.maxTokens,
        temperature: options.temperature || this.config.temperature,
        stream: false,
        user: options.userId || options.sessionId
      });

      const processingTime = Date.now() - startTime;

      // Processa a resposta
      const choice = completion.choices[0];
      if (!choice || !choice.message) {
        throw new Error('Resposta inválida da API OpenAI');
      }

      const rawResponse = {
        content: choice.message.content.trim(),
        model: completion.model,
        usage: {
          promptTokens: completion.usage?.prompt_tokens || 0,
          completionTokens: completion.usage?.completion_tokens || 0,
          totalTokens: completion.usage?.total_tokens || 0
        },
        finishReason: choice.finish_reason,
        processingTime,
        metadata: {
          provider: this.providerName,
          processingTime,
          finishReason: choice.finish_reason
        }
      };

      logger.info(`Resposta OpenAI recebida`, {
        responseLength: rawResponse.content.length,
        tokensUsed: rawResponse.usage.totalTokens,
        processingTime,
        finishReason: rawResponse.finishReason
      });

      return this.standardizeResponse(rawResponse, options.requestId, options.sessionId);

    } catch (error) {
      logger.error('Erro ao enviar mensagem para OpenAI', {
        error: error.message,
        type: error.type,
        code: error.code
      });

      throw this.handleProviderError(error, 'Envio de mensagem');
    }
  }

  /**
   * Trata erros específicos do OpenAI
   */
  handleProviderError(error, context = '') {
    // Erros específicos do OpenAI
    if (error.type === 'insufficient_quota') {
      const newError = new Error('Cota da API OpenAI esgotada. Verifique seu plano.');
      newError.type = 'quota_exceeded';
      newError.code = 'insufficient_quota';
      newError.provider = this.providerName;
      return newError;
    }
    
    if (error.type === 'invalid_request_error') {
      const newError = new Error('Requisição inválida para a API OpenAI.');
      newError.type = 'invalid_request';
      newError.code = 'invalid_request_error';
      newError.provider = this.providerName;
      return newError;
    }
    
    if (error.code === 'rate_limit_exceeded') {
      const newError = new Error('Limite de taxa da API OpenAI excedido. Tente novamente em alguns segundos.');
      newError.type = 'rate_limit';
      newError.code = 'rate_limit_exceeded';
      newError.provider = this.providerName;
      return newError;
    }
    
    if (error.code === 'model_not_found') {
      const newError = new Error(`Modelo ${this.config.model} não encontrado no OpenAI.`);
      newError.type = 'model_not_found';
      newError.code = 'model_not_found';
      newError.provider = this.providerName;
      return newError;
    }

    // Usa o tratamento base para outros erros
    return super.handleProviderError(error, context);
  }

  /**
   * Lista modelos disponíveis
   */
  async listModels() {
    try {
      if (!this.client) {
        throw new Error('Cliente OpenAI não inicializado');
      }

      const response = await this.client.models.list();
      return response.data.map(model => ({
        id: model.id,
        name: model.id,
        provider: this.providerName,
        created: model.created
      }));

    } catch (error) {
      throw this.handleProviderError(error, 'Listagem de modelos');
    }
  }
}