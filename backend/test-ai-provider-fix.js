/**
 * Teste simples para verificar se o erro do AI Provider foi corrigido
 */

import { AIProviderManager } from './src/ai/AIProviderManager.js';

async function testAIProvider() {
  console.log('🧪 Testando correção do AI Provider...');
  
  try {
    // Inicializa o AI Provider
    const aiManager = new AIProviderManager({
      provider: 'openrouter',
      model: 'meta-llama/llama-3.1-8b-instruct:free'
    });
    
    await aiManager.initialize();
    console.log('✅ AI Provider inicializado');
    
    // Teste 1: Sem histórico (deve funcionar)
    console.log('\n📝 Teste 1: Mensagem sem histórico');
    try {
      const response1 = await aiManager.sendMessage('Olá, teste sem histórico', {
        sessionId: 'test-session-1',
        requestId: 'test-1'
      });
      console.log('✅ Teste 1 passou:', response1.message.substring(0, 50) + '...');
    } catch (error) {
      console.log('❌ Teste 1 falhou:', error.message);
    }
    
    // Teste 2: Com histórico undefined (deve funcionar agora)
    console.log('\n📝 Teste 2: Mensagem com histórico undefined');
    try {
      const response2 = await aiManager.sendMessage('Olá, teste com histórico undefined', {
        sessionId: 'test-session-2',
        requestId: 'test-2',
        history: undefined
      });
      console.log('✅ Teste 2 passou:', response2.message.substring(0, 50) + '...');
    } catch (error) {
      console.log('❌ Teste 2 falhou:', error.message);
    }
    
    // Teste 3: Com histórico vazio (deve funcionar)
    console.log('\n📝 Teste 3: Mensagem com histórico vazio');
    try {
      const response3 = await aiManager.sendMessage('Olá, teste com histórico vazio', {
        sessionId: 'test-session-3',
        requestId: 'test-3',
        history: []
      });
      console.log('✅ Teste 3 passou:', response3.message.substring(0, 50) + '...');
    } catch (error) {
      console.log('❌ Teste 3 falhou:', error.message);
    }
    
    // Teste 4: Com histórico válido (deve funcionar)
    console.log('\n📝 Teste 4: Mensagem com histórico válido');
    try {
      const response4 = await aiManager.sendMessage('Como eu disse que me chamo?', {
        sessionId: 'test-session-4',
        requestId: 'test-4',
        history: [
          { role: 'user', content: 'Oi, me chamo João' },
          { role: 'assistant', content: 'Olá João! Como posso ajudá-lo?' }
        ],
        systemPrompt: 'Você é um assistente que lembra do nome dos clientes.'
      });
      console.log('✅ Teste 4 passou:', response4.message.substring(0, 50) + '...');
    } catch (error) {
      console.log('❌ Teste 4 falhou:', error.message);
    }
    
    console.log('\n🎉 Todos os testes concluídos!');
    
  } catch (error) {
    console.error('❌ Erro geral no teste:', error.message);
  }
  
  process.exit(0);
}

// Executa o teste
testAIProvider().catch(console.error);