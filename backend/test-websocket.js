/**
 * Script simples para testar a conexão WebSocket do backend
 */
import WebSocket from 'ws';

const WS_URL = 'ws://localhost:3001/ws';

console.log('🔧 Testando conexão WebSocket do backend...');
console.log(`📡 Conectando em: ${WS_URL}`);

const ws = new WebSocket(WS_URL);

ws.on('open', function() {
    console.log('✅ Conectado ao WebSocket!');
    
    // Envia mensagem de teste
    const testMessage = {
        type: 'chat',
        messageId: `test_${Date.now()}`,
        content: 'Mensagem de teste do script Node.js',
        timestamp: new Date().toISOString()
    };
    
    console.log('📤 Enviando mensagem de teste:', testMessage);
    ws.send(JSON.stringify(testMessage));
});

ws.on('message', function(data) {
    try {
        const message = JSON.parse(data.toString());
        console.log('📥 Mensagem recebida:', message);
    } catch (error) {
        console.log('📥 Dados brutos recebidos:', data.toString());
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

// Timeout de teste
setTimeout(() => {
    console.log('⏰ Encerrando teste...');
    ws.close();
}, 10000);