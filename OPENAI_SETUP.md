# 🤖 Configuração OpenAI - Chatbot Real

## 🚀 Status
✅ **Código atualizado**: MCPConnectionManager agora usa OpenAI API real  
✅ **Dependências instaladas**: openai npm package  
❌ **Chave API**: Precisa ser configurada  

## 🔑 Passo 1: Obter Chave API OpenAI

1. **Acesse**: https://platform.openai.com/api-keys
2. **Faça login** na sua conta OpenAI
3. **Clique em "Create new secret key"**
4. **Copie a chave** (começa com `sk-`)

## ⚙️ Passo 2: Configurar Variáveis de Ambiente

1. **Edite o arquivo**: `backend/.env.development`
2. **Substitua**: `OPENAI_API_KEY=your-openai-api-key-here`
3. **Cole sua chave**: `OPENAI_API_KEY=sk-sua-chave-aqui`

### Exemplo:
```env
OPENAI_API_KEY=sk-proj-abc123def456...
OPENAI_MODEL=gpt-3.5-turbo
OPENAI_MAX_TOKENS=1000
OPENAI_TEMPERATURE=0.7
```

## 🧪 Passo 3: Testar

1. **Reinicie o backend**:
   ```bash
   cd backend
   npm start
   ```

2. **Abra o frontend**:
   ```
   http://localhost:3000/index.html
   ```

3. **Teste o chatbot**:
   - Clique no ícone de chat
   - Digite: "Olá, como você está?"
   - Aguarde a resposta real do ChatGPT!

## 📊 Logs Esperados

### ✅ Sucesso:
```
🤖 Enviando mensagem para OpenAI: Olá, como você está?
✅ Resposta OpenAI enviada: { responseLength: 45, tokensUsed: 23 }
```

### ❌ Erro (chave inválida):
```
❌ Erro ao processar com OpenAI: Invalid API key
```

## 💰 Custos

### **GPT-3.5-turbo** (Recomendado para testes):
- **Input**: $0.0015 / 1K tokens
- **Output**: $0.002 / 1K tokens
- **Mensagem típica**: ~$0.001 (muito barato!)

### **GPT-4** (Mais inteligente, mais caro):
- **Input**: $0.03 / 1K tokens  
- **Output**: $0.06 / 1K tokens
- **Mensagem típica**: ~$0.02

## 🔧 Personalização

### **Mudar o Modelo**:
```env
OPENAI_MODEL=gpt-4  # Mais inteligente
OPENAI_MODEL=gpt-3.5-turbo  # Mais barato
```

### **Personalizar o Prompt**:
```env
OPENAI_SYSTEM_PROMPT=Você é um especialista em tecnologia. Responda de forma técnica e detalhada.
```

### **Ajustar Criatividade**:
```env
OPENAI_TEMPERATURE=0.1  # Mais conservador
OPENAI_TEMPERATURE=0.9  # Mais criativo
```

## 🚨 Troubleshooting

### **Erro: "Invalid API key"**
- ✅ Verifique se a chave começa com `sk-`
- ✅ Verifique se não há espaços extras
- ✅ Gere uma nova chave se necessário

### **Erro: "Insufficient quota"**
- ✅ Adicione créditos na sua conta OpenAI
- ✅ Verifique seu plano em https://platform.openai.com/usage

### **Erro: "Rate limit exceeded"**
- ✅ Aguarde alguns segundos
- ✅ Considere upgrade do plano

## 🎯 Próximos Passos

Após configurar:
1. **Teste diferentes perguntas**
2. **Ajuste o prompt do sistema**
3. **Monitore o uso de tokens**
4. **Configure rate limiting se necessário**

## 📞 Suporte

Se tiver problemas:
1. Verifique os logs do backend
2. Teste a chave API diretamente na OpenAI
3. Consulte a documentação: https://platform.openai.com/docs