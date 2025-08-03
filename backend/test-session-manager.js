import { SessionManager } from './src/session/SessionManager.js';

async function testSessionManager() {
  console.log('🧪 Testando SessionManager...');
  
  const sessionManager = new SessionManager({
    maxHistoryLength: 5,
    sessionTimeout: 30 * 60 * 1000
  });
  
  // Cria uma sessão
  console.log('\n1. Criando sessão...');
  const session = sessionManager.createSession('test-client');
  console.log('Sessão criada:', session.id);
  
  // Adiciona algumas mensagens
  console.log('\n2. Adicionando mensagens...');
  
  sessionManager.addMessage(session.id, {
    role: 'user',
    content: 'Oi, me chamo João',
    tokens: 10
  });
  
  sessionManager.addMessage(session.id, {
    role: 'assistant',
    content: 'Olá João! Como posso ajudá-lo hoje?',
    tokens: 15
  });
  
  sessionManager.addMessage(session.id, {
    role: 'user',
    content: 'Quero saber sobre botox',
    tokens: 8
  });
  
  // Verifica o histórico
  console.log('\n3. Verificando histórico...');
  const history = sessionManager.getFormattedHistory(session.id);
  console.log('Histórico formatado:');
  history.forEach((msg, index) => {
    console.log(`  ${index + 1}. [${msg.role}]: ${msg.content.substring(0, 100)}...`);
  });
  
  // Verifica o contexto
  console.log('\n4. Verificando contexto...');
  const sessionData = sessionManager.getSession(session.id);
  console.log('Contexto da sessão:', sessionData.context);
  console.log('Metadados:', sessionData.metadata);
  
  // Testa detecção de nome
  console.log('\n5. Testando detecção de informações...');
  sessionManager.addMessage(session.id, {
    role: 'user',
    content: 'Tenho 35 anos e peso 70kg',
    tokens: 8
  });
  
  const updatedSession = sessionManager.getSession(session.id);
  console.log('Contexto atualizado:', updatedSession.context);
  
  // Testa histórico final
  console.log('\n6. Histórico final...');
  const finalHistory = sessionManager.getFormattedHistory(session.id);
  console.log(`Total de mensagens no histórico: ${finalHistory.length}`);
  
  sessionManager.destroy();
  console.log('\n✅ Teste concluído!');
}

testSessionManager().catch(console.error);