/**
 * PWA Installer utility
 * Handles PWA installation, service worker registration, and offline capabilities
 */
export class PWAInstaller {
  constructor(options = {}) {
    this.options = {
      swPath: options.swPath || '/sw.js',
      manifestPath: options.manifestPath || '/manifest.json',
      enableNotifications: options.enableNotifications !== false,
      enableBackgroundSync: options.enableBackgroundSync !== false,
      showInstallPrompt: options.showInstallPrompt !== false,
      ...options
    };

    this.deferredPrompt = null;
    this.isInstalled = false;
    this.isOnline = navigator.onLine;
    this.registration = null;
    
    this.init();
  }

  /**
   * Initialize PWA installer
   */
  async init() {
    this.checkInstallation();
    this.setupEventListeners();
    await this.registerServiceWorker();
    this.setupOfflineDetection();
    this.requestNotificationPermission();
  }

  /**
   * Check if app is already installed
   */
  checkInstallation() {
    // Check if running in standalone mode
    this.isInstalled = window.matchMedia('(display-mode: standalone)').matches ||
                      window.navigator.standalone === true ||
                      document.referrer.includes('android-app://');

    if (this.isInstalled) {
      console.log('PWA is already installed');
      this.emit('installed');
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Listen for install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      console.log('Install prompt available');
      e.preventDefault();
      this.deferredPrompt = e;
      this.emit('installAvailable');
      
      if (this.options.showInstallPrompt) {
        this.showInstallBanner();
      }
    });

    // Listen for app installed
    window.addEventListener('appinstalled', () => {
      console.log('PWA installed successfully');
      this.isInstalled = true;
      this.deferredPrompt = null;
      this.hideInstallBanner();
      this.emit('installed');
    });

    // Listen for display mode changes
    window.matchMedia('(display-mode: standalone)').addEventListener('change', (e) => {
      this.isInstalled = e.matches;
      this.emit(e.matches ? 'installed' : 'uninstalled');
    });
  }

  /**
   * Register service worker
   */
  async registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
      console.warn('Service Worker not supported');
      return;
    }

    try {
      console.log('Registering service worker...');
      this.registration = await navigator.serviceWorker.register(this.options.swPath);
      
      console.log('Service Worker registered:', this.registration.scope);
      this.emit('serviceWorkerRegistered', { registration: this.registration });

      // Listen for updates
      this.registration.addEventListener('updatefound', () => {
        const newWorker = this.registration.installing;
        console.log('New service worker found');
        
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('New service worker installed, update available');
            this.emit('updateAvailable');
            this.showUpdateBanner();
          }
        });
      });

      // Listen for controller change
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('Service worker controller changed');
        this.emit('controllerChanged');
        window.location.reload();
      });

    } catch (error) {
      console.error('Service Worker registration failed:', error);
      this.emit('serviceWorkerError', { error });
    }
  }

  /**
   * Setup offline detection
   */
  setupOfflineDetection() {
    const updateOnlineStatus = () => {
      const wasOnline = this.isOnline;
      this.isOnline = navigator.onLine;
      
      if (wasOnline !== this.isOnline) {
        this.emit(this.isOnline ? 'online' : 'offline');
        this.showConnectionStatus();
      }
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
  }

  /**
   * Request notification permission
   */
  async requestNotificationPermission() {
    if (!this.options.enableNotifications || !('Notification' in window)) {
      return;
    }

    if (Notification.permission === 'default') {
      try {
        const permission = await Notification.requestPermission();
        console.log('Notification permission:', permission);
        this.emit('notificationPermission', { permission });
      } catch (error) {
        console.error('Error requesting notification permission:', error);
      }
    }
  }

  /**
   * Show install banner
   */
  showInstallBanner() {
    if (this.installBanner) return;

    this.installBanner = document.createElement('div');
    this.installBanner.className = 'pwa-install-banner';
    this.installBanner.innerHTML = `
      <div class="pwa-install-content">
        <div class="pwa-install-icon">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
          </svg>
        </div>
        <div class="pwa-install-text">
          <h3>Instalar App</h3>
          <p>Adicione à tela inicial para acesso rápido</p>
        </div>
        <div class="pwa-install-actions">
          <button class="pwa-install-btn" id="pwa-install-btn">Instalar</button>
          <button class="pwa-install-close" id="pwa-install-close">×</button>
        </div>
      </div>
    `;

    // Add styles
    this.addInstallBannerStyles();

    // Add event listeners
    this.installBanner.querySelector('#pwa-install-btn').addEventListener('click', () => {
      this.install();
    });

    this.installBanner.querySelector('#pwa-install-close').addEventListener('click', () => {
      this.hideInstallBanner();
    });

    document.body.appendChild(this.installBanner);

    // Show with animation
    setTimeout(() => {
      this.installBanner.classList.add('pwa-install-banner--visible');
    }, 100);
  }

  /**
   * Hide install banner
   */
  hideInstallBanner() {
    if (!this.installBanner) return;

    this.installBanner.classList.remove('pwa-install-banner--visible');
    setTimeout(() => {
      if (this.installBanner) {
        this.installBanner.remove();
        this.installBanner = null;
      }
    }, 300);
  }

  /**
   * Add install banner styles
   */
  addInstallBannerStyles() {
    if (document.querySelector('#pwa-install-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'pwa-install-styles';
    styles.textContent = `
      .pwa-install-banner {
        position: fixed;
        bottom: 20px;
        left: 20px;
        right: 20px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        z-index: 10000;
        transform: translateY(100%);
        opacity: 0;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        max-width: 400px;
        margin: 0 auto;
      }

      .pwa-install-banner--visible {
        transform: translateY(0);
        opacity: 1;
      }

      .pwa-install-content {
        display: flex;
        align-items: center;
        padding: 16px;
        gap: 12px;
      }

      .pwa-install-icon {
        width: 40px;
        height: 40px;
        background: #007bff;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        flex-shrink: 0;
      }

      .pwa-install-icon svg {
        width: 20px;
        height: 20px;
      }

      .pwa-install-text {
        flex: 1;
        min-width: 0;
      }

      .pwa-install-text h3 {
        margin: 0 0 4px 0;
        font-size: 16px;
        font-weight: 600;
        color: #333;
      }

      .pwa-install-text p {
        margin: 0;
        font-size: 14px;
        color: #666;
        line-height: 1.3;
      }

      .pwa-install-actions {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-shrink: 0;
      }

      .pwa-install-btn {
        background: #007bff;
        color: white;
        border: none;
        border-radius: 6px;
        padding: 8px 16px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.2s ease;
      }

      .pwa-install-btn:hover {
        background: #0056b3;
      }

      .pwa-install-close {
        background: transparent;
        border: none;
        font-size: 20px;
        color: #999;
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        transition: color 0.2s ease;
      }

      .pwa-install-close:hover {
        color: #666;
      }

      @media (max-width: 480px) {
        .pwa-install-banner {
          left: 10px;
          right: 10px;
          bottom: 10px;
        }

        .pwa-install-content {
          padding: 12px;
        }

        .pwa-install-text h3 {
          font-size: 15px;
        }

        .pwa-install-text p {
          font-size: 13px;
        }
      }
    `;

    document.head.appendChild(styles);
  }

  /**
   * Show update banner
   */
  showUpdateBanner() {
    if (this.updateBanner) return;

    this.updateBanner = document.createElement('div');
    this.updateBanner.className = 'pwa-update-banner';
    this.updateBanner.innerHTML = `
      <div class="pwa-update-content">
        <div class="pwa-update-text">
          <strong>Atualização disponível</strong>
          <p>Uma nova versão está pronta para uso</p>
        </div>
        <button class="pwa-update-btn" id="pwa-update-btn">Atualizar</button>
      </div>
    `;

    // Add styles for update banner
    this.addUpdateBannerStyles();

    this.updateBanner.querySelector('#pwa-update-btn').addEventListener('click', () => {
      this.update();
    });

    document.body.appendChild(this.updateBanner);
  }

  /**
   * Add update banner styles
   */
  addUpdateBannerStyles() {
    if (document.querySelector('#pwa-update-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'pwa-update-styles';
    styles.textContent = `
      .pwa-update-banner {
        position: fixed;
        top: 20px;
        left: 20px;
        right: 20px;
        background: #28a745;
        color: white;
        border-radius: 8px;
        z-index: 10001;
        max-width: 400px;
        margin: 0 auto;
      }

      .pwa-update-content {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        gap: 12px;
      }

      .pwa-update-text strong {
        display: block;
        font-size: 14px;
        margin-bottom: 2px;
      }

      .pwa-update-text p {
        margin: 0;
        font-size: 12px;
        opacity: 0.9;
      }

      .pwa-update-btn {
        background: rgba(255, 255, 255, 0.2);
        color: white;
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: 4px;
        padding: 6px 12px;
        font-size: 12px;
        cursor: pointer;
        transition: background 0.2s ease;
        flex-shrink: 0;
      }

      .pwa-update-btn:hover {
        background: rgba(255, 255, 255, 0.3);
      }
    `;

    document.head.appendChild(styles);
  }

  /**
   * Show connection status
   */
  showConnectionStatus() {
    const status = this.isOnline ? 'online' : 'offline';
    const message = this.isOnline ? 'Conexão restaurada' : 'Você está offline';
    const color = this.isOnline ? '#28a745' : '#dc3545';

    // Remove existing status
    const existing = document.querySelector('.pwa-connection-status');
    if (existing) existing.remove();

    const statusEl = document.createElement('div');
    statusEl.className = 'pwa-connection-status';
    statusEl.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: ${color};
      color: white;
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 14px;
      z-index: 10002;
      animation: slideDown 0.3s ease-out;
    `;
    statusEl.textContent = message;

    document.body.appendChild(statusEl);

    // Remove after 3 seconds
    setTimeout(() => {
      statusEl.style.animation = 'slideUp 0.3s ease-out forwards';
      setTimeout(() => statusEl.remove(), 300);
    }, 3000);
  }

  /**
   * Install PWA
   */
  async install() {
    if (!this.deferredPrompt) {
      console.log('Install prompt not available');
      return false;
    }

    try {
      this.deferredPrompt.prompt();
      const { outcome } = await this.deferredPrompt.userChoice;
      
      console.log('Install prompt result:', outcome);
      this.emit('installPromptResult', { outcome });
      
      this.deferredPrompt = null;
      this.hideInstallBanner();
      
      return outcome === 'accepted';
    } catch (error) {
      console.error('Error during installation:', error);
      this.emit('installError', { error });
      return false;
    }
  }

  /**
   * Update PWA
   */
  update() {
    if (!this.registration || !this.registration.waiting) {
      console.log('No update available');
      return;
    }

    // Tell the waiting service worker to skip waiting
    this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    
    if (this.updateBanner) {
      this.updateBanner.remove();
      this.updateBanner = null;
    }
  }

  /**
   * Check for updates
   */
  async checkForUpdates() {
    if (!this.registration) return;

    try {
      await this.registration.update();
      console.log('Checked for updates');
    } catch (error) {
      console.error('Error checking for updates:', error);
    }
  }

  /**
   * Send message to service worker
   */
  sendMessageToSW(message) {
    if (!this.registration || !this.registration.active) {
      console.warn('Service worker not active');
      return;
    }

    this.registration.active.postMessage(message);
  }

  /**
   * Get installation status
   */
  getStatus() {
    return {
      isInstalled: this.isInstalled,
      isOnline: this.isOnline,
      hasServiceWorker: !!this.registration,
      canInstall: !!this.deferredPrompt,
      notificationPermission: 'Notification' in window ? Notification.permission : 'not-supported'
    };
  }

  /**
   * Emit custom event
   */
  emit(eventName, detail = {}) {
    const event = new CustomEvent(`pwa${eventName.charAt(0).toUpperCase() + eventName.slice(1)}`, {
      detail,
      bubbles: true,
      cancelable: true
    });
    document.dispatchEvent(event);
  }

  /**
   * Destroy PWA installer
   */
  destroy() {
    this.hideInstallBanner();
    
    if (this.updateBanner) {
      this.updateBanner.remove();
    }

    // Remove style elements
    const installStyles = document.querySelector('#pwa-install-styles');
    const updateStyles = document.querySelector('#pwa-update-styles');
    
    if (installStyles) installStyles.remove();
    if (updateStyles) updateStyles.remove();
  }
}