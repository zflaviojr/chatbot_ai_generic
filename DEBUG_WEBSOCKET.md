# 🔧 Guia de Debug WebSocket - Chatbot MCP

## Problema Identificado
- ✅ Analytics HTTP funcionando (frontend → backend)
- ❌ Mensagens WebSocket não chegam ao backend
- ❌ Não vemos logs "Backend: handleChatMessage chamado"

## Testes Criados

### 1. Teste Direto WebSocket
**Arquivo:** `frontend/direct-websocket-test.html`
**Como usar:**
1. Inicie o backend: `cd backend && npm start`
2. Abra: `http://localhost:3000/direct-websocket-test.html`
3. Clique em "Conectar"
4. Digite uma mensagem e clique "Enviar Chat"
5. Verifique os logs no console do backend

### 2. Teste WebSocket Avançado
**Arquivo:** `frontend/websocket-debug.html`
**Como usar:**
1. Abra: `http://localhost:3000/websocket-debug.html`
2. Conecta automaticamente
3. Teste diferentes tipos de mensagem
4. Logs detalhados na página

### 3. Teste Backend Direto
**Arquivo:** `backend/test-websocket.js`
**Como usar:**
```bash
cd backend
node test-websocket.js
```

## Logs Adicionados

### Backend (WebSocketHandler.js)
- ✅ Log na configuração do servidor
- ✅ Log em novas conexões
- ✅ Log detalhado no recebimento de mensagens
- ✅ Log no parsing de mensagens
- ✅ Correção da variável `responseTime`

### Pontos de Verificação

1. **Servidor WebSocket está rodando?**
   - Verifique se vê: "📡 WebSocket disponível em ws://localhost:3001/ws"

2. **Conexão está sendo estabelecida?**
   - Deve ver: "🔗 WebSocketHandler: Nova conexão recebida"

3. **Mensagens estão chegando?**
   - Deve ver: "📥 WebSocketHandler: Mensagem recebida do cliente"

4. **Parsing está funcionando?**
   - Deve ver: "📋 WebSocketHandler: Mensagem parseada"

5. **Handler está sendo chamado?**
   - Deve ver: "Backend: handleChatMessage chamado"

## Possíveis Causas

### 1. Problema de Roteamento
- WebSocket pode não estar configurado corretamente no servidor
- Path `/ws` pode não estar sendo reconhecido

### 2. Problema de CORS
- WebSocket pode estar sendo bloqueado por CORS
- Verificar configuração em `backend/src/config/environment.js`

### 3. Problema de Parsing
- Mensagens podem estar chegando mas com formato incorreto
- JSON pode estar malformado

### 4. Problema de Event Listeners
- Handlers podem não estar sendo configurados corretamente
- Event listeners podem não estar funcionando

## Comandos de Teste

### Teste Completo
```bash
# Terminal 1 - Backend
cd backend
npm start

# Terminal 2 - Frontend (se usando servidor)
cd frontend
npx serve -s . -l 3000

# Ou abrir diretamente os arquivos HTML
```

### Teste Backend Isolado
```bash
cd backend
node test-websocket.js
```

### Verificar Logs
- Backend: Console onde rodou `npm start`
- Frontend: DevTools → Console
- Páginas de debug: Logs na própria página

## Próximos Passos

1. **Execute o teste direto** (`direct-websocket-test.html`)
2. **Verifique os logs** no console do backend
3. **Identifique onde para** o fluxo de mensagens
4. **Reporte os resultados** para continuar o debug

## Logs Esperados (Backend)

```
🚀 Servidor rodando na porta 3001
📡 WebSocket disponível em ws://localhost:3001/ws
🔧 WebSocketHandler: Configurando servidor WebSocket...
🔗 WebSocketHandler: Nova conexão recebida de: ::1
🔧 WebSocketHandler: Configurando handlers para cliente: client_xxx
📥 WebSocketHandler: Mensagem recebida do cliente: client_xxx dados: {"type":"chat",...}
📋 WebSocketHandler: Mensagem parseada: {type: "chat", content: "teste"}
Backend: handleChatMessage chamado {clientId: "client_xxx", message: {...}}
```

Se algum desses logs não aparecer, sabemos onde está o problema!