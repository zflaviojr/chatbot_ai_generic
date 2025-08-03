import { MCPConnectionManager } from '../mcp/MCPConnectionManager.js';

describe('MCPConnectionManager', () => {
  let mcpManager;
  
  beforeEach(() => {
    // Configuração de teste
    const testConfig = {
      serverUrl: 'https://test-mcp-server.com',
      apiKey: 'test-api-key',
      modelName: 'gpt-4',
      maxTokens: 1000,
      temperature: 0.7,
      timeout: 5000,
      retryAttempts: 2,
      retryDelay: 100
    };
    
    mcpManager = new MCPConnectionManager(testConfig);
  });

  afterEach(async () => {
    if (mcpManager.isConnected) {
      await mcpManager.disconnect();
    }
  });

  describe('Configuração', () => {
    test('deve validar configuração correta', () => {
      expect(() => {
        new MCPConnectionManager({
          serverUrl: 'https://test.com',
          apiKey: 'key',
          modelName: 'gpt-4'
        });
      }).not.toThrow();
    });

    test('deve rejeitar configuração sem campos obrigatórios', () => {
      expect(() => {
        new MCPConnectionManager({
          serverUrl: 'https://test.com'
          // apiKey e modelName ausentes
        });
      }).toThrow('Configuração MCP inválida');
    });

    test('deve rejeitar maxTokens inválido', () => {
      expect(() => {
        new MCPConnectionManager({
          serverUrl: 'https://test.com',
          apiKey: 'key',
          modelName: 'gpt-4',
          maxTokens: 5000 // Muito alto
        });
      }).toThrow('maxTokens deve estar entre 1 e 4000');
    });

    test('deve rejeitar temperature inválida', () => {
      expect(() => {
        new MCPConnectionManager({
          serverUrl: 'https://test.com',
          apiKey: 'key',
          modelName: 'gpt-4',
          temperature: 3.0 // Muito alto
        });
      }).toThrow('temperature deve estar entre 0 e 2');
    });
  });

  describe('Conexão', () => {
    test('deve conectar com sucesso', async () => {
      const connectPromise = mcpManager.connect();
      
      // Verifica se emite evento de conexão
      const connectedPromise = new Promise(resolve => {
        mcpManager.once('connected', resolve);
      });

      const result = await connectPromise;
      await connectedPromise;

      expect(result).toBe(true);
      expect(mcpManager.isConnected).toBe(true);
    });

    test('deve retornar estatísticas corretas', () => {
      const stats = mcpManager.getStats();
      
      expect(stats).toHaveProperty('isConnected');
      expect(stats).toHaveProperty('activeRequests');
      expect(stats).toHaveProperty('connectionAttempts');
      expect(stats).toHaveProperty('config');
      expect(stats.config).toHaveProperty('modelName', 'gpt-4');
    });

    test('deve desconectar corretamente', async () => {
      await mcpManager.connect();
      expect(mcpManager.isConnected).toBe(true);

      const disconnectedPromise = new Promise(resolve => {
        mcpManager.once('disconnected', resolve);
      });

      await mcpManager.disconnect();
      await disconnectedPromise;

      expect(mcpManager.isConnected).toBe(false);
    });
  });

  describe('Envio de Mensagens', () => {
    beforeEach(async () => {
      await mcpManager.connect();
    });

    test('deve enviar mensagem com sucesso', async () => {
      const testMessage = 'Olá, como você está?';
      const sessionId = 'test-session-123';

      const response = await mcpManager.sendMessage(testMessage, sessionId);

      expect(response).toHaveProperty('id');
      expect(response).toHaveProperty('sessionId', sessionId);
      expect(response).toHaveProperty('message');
      expect(response).toHaveProperty('usage');
      expect(response.usage).toHaveProperty('totalTokens');
    });

    test('deve rejeitar mensagem vazia', async () => {
      await expect(mcpManager.sendMessage('')).rejects.toThrow('Mensagem inválida');
      await expect(mcpManager.sendMessage('   ')).rejects.toThrow('Mensagem inválida');
      await expect(mcpManager.sendMessage(null)).rejects.toThrow('Mensagem inválida');
    });

    test('deve rejeitar mensagem quando desconectado', async () => {
      await mcpManager.disconnect();
      
      await expect(
        mcpManager.sendMessage('teste')
      ).rejects.toThrow('Conexão MCP não estabelecida');
    });

    test('deve gerar IDs únicos para requisições', () => {
      const id1 = mcpManager.generateRequestId();
      const id2 = mcpManager.generateRequestId();
      
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^mcp_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^mcp_\d+_[a-z0-9]+$/);
    });
  });

  describe('Tratamento de Erros', () => {
    test('deve emitir evento de erro em falha de conexão', (done) => {
      // Cria manager com configuração que falhará na conexão
      const invalidManager = new MCPConnectionManager({
        serverUrl: 'https://invalid-server.com',
        apiKey: 'test',
        modelName: 'gpt-4',
        retryAttempts: 1, // Reduz tentativas para acelerar o teste
        retryDelay: 50
      });

      // Mock do healthCheck para simular falha
      invalidManager.healthCheck = () => Promise.reject(new Error('Connection failed'));

      let errorReceived = false;
      
      invalidManager.once('error', (error) => {
        if (!errorReceived) {
          errorReceived = true;
          expect(error).toBeInstanceOf(Error);
          done();
        }
      });

      // Também escuta o evento de falha de conexão para limpar
      invalidManager.once('connectionFailed', () => {
        if (!errorReceived) {
          done();
        }
      });

      invalidManager.connect();
    });

    test('deve limpar requisições ativas ao desconectar', async () => {
      await mcpManager.connect();
      
      // Simula requisição ativa
      mcpManager.activeRequests.set('test-req-1', { startTime: Date.now() });
      mcpManager.activeRequests.set('test-req-2', { startTime: Date.now() });
      
      expect(mcpManager.activeRequests.size).toBe(2);
      
      await mcpManager.disconnect();
      
      expect(mcpManager.activeRequests.size).toBe(0);
    });
  });

  describe('Health Check', () => {
    test('deve realizar health check com sucesso', async () => {
      const healthResult = await mcpManager.healthCheck();
      
      expect(healthResult).toHaveProperty('status', 'ok');
      expect(healthResult).toHaveProperty('timestamp');
    });
  });
});