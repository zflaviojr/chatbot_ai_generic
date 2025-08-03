/**
 * Teste simples para substituir o WebSocketHandler e verificar se o problema está na configuração
 */
import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';

const app = express();

// Configuração CORS
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));

app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Cria servidor HTTP
const server = createServer(app);

// Configura WebSocket Server
console.log('🔧 Criando WebSocket Server...');
const wss = new WebSocketServer({ 
  server,
  path: '/ws',
  clientTracking: true
});

console.log('🔧 Configurando handlers simples...');

wss.on('connection', (ws, request) => {
  const clientIp = request.socket.remoteAddress || 'unknown';
  console.log('🔗 CONEXÃO SIMPLES recebida de:', clientIp);
  
  // Envia mensagem de boas-vindas
  ws.send(JSON.stringify({
    type: 'connection',
    status: 'connected',
    message: 'Conectado com handler simples!',
    timestamp: new Date().toISOString()
  }));
  
  ws.on('message', (data) => {
    console.log('📥 MENSAGEM SIMPLES recebida:', data.toString());
    
    try {
      const message = JSON.parse(data.toString());
      console.log('📋 MENSAGEM SIMPLES parseada:', message);
      
      // Resposta baseada no tipo
      let response;
      
      switch (message.type) {
        case 'ping':
          response = {
            type: 'pong',
            timestamp: new Date().toISOString()
          };
          break;
          
        case 'session_start':
          response = {
            type: 'session_started',
            sessionId: `session_${Date.now()}`,
            timestamp: new Date().toISOString()
          };
          break;
          
        case 'chat':
          response = {
            type: 'chat_response',
            messageId: message.messageId,
            content: `Resposta simples para: "${message.content}"`,
            timestamp: new Date().toISOString()
          };
          break;
          
        default:
          response = {
            type: 'unknown_message_type',
            originalType: message.type,
            message: `Tipo não reconhecido: ${message.type}`,
            timestamp: new Date().toISOString()
          };
      }
      
      console.log('📤 RESPOSTA SIMPLES enviando:', response);
      ws.send(JSON.stringify(response));
      
    } catch (error) {
      console.error('❌ ERRO SIMPLES ao processar:', error.message);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Erro ao processar mensagem',
        error: error.message,
        timestamp: new Date().toISOString()
      }));
    }
  });
  
  ws.on('close', (code, reason) => {
    console.log('🔌 CONEXÃO SIMPLES fechada:', code, reason?.toString());
  });
  
  ws.on('error', (error) => {
    console.error('❌ ERRO SIMPLES na conexão:', error.message);
  });
});

wss.on('error', (error) => {
  console.error('❌ ERRO SIMPLES no WebSocket Server:', error.message);
});

// Eventos do servidor
server.on('listening', () => {
  console.log('🚀 Servidor SIMPLES rodando na porta 3001');
  console.log('📡 WebSocket SIMPLES disponível em ws://localhost:3001/ws');
});

server.on('error', (error) => {
  console.error('❌ Erro no servidor SIMPLES:', error);
  process.exit(1);
});

// Inicia o servidor
server.listen(3001);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n📴 Encerrando servidor SIMPLES...');
  server.close(() => {
    console.log('✅ Servidor SIMPLES encerrado');
    process.exit(0);
  });
});