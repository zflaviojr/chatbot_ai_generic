/**
 * Ponto de entrada principal da aplicação frontend
 * Inicializa o chatbot com integração MCP completa
 */
import { ChatbotApp } from './components/ChatbotApp.js';
import { PWAInstaller } from './utils/PWAInstaller.js';
import { PerformanceOptimizer } from './utils/PerformanceOptimizer.js';
import './styles/main.css';

// Inicializa otimizadores globais
const performanceOptimizer = new PerformanceOptimizer({
  enableMemoryMonitoring: true,
  enableFPSMonitoring: false,
  enableBundleAnalysis: true
});

const pwaInstaller = new PWAInstaller({
  showInstallPrompt: true,
  enableNotifications: true,
  enableBackgroundSync: true
});

// Configuração padrão com otimizações mobile
const config = {
  websocketUrl: 'ws://localhost:3001/ws',
  title: 'Assistente Virtual MCP',
  position: 'bottom-right',
  enableNotifications: true,
  enableSounds: true,
  autoStart: true,
  enableLogging: true,
  maxReconnectAttempts: 5,
  messageTimeout: 30000,
  // Mobile optimizations
  enableTouchGestures: true,
  enablePerformanceOptimization: true,
  enableLazyLoading: true,
  lazyLoadBatchSize: performanceOptimizer.isLowEndDevice() ? 10 : 20,
  maxVisibleMessages: performanceOptimizer.isLowEndDevice() ? 50 : 100
};

// Variáveis globais para acesso
window.chatbotApp = null;
window.pwaInstaller = pwaInstaller;
window.performanceOptimizer = performanceOptimizer;

// Inicializa aplicação quando DOM estiver pronto
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Inicializando chatbot com integração MCP...');
  
  try {
    // Inicializa aplicação principal
    window.chatbotApp = new ChatbotApp(config);
    
    // Aguarda inicialização completa
    await new Promise(resolve => {
      const checkInit = () => {
        if (window.chatbotApp.isInitialized) {
          resolve();
        } else {
          setTimeout(checkInit, 100);
        }
      };
      checkInit();
    });
    
    console.log('Chatbot MCP inicializado com sucesso');
    
    // Setup mobile optimizations
    setupMobileOptimizations();
    
    // Adiciona handlers globais para debug
    if (config.enableLogging) {
      window.chatbotStats = () => window.chatbotApp.getStats();
      window.chatbotClearHistory = () => window.chatbotApp.clearHistory();
      window.chatbotRestart = () => {
        window.chatbotApp.destroy();
        window.chatbotApp = new ChatbotApp(config);
      };
      window.pwaStats = () => pwaInstaller.getStatus();
      window.performanceStats = () => performanceOptimizer.getMetrics();
    }
    
  } catch (error) {
    console.error('Erro ao inicializar chatbot:', error);
    
    // Fallback: mostra mensagem de erro
    const errorDiv = document.createElement('div');
    errorDiv.innerHTML = `
      <div style="position: fixed; bottom: 20px; right: 20px; background: #f44336; color: white; padding: 15px; border-radius: 8px; z-index: 10000;">
        <strong>Erro no Chatbot</strong><br>
        Não foi possível inicializar o assistente virtual.<br>
        <button onclick="location.reload()" style="background: white; color: #f44336; border: none; padding: 5px 10px; border-radius: 4px; margin-top: 10px; cursor: pointer;">
          Recarregar
        </button>
      </div>
    `;
    document.body.appendChild(errorDiv);
  }
});

/**
 * Configura otimizações mobile
 */
function setupMobileOptimizations() {
  // Setup PWA event listeners
  document.addEventListener('pwaInstallAvailable', () => {
    console.log('PWA installation available');
  });

  document.addEventListener('pwaInstalled', () => {
    console.log('PWA installed successfully');
    showNotification('App instalado com sucesso!', 'success');
  });

  document.addEventListener('pwaOnline', () => {
    console.log('App is online');
    showNotification('Conexão restaurada', 'success');
  });

  document.addEventListener('pwaOffline', () => {
    console.log('App is offline');
    showNotification('Você está offline', 'warning');
  });

  // Setup performance monitoring
  document.addEventListener('performanceMemoryWarning', (e) => {
    console.warn('Memory usage high:', e.detail);
    showNotification('Uso de memória alto', 'warning');
    
    // Auto cleanup if chatbot is available
    if (window.chatbotApp && typeof window.chatbotApp.clearOldMessages === 'function') {
      window.chatbotApp.clearOldMessages(50);
    }
  });

  document.addEventListener('performancePerformanceWarning', (e) => {
    console.warn('Performance issue:', e.detail);
    if (e.detail.type === 'fps' && e.detail.fps.average < 30) {
      showNotification('Performance baixa detectada', 'warning');
    }
  });

  // Apply low-end optimizations if needed
  if (performanceOptimizer.isLowEndDevice()) {
    document.body.classList.add('low-end-device');
    console.log('Low-end device optimizations applied');
  }
}

/**
 * Mostra notificação para o usuário
 */
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `mobile-notification mobile-notification--${type}`;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${getNotificationColor(type)};
    color: white;
    padding: 12px 16px;
    border-radius: 6px;
    font-size: 14px;
    z-index: 10000;
    max-width: 300px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    animation: slideInRight 0.3s ease-out;
  `;
  notification.textContent = message;

  document.body.appendChild(notification);

  // Remove after 4 seconds
  setTimeout(() => {
    notification.style.animation = 'slideOutRight 0.3s ease-out forwards';
    setTimeout(() => notification.remove(), 300);
  }, 4000);
}

/**
 * Retorna cor da notificação baseada no tipo
 */
function getNotificationColor(type) {
  const colors = {
    success: '#28a745',
    warning: '#ffc107',
    error: '#dc3545',
    info: '#007bff'
  };
  return colors[type] || colors.info;
}

// Handler para limpeza quando página for fechada
window.addEventListener('beforeunload', () => {
  if (window.chatbotApp) {
    window.chatbotApp.destroy();
  }
  if (pwaInstaller) {
    pwaInstaller.destroy();
  }
  if (performanceOptimizer) {
    performanceOptimizer.destroy();
  }
});

// Add notification animations
const notificationStyles = document.createElement('style');
notificationStyles.textContent = `
  @keyframes slideInRight {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  
  @keyframes slideOutRight {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
  }
  
  .low-end-device * {
    animation-duration: 0.1s !important;
    transition-duration: 0.1s !important;
  }
`;
document.head.appendChild(notificationStyles);

// Exporta para uso em outros scripts se necessário
export { config, performanceOptimizer, pwaInstaller };