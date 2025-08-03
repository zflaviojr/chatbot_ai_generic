import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
// import { WebSocketHandler } from './handlers/WebSocketHandler.js'; // Temporariamente desabilitado
import { AIProviderManager } from './ai/AIProviderManager.js';
import { SessionManager } from './session/SessionManager.js';
import apiRoutes from './routes/api.js';
import monitoringRoutes from './routes/monitoring.js';
import logger from './utils/logger.js';
import monitoring from './utils/monitoring.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import config from './config/environment.js';

const app = express();

// Configuração CORS
app.use(cors(config.cors));

// Middleware básico
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Monitoring middleware (must be before routes)
app.use(monitoring.trackRequest.bind(monitoring));

// Log de requests
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`, { ip: req.ip });
  next();
});

// Inicializa o gerenciador de IA
console.log('🔧 Inicializando AIProviderManager com configuração:', {
  provider: config.ai.provider,
  model: config.ai.model,
  maxTokens: config.ai.maxTokens,
  temperature: config.ai.temperature
});

// Configuração completa do AI Provider com chaves de API
const aiConfig = {
  ...config.ai,
  // Adiciona chaves de API específicas baseadas no provedor
  apiKey: config.ai.provider === 'openai' ? process.env.OPENAI_API_KEY :
          config.ai.provider === 'openrouter' ? process.env.OPENROUTER_API_KEY :
          config.ai.provider === 'anthropic' ? process.env.ANTHROPIC_API_KEY : '',
  baseURL: config.ai.provider === 'openai' ? process.env.OPENAI_BASE_URL :
           config.ai.provider === 'openrouter' ? process.env.OPENROUTER_BASE_URL :
           config.ai.provider === 'anthropic' ? process.env.ANTHROPIC_BASE_URL : '',
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

// Inicializa o gerenciador de sessões
console.log('🔧 Inicializando SessionManager...');
const sessionManager = new SessionManager({
  maxHistoryLength: 20,
  sessionTimeout: 30 * 60 * 1000, // 30 minutos
  maxSessions: 1000
});

// Rotas da API
app.use('/api', apiRoutes);

// Rotas de monitoramento
app.use('/monitoring', monitoringRoutes);

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    let aiStatus = 'disconnected';
    let aiInfo = null;
    
    try {
      const healthCheck = await aiManager.healthCheck();
      aiStatus = healthCheck.status === 'ok' ? 'connected' : 'disconnected';
      aiInfo = aiManager.getCurrentProviderInfo();
    } catch (error) {
      aiStatus = 'error';
    }
    
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      server: {
        port: config.server.port,
        environment: config.server.env,
        uptime: process.uptime(),
        memory: process.memoryUsage()
      },
      ai: {
        status: aiStatus,
        provider: aiInfo?.name || 'unknown',
        model: aiInfo?.config?.model || 'unknown',
        isConnected: aiInfo?.isConnected || false
      },
      sessions: sessionManager.getStats(),
      websocket: {
        enabled: true,
        path: config.websocket.path
      }
    });
  } catch (error) {
    logger.error('Health check failed', { error: error.message });
    
    res.status(500).json({
      status: 'error',
      message: 'Health check failed',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Endpoint de configuração (apenas informações não sensíveis)
app.get('/config', (req, res) => {
  res.json({
    cors: {
      origin: config.cors.origin
    },
    ai: {
      provider: config.ai.provider,
      model: config.ai.model,
      maxTokens: config.ai.maxTokens,
      temperature: config.ai.temperature
    },
    websocket: {
      enabled: true,
      path: config.websocket.path
    }
  });
});

// Endpoint de teste para AI Provider
app.get('/test-ai', async (req, res) => {
  try {
    const testMessage = req.query.message || 'Olá, este é um teste.';
    
    logger.info('Testando AI Provider', { message: testMessage });
    
    const response = await aiManager.sendMessage(testMessage, {
      requestId: `test_${Date.now()}`,
      sessionId: 'test_session'
    });
    
    res.json({
      status: 'success',
      provider: response.provider,
      model: response.model,
      message: response.message,
      usage: response.usage,
      timestamp: response.timestamp
    });
    
  } catch (error) {
    logger.error('Erro no teste AI Provider', { error: error.message });
    
    res.status(500).json({
      status: 'error',
      error: error.message,
      type: error.type,
      code: error.code,
      provider: error.provider
    });
  }
});

// Middleware para rotas não encontradas
app.use('*', notFoundHandler);

// Middleware de tratamento de erros
app.use(errorHandler);

// Cria servidor HTTP
const server = createServer(app);

// Configura WebSocket Server
const wss = new WebSocketServer({ 
  server,
  path: config.websocket.path,
  clientTracking: config.websocket.clientTracking
});

// Inicializa o handler WebSocket SIMPLIFICADO (temporário para debug)
console.log('🔧 Server: Usando WebSocket handler simplificado...');

// Handler WebSocket simplificado que funciona
wss.on('connection', (ws, request) => {
  const clientIp = request.socket.remoteAddress || 'unknown';
  console.log('🔗 Conexão WebSocket recebida de:', clientIp);
  
  // Envia mensagem de boas-vindas
  ws.send(JSON.stringify({
    type: 'connection',
    status: 'connected',
    clientId: `client_${Date.now()}`,
    message: 'Conectado ao chatbot com sucesso!'
  }));
  
  ws.on('message', async (data) => {
    console.log('📥 Mensagem recebida:', data.toString());
    
    try {
      const message = JSON.parse(data.toString());
      console.log('📋 Mensagem parseada:', message);
      
      // Processa diferentes tipos de mensagem
      let response;
      
      switch (message.type) {
        case 'ping':
          response = {
            type: 'pong',
            timestamp: new Date().toISOString()
          };
          break;
          
        case 'session_start':
          const newSession = sessionManager.createSession(clientIp);
          response = {
            type: 'session_started',
            sessionId: newSession.id,
            timestamp: new Date().toISOString(),
            context: {
              stage: newSession.context.stage,
              isNewSession: true
            }
          };
          break;
          
        case 'chat':
          // Mostra indicador de digitação
          ws.send(JSON.stringify({
            type: 'typing',
            isTyping: true,
            timestamp: new Date().toISOString()
          }));
          
          // Processa mensagem via AI Provider
          try {
            console.log('🤖 Processando mensagem com histórico do frontend:', message.history ? message.history.length : 'sem histórico');
            
            // Obtém ou cria sessão
            let session = null;
            if (message.sessionId) {
              session = sessionManager.getSession(message.sessionId);
            }
            
            if (!session) {
              console.log('📝 Criando nova sessão para cliente');
              session = sessionManager.createSession(clientIp);
            }

            // Usa histórico enviado pelo frontend ou fallback para histórico da sessão
            let conversationHistory = [];
            
            if (message.history && Array.isArray(message.history) && message.history.length > 0) {
              console.log('📚 Usando histórico do frontend:', message.history.length, 'mensagens');
              conversationHistory = message.history;
            } else {
              console.log('📚 Fallback para histórico da sessão');
              // Adiciona mensagem do usuário ao histórico da sessão
              sessionManager.addMessage(session.id, {
                role: 'user',
                content: message.content,
                tokens: Math.ceil(message.content.length / 4)
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

            // Remove qualquer system message do histórico do frontend (não deve vir do frontend)
            const messageHistory = conversationHistory.filter(msg => msg.role !== 'system');
            
            // Garante que messageHistory é sempre um array válido
            const safeMessageHistory = Array.isArray(messageHistory) ? messageHistory : [];
            
            // Usa SEMPRE o AI_SYSTEM_PROMPT do .env, não do frontend
            const systemPrompt = process.env.AI_SYSTEM_PROMPT || 'Você é um assistente virtual útil e amigável.';
            
            // Obtém conteúdo da mensagem atual
            let content = message.content;
            
            // Se não há conteúdo direto, tenta obter da última mensagem do usuário no histórico
            if (!content && message.history && Array.isArray(message.history)) {
              const lastUserMessage = message.history.filter(msg => msg.role === 'user').pop();
              if (lastUserMessage) {
                content = lastUserMessage.content;
              }
            }
            
            // Verifica se há conteúdo para processar
            if (!content) {
              console.log('❌ Mensagem sem conteúdo válido:', message);
              ws.send(JSON.stringify({
                type: 'chat_error',
                messageId: message.messageId,
                message: 'Desculpe, não foi possível processar sua mensagem. Tente novamente.',
                error: 'Conteúdo da mensagem não encontrado',
                timestamp: new Date().toISOString()
              }));
              return;
            }

            console.log('📤 Enviando para AI Provider:', {
              messageContent: content,
              historyLength: safeMessageHistory.length,
              systemPrompt: 'usando AI_SYSTEM_PROMPT do .env'
            });

            const aiResponse = await aiManager.sendMessage(content, {
              sessionId: session.id,
              requestId: message.messageId,
              history: safeMessageHistory, // Histórico sem system message (sempre array)
              systemPrompt: systemPrompt // Sempre do .env
            });
            
            // Adiciona resposta da IA ao histórico
            sessionManager.addMessage(session.id, {
              role: 'assistant',
              content: aiResponse.message,
              tokens: aiResponse.usage.totalTokens
            });

            // Para indicador de digitação
            ws.send(JSON.stringify({
              type: 'typing',
              isTyping: false,
              timestamp: new Date().toISOString()
            }));
            
            // Envia resposta da AI com contexto da sessão
            ws.send(JSON.stringify({
              type: 'chat_response',
              messageId: message.messageId,
              content: aiResponse.message,
              timestamp: aiResponse.timestamp,
              sessionId: session.id,
              usage: aiResponse.usage,
              model: aiResponse.model,
              provider: aiResponse.provider,
              context: {
                customerName: session.context.customerName,
                stage: session.context.stage,
                currentTopic: session.context.currentTopic,
                messageCount: session.metadata.messageCount,
                isContextual: session.messageHistory.length > 1
              }
            }));
            
            console.log('✅ Resposta AI enviada com contexto:', {
              provider: aiResponse.provider,
              sessionId: session.id,
              responseLength: aiResponse.message.length,
              tokensUsed: aiResponse.usage.totalTokens,
              customerName: session.context.customerName,
              stage: session.context.stage,
              historyLength: session.messageHistory.length
            });
            
          } catch (error) {
            console.error('❌ Erro ao processar com AI Provider:', error.message);
            
            // Para indicador de digitação
            ws.send(JSON.stringify({
              type: 'typing',
              isTyping: false,
              timestamp: new Date().toISOString()
            }));
            
            // Envia mensagem de erro
            ws.send(JSON.stringify({
              type: 'chat_error',
              messageId: message.messageId,
              message: 'Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente.',
              error: error.message,
              timestamp: new Date().toISOString()
            }));
          }
          return; // Não envia resposta imediata

        case 'session_end':
          if (message.sessionId) {
            const ended = sessionManager.endSession(message.sessionId, 'user_request');
            response = {
              type: 'session_ended',
              sessionId: message.sessionId,
              success: ended,
              timestamp: new Date().toISOString(),
              message: ended ? 'Atendimento finalizado com sucesso!' : 'Sessão não encontrada'
            };
          } else {
            response = {
              type: 'session_error',
              message: 'ID da sessão não fornecido',
              timestamp: new Date().toISOString()
            };
          }
          break;

        case 'session_reset':
          if (message.sessionId) {
            sessionManager.resetSessionContext(message.sessionId);
            response = {
              type: 'session_reset',
              sessionId: message.sessionId,
              timestamp: new Date().toISOString(),
              message: 'Novo atendimento iniciado!'
            };
          } else {
            response = {
              type: 'session_error',
              message: 'ID da sessão não fornecido',
              timestamp: new Date().toISOString()
            };
          }
          break;

        case 'session_info':
          if (message.sessionId) {
            const session = sessionManager.getSession(message.sessionId);
            if (session) {
              response = {
                type: 'session_info',
                sessionId: message.sessionId,
                context: session.context,
                metadata: session.metadata,
                timestamp: new Date().toISOString()
              };
            } else {
              response = {
                type: 'session_error',
                message: 'Sessão não encontrada',
                timestamp: new Date().toISOString()
              };
            }
          } else {
            response = {
              type: 'session_error',
              message: 'ID da sessão não fornecido',
              timestamp: new Date().toISOString()
            };
          }
          break;
          
        default:
          response = {
            type: 'unknown_message_type',
            originalType: message.type,
            message: `Tipo não reconhecido: ${message.type}`,
            timestamp: new Date().toISOString()
          };
      }
      
      if (response) {
        console.log('📤 Enviando resposta:', response);
        ws.send(JSON.stringify(response));
      }
      
    } catch (error) {
      console.error('❌ Erro ao processar mensagem:', error.message);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Erro ao processar mensagem',
        error: error.message,
        timestamp: new Date().toISOString()
      }));
    }
  });
  
  ws.on('close', (code, reason) => {
    console.log('🔌 Conexão fechada:', code, reason?.toString());
  });
  
  ws.on('error', (error) => {
    console.error('❌ Erro na conexão:', error.message);
  });
});

console.log('✅ Server: Handler WebSocket simplificado configurado');

// Eventos do servidor
server.on('listening', () => {
  console.log(`🚀 Servidor rodando na porta ${config.server.port}`);
  console.log(`📡 WebSocket disponível em ws://localhost:${config.server.port}${config.websocket.path}`);
  console.log(`🌐 CORS configurado para: ${config.cors.origin}`);
  console.log(`📊 Health check: http://localhost:${config.server.port}/health`);
  console.log(`🔧 Ambiente: ${config.server.env}`);
});

server.on('error', (error) => {
  console.error('Erro no servidor:', error);
  process.exit(1);
});

// Tratamento de sinais para shutdown graceful
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

async function gracefulShutdown(signal) {
  console.log(`\n📴 Recebido sinal ${signal}. Iniciando shutdown graceful...`);
  
  try {
    // Fecha conexões WebSocket
    console.log('Fechando conexões WebSocket...');
    await wsHandler.shutdown();
    
    // Desconecta do AI Manager
    console.log('Desconectando do AI Manager...');
    await aiManager.disconnect();

    // Destrói o SessionManager
    console.log('Finalizando SessionManager...');
    sessionManager.destroy();
    
    // Fecha servidor HTTP
    console.log('Fechando servidor HTTP...');
    server.close(() => {
      console.log('✅ Servidor encerrado com sucesso');
      process.exit(0);
    });
    
    // Força encerramento após 10 segundos
    setTimeout(() => {
      console.log('⚠️ Forçando encerramento após timeout');
      process.exit(1);
    }, 10000);
    
  } catch (error) {
    console.error('Erro durante shutdown:', error);
    process.exit(1);
  }
}

// Inicializa o AI Manager
console.log('🔧 Iniciando AI Provider Manager...');
aiManager.initialize().then(() => {
  const providerInfo = aiManager.getCurrentProviderInfo();
  console.log('✅ AI Provider inicializado com sucesso!', {
    provider: providerInfo.name,
    model: providerInfo.config.model,
    isConnected: providerInfo.isConnected
  });
}).catch(error => {
  console.error('❌ Erro ao inicializar AI Provider:', error.message);
  console.error('❌ Verifique se as chaves de API estão configuradas corretamente');
  // Não encerra o servidor, permite funcionamento com fallback
});

// Inicia o servidor
server.listen(config.server.port);

export { app, server, aiManager };