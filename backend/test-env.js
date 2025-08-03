/**
 * Teste para verificar se as variáveis de ambiente estão sendo carregadas
 */

import dotenv from 'dotenv';
import path from 'path';

// Carrega o arquivo .env.development
const envPath = path.resolve('.env.development');
console.log('📁 Carregando arquivo:', envPath);

const result = dotenv.config({ path: envPath });

if (result.error) {
  console.error('❌ Erro ao carregar .env:', result.error);
} else {
  console.log('✅ Arquivo .env carregado com sucesso');
}

console.log('\n🔍 Variáveis de ambiente relevantes:');
console.log('AI_PROVIDER:', process.env.AI_PROVIDER);
console.log('AI_MODEL:', process.env.AI_MODEL);
console.log('OPENROUTER_API_KEY:', process.env.OPENROUTER_API_KEY ? `${process.env.OPENROUTER_API_KEY.substring(0, 10)}...` : 'NÃO DEFINIDA');
console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? `${process.env.OPENAI_API_KEY.substring(0, 10)}...` : 'NÃO DEFINIDA');

// Teste de inicialização do AI Provider
console.log('\n🧪 Testando inicialização do AI Provider...');

try {
  const { AIProviderManager } = await import('./src/ai/AIProviderManager.js');
  
  const aiManager = new AIProviderManager();
  console.log('📊 Configuração do AI Manager:', {
    provider: aiManager.config.provider,
    model: aiManager.config.model,
    hasApiKey: !!aiManager.config.apiKey
  });
  
  await aiManager.initialize();
  console.log('✅ AI Provider inicializado com sucesso');
  
} catch (error) {
  console.error('❌ Erro ao inicializar AI Provider:', error.message);
}

process.exit(0);