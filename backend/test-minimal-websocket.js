/**
 * Cliente para testar o servidor WebSocket mínimo
 */
import WebSocket from 'ws';

const WS_URL = 'ws://localhost:3002/ws';

console.log('🧪 Testando servidor WebSocket mínimo...');
console.log(`📡 Conectando em: ${WS_URL}`);

const ws = new WebSocket(WS_URL);

ws.on('open', function() {
    console.log('✅ Conectado ao servidor mínimo!');
    
    // Envia ping
    console.log('📤 Enviando ping...');
    ws.send(JSON.stringify({
        type: 'ping',
        messageId: 'test_ping_' + Date.now(),
        timestamp: new Date().toISOString()
    }));
    
    // Envia mensagem de chat após 1 segundo
    setTimeout(() => {
        console.log('📤 Enviando mensagem de chat...');
        ws.send(JSON.stringify({
            type: 'chat',
            messageId: 'test_chat_' + Date.now(),
            content: 'Teste do servidor mínimo',
            timestamp: new Date().toISOString()
        }));
    }, 1000);
});

ws.on('message', function(data) {
    console.log('📥 RESPOSTA RECEBIDA:', data.toString());
    
    try {
        const message = JSON.parse(data.toString());
        console.log('📋 RESPOSTA PARSEADA:', message);
    } catch (error) {
        console.log('⚠️ Erro ao parsear resposta:', error.message);
    }
});

ws.on('close', function(code, reason) {
    console.log(`🔌 Conexão fechada: ${code} - ${reason}`);
    process.exit(0);
});

ws.on('error', function(error) {
    console.error('❌ Erro na conexão:', error.message);
    process.exit(1);
});

// Encerra teste após 5 segundos
setTimeout(() => {
    console.log('⏰ Encerrando teste...');
    ws.close();
}, 5000);