/**
 * @jest-environment jsdom
 */

import { ChatInterface } from '../components/ChatInterface.js';

describe('ChatInterface - Integração MCP', () => {
  test('should be defined', () => {
    expect(ChatInterface).toBeDefined();
  });
});