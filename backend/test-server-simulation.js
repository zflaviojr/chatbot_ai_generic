/**
 * Simula exatamente o que acontece no servidor quando recebe uma mensagem
 */

import { AIProviderManager } from './src/ai/AIProviderManager.js';
import { SessionManager } from './src/session/SessionManager.js';
import dotenv from 'dotenv';

// Carrega variáveis de ambiente
dotenv.config({ path: '.env.development' });

async function simulateServerFlow() {
  console.log('🔍 Simulando fluxo exato do servidor...');
  
  try {
    // Configuração exata do servidor
    const aiConfig = {
      provider: process.env.AI_PROVIDER || 'openrouter',
      model: process.env.AI_MODEL || 'z-ai/glm-4.5-air:free',
      maxTokens: parseInt(process.env.AI_MAX_TOKENS, 10) || 1000,
      temperature: parseFloat(process.env.AI_TEMPERATURE) || 0.7,
      systemPrompt: process.env.AI_SYSTEM_PROMPT || 'Você é um assistente virtual útil e amigável.',
      timeout: parseInt(process.env.AI_TIMEOUT, 10) || 30000,
      apiKey: process.env.AI_PROVIDER === 'openai' ? process.env.OPENAI_API_KEY :
               process.env.AI_PROVIDER === 'openrouter' ? process.env.OPENROUTER_API_KEY :
               process.env.AI_PROVIDER === 'anthropic' ? process.env.ANTHROPIC_API_KEY : '',
      baseURL: process.env.AI_PROVIDER === 'openai' ? process.env.OPENAI_BASE_URL :
               process.env.AI_PROVIDER === 'openrouter' ? process.env.OPENROUTER_BASE_URL :
               process.env.AI_PROVIDER === 'anthropic' ? process.env.ANTHROPIC_BASE_URL : '',
      httpReferer: process.env.HTTP_REFERER || 'http://localhost:3001',
      xTitle: process.env.X_TITLE || 'Chatbot Web MCP'
    };
    
    console.log('🔧 Configuração do AI Provider:', {
      provider: aiConfig.provider,
      model: aiConfig.model,
      hasApiKey: !!aiConfig.apiKey,
      baseURL: aiConfig.baseURL
    });
    
    const aiManager = new AIProviderManager(aiConfig);
    await aiManager.initialize();
    console.log('✅ AI Manager inicializado');
    
    // Simula SessionManager
    const sessionManager = new SessionManager();
    
    // Simula mensagem recebida do frontend (pode estar sem histórico)
    const messageFromFrontend = {
      type: 'chat',
      content: 'Como eu disse que me chamo mesmo?',
      sessionId: 'session_test_123',
      messageId: 'msg_test_456',
      // Simula diferentes cenários de histórico
      history: undefined // Este pode ser o problema!
    };
    
    console.log('\n📝 Mensagem simulada do frontend:', messageFromFrontend);
    
    // Simula o fluxo exato do server.js
    let session = null;
    if (messageFromFrontend.sessionId) {
      session = sessionManager.getSession(messageFromFrontend.sessionId);
    }
    
    if (!session) {
      console.log('📝 Criando nova sessão para cliente');
      session = sessionManager.createSession('127.0.0.1');
    }
    
    // Usa histórico enviado pelo frontend ou fallback para histórico da sessão
    let conversationHistory = [];
    
    if (messageFromFrontend.history && Array.isArray(messageFromFrontend.history) && messageFromFrontend.history.length > 0) {
      console.log('📚 Usando histórico do frontend:', messageFromFrontend.history.length, 'mensagens');
      conversationHistory = messageFromFrontend.history;
    } else {
      console.log('📚 Fallback para histórico da sessão');
      // Adiciona mensagem do usuário ao histórico da sessão
      sessionManager.addMessage(session.id, {
        role: 'user',
        content: messageFromFrontend.content,
        tokens: Math.ceil(messageFromFrontend.content.length / 4)
      });
      
      conversationHistory = sessionManager.getFormattedHistory(session.id) || [];
    }
    
    console.log('📚 Histórico final para IA:', {
      sessionId: session.id,
      historyLength: conversationHistory.length,
      customerName: session.context.customerName,
      stage: session.context.stage,
      firstMessage: conversationHistory[0]?.role,
      lastMessage: conversationHistory[conversationHistory.length - 1]?.role
    });

    // Separa system message do histórico
    const systemMessage = conversationHistory.find(msg => msg.role === 'system');
    const messageHistory = conversationHistory.filter(msg => msg.role !== 'system');

    // Garante que messageHistory é sempre um array válido
    const safeMessageHistory = Array.isArray(messageHistory) ? messageHistory : [];
    
    console.log('📤 Enviando para AI Provider:', {
      messageContent: messageFromFrontend.content,
      historyLength: safeMessageHistory.length,
      systemPrompt: systemMessage?.content ? 'presente' : 'usando padrão'
    });

    const aiResponse = await aiManager.sendMessage(messageFromFrontend.content, {
      sessionId: session.id,
      requestId: messageFromFrontend.messageId,
      history: safeMessageHistory, // Histórico sem system message (sempre array)
      systemPrompt: systemMessage?.content || 'Você é um assistente virtual útil e amigável.'
    });
    
    console.log('✅ Resposta do AI Provider:', aiResponse.message.substring(0, 100) + '...');
    
  } catch (error) {
    console.error('❌ ERRO CAPTURADO:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    if (error.message.includes('Cannot read properties of undefined')) {
      console.log('\n🎯 ERRO ENCONTRADO NO FLUXO DO SERVIDOR!');
      console.log('📍 Este é o erro que acontece no servidor real');
    }
  }
  
  process.exit(0);
}

// Executa a simulação
simulateServerFlow().catch(console.error);