import express from 'express';
import logger from '../utils/logger.js';
import monitoring from '../utils/monitoring.js';
import { createErrorResponse } from '../middleware/errorHandler.js';

const router = express.Router();

// Middleware para logging das rotas da API
router.use((req, res, next) => {
  logger.info('API request', {
    method: req.method,
    url: req.originalUrl,
    userAgent: req.headers['user-agent'],
    ip: req.ip
  });
  next();
});

// Rota para informações do chatbot
router.get('/info', (req, res) => {
  res.json({
    name: 'Chatbot Web MCP',
    version: '1.0.0',
    description: 'Chatbot web que se conecta com ChatGPT através do protocolo MCP',
    features: [
      'Comunicação em tempo real via WebSocket',
      'Integração com ChatGPT via MCP',
      'Interface responsiva para mobile',
      'Gerenciamento de sessões de chat'
    ],
    endpoints: {
      websocket: '/ws',
      health: '/health',
      config: '/config'
    }
  });
});

// Rota para estatísticas básicas
router.get('/stats', (req, res) => {
  try {
    const metrics = monitoring.getMetrics();
    res.json({
      success: true,
      data: {
        requests: metrics.requests,
        websocket: metrics.websocket,
        mcp: metrics.mcp,
        uptime: metrics.server.uptime
      }
    });
  } catch (error) {
    logger.error('Failed to get stats', { error: error.message });
    res.status(500).json(createErrorResponse(
      'STATS_ERROR',
      'Erro ao obter estatísticas'
    ));
  }
});

// Rota para validação de mensagens
router.post('/validate-message', async (req, res) => {
  try {
    const { message } = req.body;
    
    // Validação básica
    if (!message || typeof message !== 'string') {
      return res.status(400).json(createErrorResponse(
        'INVALID_MESSAGE',
        'Mensagem é obrigatória e deve ser uma string'
      ));
    }
    
    const sanitizedMessage = message.trim();
    if (sanitizedMessage.length === 0) {
      return res.status(400).json(createErrorResponse(
        'EMPTY_MESSAGE',
        'Mensagem não pode estar vazia'
      ));
    }

    if (sanitizedMessage.length > 4000) {
      return res.status(400).json(createErrorResponse(
        'MESSAGE_TOO_LONG',
        'Mensagem muito longa. Máximo 4000 caracteres'
      ));
    }

    logger.info('Message validation successful', {
      messageLength: sanitizedMessage.length,
      ip: req.ip
    });

    res.json({
      valid: true,
      message: 'Mensagem válida',
      length: sanitizedMessage.length,
      sanitized: sanitizedMessage !== message
    });

  } catch (error) {
    logger.error('Error validating message', {
      error: error.message,
      ip: req.ip
    });
    
    res.status(500).json(createErrorResponse(
      'VALIDATION_ERROR',
      'Erro interno ao validar mensagem'
    ));
  }
});

// Analytics endpoint for frontend data collection
router.post('/analytics', async (req, res) => {
  try {
    const { sessionId, interactions, errors, performance, engagement } = req.body;
    
    if (!sessionId) {
      return res.status(400).json(createErrorResponse(
        'MISSING_SESSION_ID',
        'Session ID é obrigatório'
      ));
    }
    
    // Process frontend analytics data
    if (interactions && Array.isArray(interactions)) {
      interactions.forEach(interaction => {
        if (interaction.eventType === 'chat_interaction') {
          monitoring.trackChatInteraction({
            sessionId: interaction.sessionId,
            messageType: interaction.data.interactionType,
            messageLength: interaction.data.messageLength || 0,
            responseTime: interaction.data.responseTime || 0,
            success: interaction.data.success !== false
          });
        }
      });
    }
    
    // Process frontend errors
    if (errors && Array.isArray(errors)) {
      errors.forEach(error => {
        monitoring.trackError('FRONTEND_ERROR', {
          sessionId: error.sessionId,
          errorMessage: error.error.message,
          errorName: error.error.name,
          context: error.context,
          url: error.url,
          userAgent: error.userAgent
        });
      });
    }
    
    logger.info('Frontend analytics received', {
      sessionId,
      interactionCount: interactions?.length || 0,
      errorCount: errors?.length || 0,
      performanceMetricCount: performance?.length || 0,
      engagement: engagement ? {
        sessionDuration: engagement.sessionDuration,
        totalInteractions: engagement.totalInteractions,
        chatInteractions: engagement.chatInteractions
      } : null
    });
    
    res.json({
      success: true,
      message: 'Analytics data processed successfully',
      processed: {
        interactions: interactions?.length || 0,
        errors: errors?.length || 0,
        performance: performance?.length || 0
      }
    });
    
  } catch (error) {
    logger.error('Error processing analytics data', {
      error: error.message,
      ip: req.ip
    });
    
    res.status(500).json(createErrorResponse(
      'ANALYTICS_ERROR',
      'Erro interno ao processar dados de analytics'
    ));
  }
});

export default router;