/**
 * Servidor WebSocket mínimo para testar se o problema está na configuração
 */
import { WebSocketServer } from 'ws';
import { createServer } from 'http';

console.log('🧪 Iniciando servidor WebSocket mínimo...');

// Cria servidor HTTP simples
const server = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Servidor WebSocket mínimo rodando');
});

// Cria WebSocket Server
const wss = new WebSocketServer({ 
  server,
  path: '/ws'
});

console.log('🔧 Configurando WebSocket Server...');

wss.on('connection', (ws, request) => {
  const clientIp = request.socket.remoteAddress || 'unknown';
  console.log('🔗 CONEXÃO RECEBIDA de:', clientIp);
  
  // Envia mensagem de boas-vindas
  ws.send(JSON.stringify({
    type: 'connection',
    message: 'Conectado ao servidor mínimo!',
    timestamp: new Date().toISOString()
  }));
  
  ws.on('message', (data) => {
    console.log('📥 MENSAGEM RECEBIDA:', data.toString());
    
    try {
      const message = JSON.parse(data.toString());
      console.log('📋 MENSAGEM PARSEADA:', message);
      
      // Responde imediatamente
      const response = {
        type: 'response',
        originalType: message.type,
        originalMessageId: message.messageId,
        message: `Resposta para: ${message.type}`,
        content: message.content ? `Eco: ${message.content}` : undefined,
        timestamp: new Date().toISOString()
      };
      
      console.log('📤 ENVIANDO RESPOSTA:', response);
      ws.send(JSON.stringify(response));
      
    } catch (error) {
      console.error('❌ ERRO AO PROCESSAR:', error.message);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Erro ao processar mensagem',
        error: error.message,
        timestamp: new Date().toISOString()
      }));
    }
  });
  
  ws.on('close', (code, reason) => {
    console.log('🔌 CONEXÃO FECHADA:', code, reason?.toString());
  });
  
  ws.on('error', (error) => {
    console.error('❌ ERRO NA CONEXÃO:', error.message);
  });
});

wss.on('error', (error) => {
  console.error('❌ ERRO NO WEBSOCKET SERVER:', error.message);
});

// Inicia servidor
const PORT = 3002;
server.listen(PORT, () => {
  console.log(`🚀 Servidor mínimo rodando na porta ${PORT}`);
  console.log(`📡 WebSocket disponível em ws://localhost:${PORT}/ws`);
  console.log('🧪 Teste com: node test-minimal-websocket.js');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n📴 Encerrando servidor mínimo...');
  server.close(() => {
    console.log('✅ Servidor encerrado');
    process.exit(0);
  });
});