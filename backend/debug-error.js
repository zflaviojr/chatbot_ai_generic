/**
 * Script de debug para identificar exatamente onde está o erro
 */

import { AIProviderManager } from './src/ai/AIProviderManager.js';

async function debugError() {
  console.log('🔍 Iniciando debug do erro...');
  
  try {
    // Inicializa o AI Provider
    const aiManager = new AIProviderManager({
      provider: 'openrouter',
      model: 'meta-llama/llama-3.1-8b-instruct:free'
    });
    
    console.log('🔧 Inicializando AI Provider...');
    await aiManager.initialize();
    console.log('✅ AI Provider inicializado');
    
    // Teste com diferentes cenários
    const testCases = [
      {
        name: 'Sem options',
        message: 'Teste sem options',
        options: undefined
      },
      {
        name: 'Options vazio',
        message: 'Teste com options vazio',
        options: {}
      },
      {
        name: 'History undefined',
        message: 'Teste com history undefined',
        options: { history: undefined }
      },
      {
        name: 'History null',
        message: 'Teste com history null',
        options: { history: null }
      },
      {
        name: 'History array vazio',
        message: 'Teste com history array vazio',
        options: { history: [] }
      },
      {
        name: 'History válido',
        message: 'Como eu me chamo?',
        options: { 
          history: [
            { role: 'user', content: 'Meu nome é João' },
            { role: 'assistant', content: 'Olá João!' }
          ]
        }
      }
    ];
    
    for (const testCase of testCases) {
      console.log(`\n🧪 Testando: ${testCase.name}`);
      console.log(`📝 Mensagem: ${testCase.message}`);
      console.log(`📋 Options:`, testCase.options);
      
      try {
        const response = await aiManager.sendMessage(testCase.message, testCase.options);
        console.log(`✅ ${testCase.name} - Sucesso:`, response.message.substring(0, 50) + '...');
      } catch (error) {
        console.log(`❌ ${testCase.name} - Erro:`, error.message);
        console.log(`📊 Stack trace:`, error.stack);
        
        // Se encontrou o erro, para aqui
        if (error.message.includes('Cannot read properties of undefined')) {
          console.log('\n🎯 ERRO ENCONTRADO!');
          console.log('📍 Teste que causou o erro:', testCase.name);
          console.log('📋 Options que causaram o erro:', JSON.stringify(testCase.options, null, 2));
          break;
        }
      }
      
      // Pausa entre testes
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
  } catch (error) {
    console.error('❌ Erro geral no debug:', error.message);
    console.error('📊 Stack trace:', error.stack);
  }
  
  process.exit(0);
}

// Executa o debug
debugError().catch(console.error);