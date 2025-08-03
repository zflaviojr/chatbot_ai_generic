import { EventEmitter } from 'events';

/**
 * Handler WebSocket simplificado para comunicação em tempo real do chatbot
 */
export class WebSocketHandler extends EventEmitter {
  constructor(wss, mcpManager) {
    super();
    
    this.wss = wss;
    this.mcpManager = mcpManager;
    this.clients = new Map();
    this.sessions = new Map();
    
    console.log('WebSocketHandler inicializado');
  }

  /**
   * Configura o servidor WebSocket
   */
  setupWebSocketServer() {
    this.wss.on('connection', (ws, request) => {
      const clientIp = request.socket.remoteAddress || 'unknown';
      const clientId = this.generateClientId();
      
      const clientInfo = {
        id: clientId,
        ws: ws,
        ip: clientIp,
        connectedAt: new Date(),
        lastActivity: new Date(),
        sessionId: null,
        messageCount: 0
      };

      this.clients.set(clientId, clientInfo);
      
      console.log(`Cliente conectado: ${clientId}`);

      // Send welcome message
      this.sendToClient(clientId, {
        type: 'connection',
        status: 'connected',
        clientId: clientId,
        message: 'Conectado ao chatbot com sucesso!'
      });

      this.setupClientHandlers(clientId, ws);
    });

    this.wss.on('error', (error) => {
      console.error('Erro no WebSocket Server:', error.message);
      this.emit('error', error);
    });
  }

  /**
   * Configura handlers para um cliente específico
   */
  setupClientHandlers(clientId, ws) {
    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        await this.handleClientMessage(clientId, message);
      } catch (error) {
        console.warn(`Erro ao processar mensagem do cliente ${clientId}:`, error.message);
        
        this.sendToClient(clientId, {
          error: true,
          code: 'INVALID_MESSAGE',
          message: 'Formato de mensagem inválido'
        });
      }
    });

    ws.on('close', (code, reason) => {
      console.log(`Cliente desconectado: ${clientId}`);
      this.handleClientDisconnect(clientId);
    });

    ws.on('error', (error) => {
      console.error(`Erro na conexão do cliente ${clientId}:`, error.message);
      this.handleClientDisconnect(clientId);
    });
  }

  /**
   * Processa mensagens recebidas dos clientes
   */
  async handleClientMessage(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client) {
      console.warn(`Cliente não encontrado: ${clientId}`);
      return;
    }

    client.lastActivity = new Date();
    client.messageCount++;

    console.log(`Mensagem recebida de ${clientId}:`, message.type);

    switch (message.type) {
      case 'chat':
        await this.handleChatMessage(clientId, message);
        break;
        
      case 'ping':
        this.sendToClient(clientId, { 
          type: 'pong', 
          timestamp: new Date().toISOString() 
        });
        break;
        
      default:
        console.warn(`Tipo de mensagem desconhecido: ${message.type}`);
        this.sendToClient(clientId, {
          error: true,
          code: 'UNKNOWN_MESSAGE_TYPE',
          message: `Tipo de mensagem não suportado: ${message.type}`
        });
    }
  }

  /**
   * Processa mensagens de chat
   */
  async handleChatMessage(clientId, message) {
    try {
      // Basic validation
      if (!message.content || typeof message.content !== 'string') {
        this.sendToClient(clientId, {
          error: true,
          code: 'INVALID_CONTENT',
          message: 'Conteúdo da mensagem é obrigatório'
        });
        return;
      }

      const sanitizedContent = message.content.trim();
      if (sanitizedContent.length === 0) {
        this.sendToClient(clientId, {
          error: true,
          code: 'EMPTY_MESSAGE',
          message: 'Mensagem não pode estar vazia'
        });
        return;
      }

      // Send typing indicator
      this.sendToClient(clientId, {
        type: 'typing',
        isTyping: true,
        timestamp: new Date().toISOString()
      });

      // Process message via MCP
      try {
        const mcpResponse = await this.mcpManager.sendMessage(sanitizedContent);
        
        // Stop typing indicator
        this.sendToClient(clientId, {
          type: 'typing',
          isTyping: false,
          timestamp: new Date().toISOString()
        });

        // Send response
        this.sendToClient(clientId, {
          type: 'chat_response',
          messageId: message.messageId,
          content: mcpResponse.message || 'Resposta não disponível',
          timestamp: new Date().toISOString()
        });

        console.log(`Resposta MCP enviada para ${clientId}`);

      } catch (mcpError) {
        console.error(`Erro MCP para ${clientId}:`, mcpError.message);
        
        // Stop typing indicator
        this.sendToClient(clientId, {
          type: 'typing',
          isTyping: false,
          timestamp: new Date().toISOString()
        });

        // Send error response
        this.sendToClient(clientId, {
          type: 'chat_error',
          messageId: message.messageId,
          message: 'Erro interno do servidor. Nossa equipe foi notificada.',
          errorCode: 'INTERNAL_ERROR',
          timestamp: new Date().toISOString(),
          retryable: true
        });
      }

    } catch (error) {
      console.error(`Erro ao processar chat para ${clientId}:`, error.message);
      
      this.sendToClient(clientId, {
        type: 'chat_error',
        messageId: message.messageId,
        message: 'Erro interno ao processar mensagem',
        errorCode: 'PROCESSING_ERROR',
        timestamp: new Date().toISOString(),
        retryable: false
      });
    }
  }

  /**
   * Handles client disconnect
   */
  handleClientDisconnect(clientId) {
    const client = this.clients.get(clientId);
    
    if (client) {
      if (client.sessionId) {
        this.sessions.delete(client.sessionId);
      }
      
      this.clients.delete(clientId);
      
      console.log(`Cliente removido: ${clientId}`);
    }
  }

  /**
   * Sends message to specific client
   */
  sendToClient(clientId, message) {
    const client = this.clients.get(clientId);
    
    if (client && client.ws.readyState === client.ws.OPEN) {
      try {
        client.ws.send(JSON.stringify(message));
        return true;
      } catch (error) {
        console.error(`Erro ao enviar mensagem para cliente ${clientId}:`, error.message);
        this.handleClientDisconnect(clientId);
        return false;
      }
    }
    
    return false;
  }

  /**
   * Broadcasts message to all clients
   */
  broadcast(message) {
    let sentCount = 0;
    
    for (const [clientId] of this.clients) {
      if (this.sendToClient(clientId, message)) {
        sentCount++;
      }
    }
    
    console.log(`Broadcast enviado para ${sentCount} clientes`);
    return sentCount;
  }

  /**
   * Generates unique client ID
   */
  generateClientId() {
    return `client_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Generates unique session ID
   */
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Returns WebSocket statistics
   */
  getStats() {
    return {
      connectedClients: this.clients.size,
      activeSessions: this.sessions.size
    };
  }

  /**
   * Gracefully shuts down WebSocket handler
   */
  async shutdown() {
    console.log('Iniciando shutdown do WebSocketHandler');
    
    this.broadcast({
      type: 'system',
      message: 'Servidor sendo reiniciado. Reconecte em alguns instantes.',
      timestamp: new Date().toISOString()
    });

    for (const [clientId, client] of this.clients) {
      if (client.ws.readyState === client.ws.OPEN) {
        client.ws.close(1000, 'Servidor sendo reiniciado');
      }
    }

    this.clients.clear();
    this.sessions.clear();

    console.log('WebSocketHandler encerrado com sucesso');
  }
}

