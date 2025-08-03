/**
 * Interface base para provedores de IA
 * Define a estrutura comum que todos os provedores devem implementar
 */
export class BaseAIProvider {
  constructor(config = {}) {
    this.config = config;
    this.isConnected = false;
    this.providerName = 'base';
  }

  /**
   * Inicializa o provedor
   * @returns {Promise<void>}
   */
  async initialize() {
    throw new Error('initialize() deve ser implementado pela classe filha');
  }

  /**
   * Verifica se o provedor está conectado
   * @returns {Promise<boolean>}
   */
  async healthCheck() {
    throw new Error('healthCheck() deve ser implementado pela classe filha');
  }

  /**
   * Envia mensagem para o modelo de IA
   * @param {string} message - Mensagem do usuário
   * @param {Object} options - Opções adicionais
   * @returns {Promise<Object>} Resposta padronizada
   */
  async sendMessage(message, options = {}) {
    throw new Error('sendMessage() deve ser implementado pela classe filha');
  }

  /**
   * Desconecta do provedor
   * @returns {Promise<void>}
   */
  async disconnect() {
    this.isConnected = false;
  }

  /**
   * Retorna informações sobre o provedor
   * @returns {Object}
   */
  getProviderInfo() {
    return {
      name: this.providerName,
      isConnected: this.isConnected,
      config: {
        model: this.config.model,
        maxTokens: this.config.maxTokens,
        temperature: this.config.temperature
      }
    };
  }

  /**
   * Padroniza a resposta para o formato esperado pelo sistema
   * @param {Object} rawResponse - Resposta bruta do provedor
   * @param {string} requestId - ID da requisição
   * @param {string} sessionId - ID da sessão
   * @returns {Object} Resposta padronizada
   */
  standardizeResponse(rawResponse, requestId, sessionId) {
    return {
      id: requestId,
      sessionId: sessionId,
      message: rawResponse.content || rawResponse.message || '',
      model: rawResponse.model || this.config.model,
      provider: this.providerName,
      usage: {
        promptTokens: rawResponse.usage?.prompt_tokens || rawResponse.usage?.promptTokens || 0,
        completionTokens: rawResponse.usage?.completion_tokens || rawResponse.usage?.completionTokens || 0,
        totalTokens: rawResponse.usage?.total_tokens || rawResponse.usage?.totalTokens || 0
      },
      finishReason: rawResponse.finish_reason || rawResponse.finishReason || 'stop',
      timestamp: new Date().toISOString(),
      metadata: {
        provider: this.providerName,
        processingTime: rawResponse.processingTime || 0,
        ...rawResponse.metadata
      }
    };
  }

  /**
   * Valida a configuração do provedor
   * @param {Array} requiredFields - Campos obrigatórios
   * @throws {Error} Se algum campo obrigatório estiver ausente
   */
  validateConfig(requiredFields = []) {
    const missingFields = requiredFields.filter(field => {
      const value = this.config[field];
      return !value || value === 'YOUR_API_KEY_HERE' || value === 'YOUR_OPENROUTER_API_KEY_HERE' || value === 'YOUR_ANTHROPIC_API_KEY_HERE';
    });
    
    if (missingFields.length > 0) {
      throw new Error(`Configuração ${this.providerName} inválida. Campos obrigatórios ausentes ou com valores placeholder: ${missingFields.join(', ')}`);
    }

    // Validações comuns
    if (this.config.maxTokens && (this.config.maxTokens <= 0 || this.config.maxTokens > 32000)) {
      throw new Error('maxTokens deve estar entre 1 e 32000');
    }

    if (this.config.temperature && (this.config.temperature < 0 || this.config.temperature > 2)) {
      throw new Error('temperature deve estar entre 0 e 2');
    }
  }

  /**
   * Trata erros do provedor de forma padronizada
   * @param {Error} error - Erro original
   * @param {string} context - Contexto do erro
   * @returns {Error} Erro padronizado
   */
  handleProviderError(error, context = '') {
    const errorMessage = `[${this.providerName}] ${context}: ${error.message}`;
    
    // Mapeia tipos de erro comuns
    if (error.message.includes('quota') || error.message.includes('limit')) {
      const newError = new Error(`Limite de uso do ${this.providerName} atingido`);
      newError.type = 'quota_exceeded';
      newError.code = 'quota_exceeded';
      newError.provider = this.providerName;
      return newError;
    }
    
    if (error.message.includes('unauthorized') || error.message.includes('invalid key')) {
      const newError = new Error(`Chave de API do ${this.providerName} inválida`);
      newError.type = 'invalid_api_key';
      newError.code = 'invalid_api_key';
      newError.provider = this.providerName;
      return newError;
    }
    
    if (error.message.includes('timeout')) {
      const newError = new Error(`Timeout na requisição para ${this.providerName}`);
      newError.type = 'timeout';
      newError.code = 'timeout';
      newError.provider = this.providerName;
      return newError;
    }
    
    // Erro genérico
    const newError = new Error(errorMessage);
    newError.type = 'provider_error';
    newError.code = 'provider_error';
    newError.provider = this.providerName;
    newError.originalError = error;
    return newError;
  }
}