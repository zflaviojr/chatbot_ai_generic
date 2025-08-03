import { jest } from '@jest/globals';
import WebSocket from 'ws';
import { WebSocketHandler } from '../../handlers/WebSocketHandler.js';
import { MCPConnectionManager } from '../../mcp/MCPConnectionManager.js';

// Mock MCP Connection Manager for integration tests
class MockMCPManager {
  constructor() {
    this.isConnected = false;
    this.messageQueue = [];
    this.responseDelay = 50;
  }

  async connect() {
    this.isConnected = true;
    return true;
  }

  async disconnect() {
    this.isConnected = false;
  }

  async sendMessage(message, sessionId) {
    if (!this.isConnected) {
      throw new Error('MCP not connected');
    }

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, this.responseDelay));

    return {
      messageId: `mcp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      content: `Resposta para: ${message}`,
      formattedContent: `<p>Resposta para: ${message}</p>`,
      timestamp: new Date().toISOString(),
      usage: {
        promptTokens: 10,
        completionTokens: 15,
        totalTokens: 25,
        displayText: '25 tokens utilizados'
      },
      metadata: {
        model: 'gpt-4',
        requestId: `req-${Date.now()}`,
        processingTime: this.responseDelay,
        modelDisplayName: 'GPT-4',
        displayProcessingTime: `${this.responseDelay}ms`
      },
      quality: {
        score: 85,
        rating: 'excellent',
        factors: ['comprehensive', 'accurate'],
        displayText: 'Excelente resposta'
      },
      responseTime: `${this.responseDelay}ms`
    };
  }

  getStats() {
    return {
      isConnected: this.isConnected,
      messageCount: this.messageQueue.length,
      lastActivity: new Date().toISOString()
    };
  }
}

describe('WebSocket Stability Integration Tests', () => {
  let wsServer;
  let wsHandler;
  let mockMcpManager;
  let testPort;

  beforeAll(() => {
    // Find available port
    testPort = 3002 + Math.floor(Math.random() * 1000);
  });

  beforeEach(async () => {
    // Create mock MCP manager
    mockMcpManager = new MockMCPManager();
    await mockMcpManager.connect();

    // Create WebSocket handler
    wsHandler = new WebSocketHandler(mockMcpManager);

    // Create WebSocket server
    wsServer = new WebSocket.Server({ 
      port: testPort,
      perMessageDeflate: false 
    });

    // Handle connections
    wsServer.on('connection', (ws, request) => {
      wsHandler.handleConnection(ws, request);
    });

    // Wait for server to start
    await new Promise((resolve) => {
      wsServer.on('listening', resolve);
    });
  });

  afterEach(async () => {
    // Close all connections
    if (wsServer) {
      wsServer.clients.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.terminate();
        }
      });

      // Close server
      await new Promise((resolve) => {
        wsServer.close(resolve);
      });
    }

    // Cleanup handler
    if (wsHandler) {
      wsHandler.cleanup();
    }

    // Disconnect MCP
    if (mockMcpManager) {
      await mockMcpManager.disconnect();
    }
  });

  describe('Connection Stability', () => {
    test('should handle single client connection and disconnection', async () => {
      const client = new WebSocket(`ws://localhost:${testPort}`);
      
      // Wait for connection
      await new Promise((resolve) => {
        client.on('open', resolve);
      });

      expect(client.readyState).toBe(WebSocket.OPEN);
      expect(wsHandler.getStats().connectedClients).toBe(1);

      // Close connection
      client.close();

      // Wait for disconnection
      await new Promise((resolve) => {
        client.on('close', resolve);
      });

      // Wait for handler to process disconnection
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(wsHandler.getStats().connectedClients).toBe(0);
    });

    test('should handle multiple concurrent connections', async () => {
      const clients = [];
      const connectionPromises = [];

      // Create 5 concurrent connections
      for (let i = 0; i < 5; i++) {
        const client = new WebSocket(`ws://localhost:${testPort}`);
        clients.push(client);
        
        connectionPromises.push(new Promise((resolve) => {
          client.on('open', resolve);
        }));
      }

      // Wait for all connections
      await Promise.all(connectionPromises);

      // Verify all connections are established
      expect(wsHandler.getStats().connectedClients).toBe(5);

      // Close all connections
      const closePromises = clients.map(client => {
        client.close();
        return new Promise((resolve) => {
          client.on('close', resolve);
        });
      });

      await Promise.all(closePromises);

      // Wait for handler to process all disconnections
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(wsHandler.getStats().connectedClients).toBe(0);
    });

    test('should handle rapid connection and disconnection cycles', async () => {
      const cycles = 10;
      
      for (let i = 0; i < cycles; i++) {
        const client = new WebSocket(`ws://localhost:${testPort}`);
        
        // Wait for connection
        await new Promise((resolve) => {
          client.on('open', resolve);
        });

        expect(client.readyState).toBe(WebSocket.OPEN);

        // Immediately close
        client.close();

        // Wait for disconnection
        await new Promise((resolve) => {
          client.on('close', resolve);
        });

        // Small delay between cycles
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Wait for all cleanup
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(wsHandler.getStats().connectedClients).toBe(0);
    });

    test('should handle connection drops without proper close', async () => {
      const client = new WebSocket(`ws://localhost:${testPort}`);
      
      await new Promise((resolve) => {
        client.on('open', resolve);
      });

      expect(wsHandler.getStats().connectedClients).toBe(1);

      // Terminate connection abruptly (simulates network drop)
      client.terminate();

      // Wait for handler to detect disconnection
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(wsHandler.getStats().connectedClients).toBe(0);
    });
  });

  describe('Message Handling Stability', () => {
    test('should handle high-frequency message sending', async () => {
      const client = new WebSocket(`ws://localhost:${testPort}`);
      const messageCount = 50;
      const responses = [];

      await new Promise((resolve) => {
        client.on('open', resolve);
      });

      // Listen for responses
      client.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'chatResponse') {
          responses.push(message);
        }
      });

      // Start session first
      client.send(JSON.stringify({
        type: 'startSession',
        messageId: 'session-start'
      }));

      // Wait for session to start
      await new Promise(resolve => setTimeout(resolve, 100));

      // Send multiple messages rapidly
      for (let i = 0; i < messageCount; i++) {
        client.send(JSON.stringify({
          type: 'chat',
          messageId: `msg-${i}`,
          content: `Message ${i}`,
          sessionId: 'test-session'
        }));
      }

      // Wait for all responses
      await new Promise((resolve) => {
        const checkResponses = () => {
          if (responses.length >= messageCount) {
            resolve();
          } else {
            setTimeout(checkResponses, 100);
          }
        };
        checkResponses();
      });

      expect(responses.length).toBe(messageCount);

      // Verify all messages were processed correctly
      for (let i = 0; i < messageCount; i++) {
        const response = responses.find(r => r.content.includes(`Message ${i}`));
        expect(response).toBeTruthy();
      }

      client.close();
    });

    test('should handle malformed messages gracefully', async () => {
      const client = new WebSocket(`ws://localhost:${testPort}`);
      const errorResponses = [];

      await new Promise((resolve) => {
        client.on('open', resolve);
      });

      // Listen for error responses
      client.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'error') {
          errorResponses.push(message);
        }
      });

      // Send malformed messages
      const malformedMessages = [
        'invalid json',
        '{"type": "unknown"}',
        '{"type": "chat"}', // missing required fields
        '{"type": "chat", "content": ""}', // empty content
        JSON.stringify({ type: 'chat', content: 'x'.repeat(10000) }) // too long
      ];

      for (const malformed of malformedMessages) {
        client.send(malformed);
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Wait for error responses
      await new Promise(resolve => setTimeout(resolve, 200));

      // Should have received error responses for malformed messages
      expect(errorResponses.length).toBeGreaterThan(0);

      // Connection should still be alive
      expect(client.readyState).toBe(WebSocket.OPEN);

      client.close();
    });

    test('should handle large message payloads', async () => {
      const client = new WebSocket(`ws://localhost:${testPort}`);
      let response = null;

      await new Promise((resolve) => {
        client.on('open', resolve);
      });

      client.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'chatResponse') {
          response = message;
        }
      });

      // Start session
      client.send(JSON.stringify({
        type: 'startSession',
        messageId: 'session-start'
      }));

      await new Promise(resolve => setTimeout(resolve, 100));

      // Send large message (but within reasonable limits)
      const largeContent = 'A'.repeat(5000);
      client.send(JSON.stringify({
        type: 'chat',
        messageId: 'large-msg',
        content: largeContent,
        sessionId: 'test-session'
      }));

      // Wait for response
      await new Promise((resolve) => {
        const checkResponse = () => {
          if (response) {
            resolve();
          } else {
            setTimeout(checkResponse, 100);
          }
        };
        checkResponse();
      });

      expect(response).toBeTruthy();
      expect(response.content).toContain(largeContent);

      client.close();
    });
  });

  describe('Error Recovery and Resilience', () => {
    test('should recover from MCP connection failures', async () => {
      const client = new WebSocket(`ws://localhost:${testPort}`);
      let errorResponse = null;
      let successResponse = null;

      await new Promise((resolve) => {
        client.on('open', resolve);
      });

      client.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'chatError') {
          errorResponse = message;
        } else if (message.type === 'chatResponse') {
          successResponse = message;
        }
      });

      // Start session
      client.send(JSON.stringify({
        type: 'startSession',
        messageId: 'session-start'
      }));

      await new Promise(resolve => setTimeout(resolve, 100));

      // Disconnect MCP to simulate failure
      await mockMcpManager.disconnect();

      // Send message while MCP is disconnected
      client.send(JSON.stringify({
        type: 'chat',
        messageId: 'msg-during-failure',
        content: 'Message during MCP failure',
        sessionId: 'test-session'
      }));

      // Wait for error response
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(errorResponse).toBeTruthy();
      expect(errorResponse.error).toContain('not connected');

      // Reconnect MCP
      await mockMcpManager.connect();

      // Send another message
      client.send(JSON.stringify({
        type: 'chat',
        messageId: 'msg-after-recovery',
        content: 'Message after MCP recovery',
        sessionId: 'test-session'
      }));

      // Wait for success response
      await new Promise((resolve) => {
        const checkResponse = () => {
          if (successResponse) {
            resolve();
          } else {
            setTimeout(checkResponse, 100);
          }
        };
        checkResponse();
      });

      expect(successResponse).toBeTruthy();
      expect(successResponse.content).toContain('Message after MCP recovery');

      client.close();
    });

    test('should handle WebSocket server restart', async () => {
      let client1 = new WebSocket(`ws://localhost:${testPort}`);
      
      await new Promise((resolve) => {
        client1.on('open', resolve);
      });

      expect(wsHandler.getStats().connectedClients).toBe(1);

      // Close server (simulating restart)
      await new Promise((resolve) => {
        wsServer.close(resolve);
      });

      // Wait for client to detect disconnection
      await new Promise((resolve) => {
        client1.on('close', resolve);
      });

      // Restart server
      wsServer = new WebSocket.Server({ 
        port: testPort,
        perMessageDeflate: false 
      });

      wsServer.on('connection', (ws, request) => {
        wsHandler.handleConnection(ws, request);
      });

      await new Promise((resolve) => {
        wsServer.on('listening', resolve);
      });

      // Create new client connection
      const client2 = new WebSocket(`ws://localhost:${testPort}`);
      
      await new Promise((resolve) => {
        client2.on('open', resolve);
      });

      expect(client2.readyState).toBe(WebSocket.OPEN);

      client2.close();
    });

    test('should handle memory pressure with many connections', async () => {
      const connectionCount = 20;
      const clients = [];
      const connectionPromises = [];

      // Create many connections
      for (let i = 0; i < connectionCount; i++) {
        const client = new WebSocket(`ws://localhost:${testPort}`);
        clients.push(client);
        
        connectionPromises.push(new Promise((resolve) => {
          client.on('open', resolve);
        }));
      }

      await Promise.all(connectionPromises);

      expect(wsHandler.getStats().connectedClients).toBe(connectionCount);

      // Send messages from all clients simultaneously
      const messagePromises = clients.map((client, index) => {
        return new Promise((resolve) => {
          let responseReceived = false;
          
          client.on('message', (data) => {
            const message = JSON.parse(data.toString());
            if (message.type === 'sessionStarted' && !responseReceived) {
              responseReceived = true;
              resolve();
            }
          });

          client.send(JSON.stringify({
            type: 'startSession',
            messageId: `session-${index}`
          }));
        });
      });

      // Wait for all session starts
      await Promise.all(messagePromises);

      // Verify server is still responsive
      expect(wsHandler.getStats().connectedClients).toBe(connectionCount);

      // Close all connections
      const closePromises = clients.map(client => {
        client.close();
        return new Promise((resolve) => {
          client.on('close', resolve);
        });
      });

      await Promise.all(closePromises);

      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(wsHandler.getStats().connectedClients).toBe(0);
    });
  });

  describe('Performance and Scalability', () => {
    test('should maintain performance under load', async () => {
      const client = new WebSocket(`ws://localhost:${testPort}`);
      const messageCount = 100;
      const startTime = Date.now();
      let responsesReceived = 0;

      await new Promise((resolve) => {
        client.on('open', resolve);
      });

      client.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'chatResponse') {
          responsesReceived++;
        }
      });

      // Start session
      client.send(JSON.stringify({
        type: 'startSession',
        messageId: 'session-start'
      }));

      await new Promise(resolve => setTimeout(resolve, 100));

      // Send messages as fast as possible
      for (let i = 0; i < messageCount; i++) {
        client.send(JSON.stringify({
          type: 'chat',
          messageId: `perf-msg-${i}`,
          content: `Performance test message ${i}`,
          sessionId: 'test-session'
        }));
      }

      // Wait for all responses
      await new Promise((resolve) => {
        const checkResponses = () => {
          if (responsesReceived >= messageCount) {
            resolve();
          } else {
            setTimeout(checkResponses, 100);
          }
        };
        checkResponses();
      });

      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const messagesPerSecond = (messageCount / totalTime) * 1000;

      expect(responsesReceived).toBe(messageCount);
      expect(messagesPerSecond).toBeGreaterThan(10); // Should handle at least 10 msg/sec

      client.close();
    });

    test('should handle connection cleanup efficiently', async () => {
      const connectionCycles = 10;
      
      for (let cycle = 0; cycle < connectionCycles; cycle++) {
        const clients = [];
        const connectionPromises = [];

        // Create multiple connections
        for (let i = 0; i < 5; i++) {
          const client = new WebSocket(`ws://localhost:${testPort}`);
          clients.push(client);
          
          connectionPromises.push(new Promise((resolve) => {
            client.on('open', resolve);
          }));
        }

        await Promise.all(connectionPromises);

        // Verify connections
        expect(wsHandler.getStats().connectedClients).toBe(5);

        // Close all connections
        const closePromises = clients.map(client => {
          client.close();
          return new Promise((resolve) => {
            client.on('close', resolve);
          });
        });

        await Promise.all(closePromises);

        // Wait for cleanup
        await new Promise(resolve => setTimeout(resolve, 50));

        // Verify cleanup
        expect(wsHandler.getStats().connectedClients).toBe(0);
      }

      // Final verification - no memory leaks
      expect(wsHandler.getStats().connectedClients).toBe(0);
    });
  });
});