import { BaseAIProvider } from './BaseAIProvider.js';
import logger from '../../utils/logger.js';

/**
 * Provedor Mock - usado apenas quando nenhum provedor real está disponível
 * Este provedor retorna uma mensagem de erro informativa
 */
export class MockProvider extends BaseAIProvider {
  constructor(config = {}) {
    super(config);
    this.providerName = 'mock';
    this.isConnected = true; // Mock sempre está "conectado"
  }

  /**
   * Inicializa o provedor mock
   */
  async initialize() {
    logger.warn('Provedor Mock inicializado - nenhum provedor real de IA está disponível');
    this.isConnected = true;
  }

  /**
   * Health check sempre retorna OK para mock
   */
  async healthCheck() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      provider: this.providerName,
      warning: 'Usando provedor mock - configure um provedor real de IA'
    };
  }

  /**
   * Retorna mensagem informativa sobre a falta de configuração
   */
  async sendMessage(message, options = {}) {
    logger.warn('Tentativa de envio de mensagem com provedor mock', {
      message: message.substring(0, 50),
      sessionId: options.sessionId
    });

    const errorMessage = `
🤖 **Configuração de IA Necessária**

Desculpe, mas não foi possível processar sua mensagem porque nenhum provedor de IA está configurado corretamente.

**Para resolver isso:**

1. **OpenAI**: Configure OPENAI_API_KEY no arquivo .env
2. **OpenRouter**: Configure OPENROUTER_API_KEY no arquivo .env  
3. **Anthropic**: Configure ANTHROPIC_API_KEY no arquivo .env

**Configuração atual:**
- Provedor selecionado: ${process.env.AI_PROVIDER || 'não definido'}
- Status: Nenhuma chave de API válida encontrada

Entre em contato com o administrador do sistema para configurar um provedor de IA.
    `.trim();

    const rawResponse = {
      content: errorMessage,
      model: 'mock-error-handler',
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0
      },
      finishReason: 'stop',
      processingTime: 0,
      metadata: {
        provider: this.providerName,
        isError: true,
        errorType: 'no_provider_configured'
      }
    };

    return this.standardizeResponse(rawResponse, options.requestId, options.sessionId);
  }
}