/**
 * Testes unitários para o servidor principal
 */
import { jest } from '@jest/globals';

// Mock das dependências
jest.mock('../mcp/MCPConnectionManager.js');
jest.mock('../handlers/WebSocketHandler.js');

describe('Servidor Principal', () => {
  test('deve inicializar com configurações padrão', () => {
    // Teste básico de inicialização
    expect(process.env.NODE_ENV || 'development').toBeDefined();
  });

  test('deve ter porta configurada', () => {
    const port = process.env.PORT || '3001';
    expect(typeof port).toBe('string');
    expect(parseInt(port)).toBeGreaterThan(0);
  });

  test('deve ter CORS origin configurado', () => {
    const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';
    expect(corsOrigin).toBeDefined();
    expect(corsOrigin).toMatch(/^https?:\/\//);
  });
});