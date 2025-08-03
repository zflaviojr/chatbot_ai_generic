/**
 * Teste específico para reproduzir o erro "Cannot read properties of undefined (reading 'length')"
 */

import { AIProviderManager } from './src/ai/AIProviderManager.js';

async function testSpecificError() {
  console.log('🔍 Teste específico para reproduzir o erro...');
  
  try {
    // Configuração exata como no servidor
    const aiConfig = {
      provider: 'openrouter',
      model: 'z-ai/glm-4.5-air:free',
      maxTokens: 1000,
      temperature: 0.7,
      systemPrompt: 'Você é um assistente virtual útil e amigável.',
      timeout: 30000,
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
      httpReferer: process.env.HTTP_REFERER || 'http://localhost:3001',
      xTitle: process.env.X_TITLE || 'Chatbot Web MCP'
    };
    
    console.log('🔧 Configuração:', {
      provider: aiConfig.provider,
      model: aiConfig.model,
      hasApiKey: !!aiConfig.apiKey,
      baseURL: aiConfig.baseURL
    });
    
    const aiManager = new AIProviderManager(aiConfig);
    await aiManager.initialize();
    console.log('✅ AI Manager inicializado');
    
    // Teste que pode reproduzir o erro
    console.log('\n📝 Enviando mensagem que pode causar o erro...');
    
    const testOptions = {
      sessionId: 'test-session-123',
      requestId: 'test-request-456',
      history: [
        { role: 'user', content: 'Olá, meu nome é João' },
        { role: 'assistant', content: 'Olá João! Como posso ajudá-lo?' }
      ],
      systemPrompt: 'Você é um assistente que lembra do nome dos clientes.'
    };
    
    console.log('📋 Options:', JSON.stringify(testOptions, null, 2));
    
    const response = await aiManager.sendMessage('Como eu disse que me chamo?', testOptions);
    
    console.log('✅ Resposta recebida:', response.message.substring(0, 100) + '...');
    console.log('📊 Resposta completa:', JSON.stringify(response, null, 2));
    
  } catch (error) {
    console.error('❌ ERRO CAPTURADO:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    // Verifica se é o erro específico que estamos procurando
    if (error.message.includes('Cannot read properties of undefined')) {
      console.log('\n🎯 ERRO ENCONTRADO!');
      console.log('📍 Este é o erro que estávamos procurando');
      
      // Analisa o stack trace para encontrar a linha exata
      const stackLines = error.stack.split('\n');
      console.log('📊 Stack trace detalhado:');
      stackLines.forEach((line, index) => {
        console.log(`${index}: ${line}`);
      });
    }
  }
  
  process.exit(0);
}

// Carrega variáveis de ambiente
import dotenv from 'dotenv';
dotenv.config({ path: '.env.development' });

// Executa o teste
testSpecificError().catch(console.error);