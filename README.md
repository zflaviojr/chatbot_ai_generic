# Chatbot Web MCP

Um chatbot web que se conecta com ChatGPT e a outros modelos (via OpenRouter) através do protocolo MCP (Model Context Protocol).

## Estrutura do Projeto

```
├── frontend/           # Frontend da aplicação web
│   ├── src/
│   │   ├── components/ # Componentes do chatbot
│   │   ├── styles/     # Estilos CSS
│   │   └── __tests__/  # Testes do frontend
│   ├── package.json
│   └── vite.config.js
├── backend/            # Backend API server
│   ├── src/
│   │   ├── handlers/   # WebSocket handlers
│   │   ├── mcp/        # MCP connection manager
│   │   ├── routes/     # API routes
│   │   └── __tests__/  # Testes do backend
│   └── package.json
└── .kiro/specs/        # Documentação do projeto
```

## Desenvolvimento

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Backend
```bash
cd backend
npm install
cp .env.example .env
# Configure as variáveis de ambiente
npm run dev
```

## Scripts Disponíveis

### Frontend
- `npm run dev` - Servidor de desenvolvimento
- `npm run build` - Build para produção
- `npm run lint` - Verificar código
- `npm run format` - Formatar código

### Backend
- `npm run dev` - Servidor de desenvolvimento com nodemon
- `npm start` - Iniciar servidor
- `npm test` - Executar testes
- `npm run lint` - Verificar código
- `npm run format` - Formatar código