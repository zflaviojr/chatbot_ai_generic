/**
 * Versão simplificada do index.js para debug
 */
import { ChatbotApp } from './components/ChatbotApp.js';
import './styles/main.css';

// Configuração básica
const config = {
  websocketUrl: 'ws://localhost:3001/ws',
  title: 'Assistente Virtual MCP',
  position: 'bottom-right',
  autoStart: true,
  enableLogging: true
};

// Variável global para acesso
window.chatbotApp = null;

// Inicializa aplicação quando DOM estiver pronto
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 Inicializando chatbot simples...');
  
  try {
    // Inicializa aplicação principal
    window.chatbotApp = new ChatbotApp(config);
    
    // Aguarda inicialização completa
    let attempts = 0;
    const maxAttempts = 50; // 5 segundos
    
    const checkInit = () => {
      attempts++;
      console.log(`Tentativa ${attempts}: isInitialized = ${window.chatbotApp.isInitialized}`);
      
      if (window.chatbotApp.isInitialized) {
        console.log('✅ Chatbot MCP inicializado com sucesso');
        
        // Adiciona handlers globais para debug
        window.chatbotStats = () => window.chatbotApp.getStats();
        window.chatbotClearHistory = () => window.chatbotApp.clearHistory();
        window.chatbotRestart = () => {
          window.chatbotApp.destroy();
          window.chatbotApp = new ChatbotApp(config);
        };
        
        // Atualiza status na página
        updateConnectionStatus();
        
      } else if (attempts < maxAttempts) {
        setTimeout(checkInit, 100);
      } else {
        console.error('❌ Timeout na inicialização do chatbot');
        showError('Timeout na inicialização');
      }
    };
    
    checkInit();
    
  } catch (error) {
    console.error('❌ Erro ao inicializar chatbot:', error);
    showError(error.message);
  }
});

/**
 * Mostra erro na página
 */
function showError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.innerHTML = `
    <div style="position: fixed; bottom: 20px; right: 20px; background: #f44336; color: white; padding: 15px; border-radius: 8px; z-index: 10000; max-width: 300px;">
      <strong>Erro ao carregar chatbot</strong><br>
      ${message}<br>
      <button onclick="location.reload()" style="background: white; color: #f44336; border: none; padding: 5px 10px; border-radius: 4px; margin-top: 10px; cursor: pointer;">
        Recarregar
      </button>
    </div>
  `;
  document.body.appendChild(errorDiv);
}

/**
 * Atualiza status de conexão na página
 */
function updateConnectionStatus() {
  const statusElement = document.getElementById('connection-status');
  if (!statusElement) return;
  
  const indicator = statusElement.querySelector('.status-indicator');
  const text = statusElement.querySelector('span:last-child');
  
  if (window.chatbotApp && window.chatbotApp.messageHandler) {
    const isConnected = window.chatbotApp.messageHandler.isConnected;
    const isConnecting = window.chatbotApp.messageHandler.isConnecting;
    
    if (isConnected) {
      indicator.className = 'status-indicator status-online';
      text.textContent = 'Status: Conectado';
    } else if (isConnecting) {
      indicator.className = 'status-indicator status-connecting';
      text.textContent = 'Status: Conectando...';
    } else {
      indicator.className = 'status-indicator status-offline';
      text.textContent = 'Status: Desconectado';
    }
  }
}

// Handler para limpeza quando página for fechada
window.addEventListener('beforeunload', () => {
  if (window.chatbotApp) {
    window.chatbotApp.destroy();
  }
});

// Exporta configuração
export { config };