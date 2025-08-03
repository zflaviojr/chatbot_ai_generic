/**
 * Teste simplificado do OpenRouter para isolar o problema
 */

import OpenAI from 'openai';

async function testSimpleOpenRouter() {
  console.log('🧪 Teste simplificado do OpenRouter...');
  
  try {
    // Configuração direta
    const client = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'http://localhost:3001',
        'X-Title': 'Chatbot Web MCP'
      }
    });
    
    console.log('✅ Cliente OpenRouter criado');
    
    // Teste 1: Mensagem simples
    console.log('\n📝 Teste 1: Mensagem simples');
    try {
      const response1 = await client.chat.completions.create({
        model: 'meta-llama/llama-3.1-8b-instruct:free',
        messages: [
          { role: 'system', content: 'Você é um assistente útil.' },
          { role: 'user', content: 'Olá, como você está?' }
        ],
        max_tokens: 100,
        temperature: 0.7
      });
      
      console.log('✅ Resposta recebida:', response1.choices[0]?.message?.content);
      
    } catch (error) {
      console.log('❌ Erro no teste 1:', error.message);
      if (error.message.includes('Cannot read properties of undefined')) {
        console.log('🎯 ERRO ENCONTRADO NO TESTE 1!');
        console.log('📊 Detalhes do erro:', error.stack);
      }
    }
    
    // Teste 2: Com histórico
    console.log('\n📝 Teste 2: Com histórico');
    try {
      const response2 = await client.chat.completions.create({
        model: 'meta-llama/llama-3.1-8b-instruct:free',
        messages: [
          { role: 'system', content: 'Você é um assistente útil.' },
          { role: 'user', content: 'Meu nome é João' },
          { role: 'assistant', content: 'Olá João! Como posso ajudá-lo?' },
          { role: 'user', content: 'Como eu disse que me chamo?' }
        ],
        max_tokens: 100,
        temperature: 0.7
      });
      
      console.log('✅ Resposta com histórico:', response2.choices[0]?.message?.content);
      
    } catch (error) {
      console.log('❌ Erro no teste 2:', error.message);
      if (error.message.includes('Cannot read properties of undefined')) {
        console.log('🎯 ERRO ENCONTRADO NO TESTE 2!');
        console.log('📊 Detalhes do erro:', error.stack);
      }
    }
    
    console.log('\n🎉 Testes concluídos!');
    
  } catch (error) {
    console.error('❌ Erro geral:', error.message);
    console.error('📊 Stack trace:', error.stack);
  }
  
  process.exit(0);
}

// Executa o teste
testSimpleOpenRouter().catch(console.error);