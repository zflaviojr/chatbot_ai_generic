import OpenAI from 'openai';
import dotenv from 'dotenv';

// Carrega variáveis de ambiente
dotenv.config({ path: '.env.development' });

async function testOpenRouter() {
  console.log('🧪 Testando OpenRouter...');
  
  const apiKey = process.env.OPENROUTER_API_KEY;
  console.log('🔑 API Key:', apiKey ? `${apiKey.substring(0, 10)}...` : 'NÃO ENCONTRADA');
  
  if (!apiKey || apiKey === 'YOUR_OPENROUTER_API_KEY_HERE') {
    console.error('❌ Chave de API do OpenRouter não configurada');
    return;
  }
  
  try {
    const client = new OpenAI({
      apiKey: apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'http://localhost:3001',
        'X-Title': 'Chatbot Web MCP Test'
      }
    });
    
    console.log('📡 Fazendo requisição para OpenRouter...');
    
    // Primeiro, vamos listar os modelos disponíveis
    console.log('📋 Listando modelos disponíveis...');
    const models = await client.models.list();
    
    // Filtra modelos gratuitos
    const freeModels = models.data.filter(model => 
      model.id.includes('free') || 
      (model.pricing && model.pricing.prompt === 0)
    );
    
    console.log('🆓 Modelos gratuitos encontrados:');
    freeModels.slice(0, 5).forEach(model => {
      console.log(`  - ${model.id}`);
    });
    
    // Usa um modelo gratuito disponível
    const modelToUse = freeModels.length > 0 ? freeModels[0].id : 'meta-llama/llama-3.1-8b-instruct:free';
    console.log(`🎯 Usando modelo: ${modelToUse}`);
    
    const completion = await client.chat.completions.create({
      model: modelToUse,
      messages: [
        {
          role: 'system',
          content: 'Você é um assistente virtual útil.'
        },
        {
          role: 'user',
          content: 'Olá, este é um teste. Responda brevemente.'
        }
      ],
      max_tokens: 100,
      temperature: 0.7
    });
    
    console.log('✅ Resposta recebida:');
    console.log('📝 Modelo:', completion.model);
    console.log('💬 Resposta:', completion.choices[0].message.content);
    console.log('📊 Tokens:', completion.usage);
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error('📋 Detalhes:', {
      status: error.status,
      code: error.code,
      type: error.type
    });
  }
}

testOpenRouter();