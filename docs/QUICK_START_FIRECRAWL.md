# 🚀 Quick Start - Configurar Firecrawl em 5 Minutos

## Método Rápido (Recomendado)

### 1️⃣ Obter Chave Firecrawl

**O site já foi aberto no seu browser!**

Se não abriu, clique aqui: [https://www.firecrawl.dev/](https://www.firecrawl.dev/)

**Passos:**
```
1. Click "Sign Up" ou "Get Started"
2. Criar conta (ou login com GitHub/Google)
3. Ir para: Dashboard > API Keys
4. Clicar "Create API Key"
5. Dar nome: "ProductScout"
6. COPIAR a chave (fc-xxxxxxxxxxxxxxxxxxxxxxxx)
```

⚠️ **IMPORTANTE:** A chave só aparece UMA VEZ! Copie agora!

---

### 2️⃣ Configurar Automaticamente

**Opção A: Script Automático (Mais Fácil)**

1. Execute este ficheiro:
   ```
   configure-firecrawl.bat
   ```

2. Cole a chave quando pedido

3. Pronto! ✅

**Opção B: Manualmente**

1. Abra: `backend\.env` (com Notepad ou VS Code)

2. Encontre esta linha:
   ```bash
   # FIRECRAWL_API_KEY=your-firecrawl-api-key
   ```

3. Altere para (removendo o `#`):
   ```bash
   FIRECRAWL_API_KEY=fc-sua-chave-aqui
   ```

4. Salve (Ctrl+S)

---

### 3️⃣ Reiniciar Backend

**No terminal onde o backend está a correr:**

1. Pressione `Ctrl+C` para parar

2. Execute novamente:
   ```bash
   cd backend
   npm run dev
   ```

**Ou use o script global:**
```bash
start-dev.bat
```

---

### 4️⃣ Testar

**Opção A: Script Automático**
```bash
test-firecrawl.bat
```

**Opção B: Manualmente**

Teste direto Firecrawl:
```bash
curl -X POST https://api.firecrawl.dev/v0/scrape ^
  -H "Authorization: Bearer fc-sua-chave" ^
  -H "Content-Type: application/json" ^
  -d "{\"url\":\"https://www.google.com\"}"
```

Deve retornar:
```json
{"success": true, "data": {...}}
```

---

### 5️⃣ Pesquisar Produto

1. Abra: http://localhost:3000

2. Digite: `arroz`

3. Clique "Search"

4. **Verifique "Stores Status":**
   - Continente: ✅ success
   - Items found: > 0

---

## ✅ Verificação Rápida

### Backend logs devem mostrar:

**ANTES (sem Firecrawl):**
```
[Continente] HTTP blocked, attempting render fallback...
[Continente] FIRECRAWL_API_KEY not configured
```

**DEPOIS (com Firecrawl):**
```
[Continente] HTTP blocked, attempting render fallback...
[Continente] Successfully fetched using render fallback
```

---

## 🆘 Problemas?

### "Invalid API key"
- Copie a chave novamente do dashboard
- Verifique se não tem espaços extras
- Verifique se começa com `fc-`

### "FIRECRAWL_API_KEY not configured"
- Verifique se removeu o `#` antes da linha
- Verifique se salvou o ficheiro `.env`
- **Reinicie o backend completamente**

### Ainda não funciona?
1. Leia o guia completo: `FIRECRAWL_SETUP.md`
2. Execute: `test-firecrawl.bat` e veja os resultados
3. Verifique logs do backend

---

## 📚 Documentação Completa

- **Guia Detalhado:** `FIRECRAWL_SETUP.md`
- **Guia Continente:** `CONTINENTE_FIX_GUIDE.md`
- **Resumo Técnico:** `IMPLEMENTATION_SUMMARY.md`

---

## 🎯 Ficheiros Criados para Você

✅ `configure-firecrawl.bat` - Script de configuração automática
✅ `test-firecrawl.bat` - Script de testes
✅ `FIRECRAWL_SETUP.md` - Guia completo passo-a-passo
✅ `QUICK_START_FIRECRAWL.md` - Este guia rápido

---

## 💰 Planos Firecrawl

- 🆓 **Grátis:** 500 requests/mês (suficiente para testes)
- 💵 **Hobby:** $20/mês = 5,000 requests
- 💵 **Standard:** $79/mês = 25,000 requests

**Para começar, o plano grátis é perfeito!**

---

**Boa sorte! Se precisar de ajuda, consulte `FIRECRAWL_SETUP.md` para detalhes completos.**
