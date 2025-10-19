# Firecrawl Setup Guide - Passo a Passo

## 📋 O que é o Firecrawl?

Firecrawl é um serviço que renderiza páginas JavaScript usando browsers reais (como Puppeteer/Playwright) e retorna o HTML completo. Isto permite contornar proteções anti-bot que bloqueiam requests HTTP normais.

**Vantagens:**
- ✅ Renderiza JavaScript (React, Vue, Angular, etc.)
- ✅ Contorna Cloudflare, Akamai e outras proteções
- ✅ Não precisa de manter browsers próprios
- ✅ API simples e rápida

**Custos:**
- 🆓 **Plano Grátis:** 500 requests/mês
- 💰 **Plano Hobby:** $20/mês = 5,000 requests
- 💰 **Plano Standard:** $79/mês = 25,000 requests

---

## 🚀 Passo 1: Criar Conta Firecrawl

### Opção A: Através do Website (Recomendado)

1. **Abra o browser** e vá para: https://www.firecrawl.dev/

2. **Clique em "Sign Up"** ou "Get Started"

3. **Preencha os dados:**
   - Email: seu-email@exemplo.com
   - Password: (escolha uma senha forte)

   OU faça login com:
   - GitHub
   - Google

4. **Verifique o email** (se necessário)

5. **Complete o onboarding:**
   - Nome do projeto (ex: "ProductScout")
   - Casos de uso: "Web Scraping" / "Data Extraction"

### Opção B: Através da CLI (Alternativo)

Se preferir usar a linha de comando:

```bash
npm install -g firecrawl-cli
firecrawl auth login
```

---

## 🔑 Passo 2: Obter API Key

### No Dashboard Firecrawl:

1. **Após login, vá para:** Dashboard > API Keys
   - URL direta: https://www.firecrawl.dev/app/api-keys

2. **Clique em "Create API Key"**

3. **Dê um nome à chave:**
   - Nome: "ProductScout Backend"
   - Descrição: "Para scraping de produtos portugueses"

4. **Copie a chave** (formato: `fc-xxxxxxxxxxxxxxxxxxxxxxxx`)

   ⚠️ **IMPORTANTE:** A chave só é mostrada UMA VEZ!
   - Copie imediatamente
   - Cole num local seguro
   - Não partilhe com ninguém

5. **Guarde a chave**
   - Cole num ficheiro temporário
   - Ou vá direto ao Passo 3

---

## 📝 Passo 3: Configurar no ProductScout

### 3.1 - Abrir ficheiro .env

Abra o ficheiro `.env` no backend:

**Windows:**
```bash
cd backend
notepad .env
```

**VS Code:**
```bash
cd backend
code .env
```

**Ou navegue manualmente:**
```
ProductScout/backend/.env
```

### 3.2 - Adicionar a Chave

Encontre esta linha:
```bash
# Firecrawl (optional - for render mode)
# FIRECRAWL_API_KEY=your-firecrawl-api-key
```

**Descomente e cole sua chave:**
```bash
# Firecrawl (optional - for render mode)
FIRECRAWL_API_KEY=fc-xxxxxxxxxxxxxxxxxxxxxxxx
```

⚠️ **Atenção:**
- Remova o `#` antes de `FIRECRAWL_API_KEY`
- Substitua `fc-xxxxxxxxxxxxxxxxxxxxxxxx` pela SUA chave real
- Não use aspas `"` ou `'`
- Não deixe espaços antes/depois do `=`

### 3.3 - Verificar o Ficheiro Completo

Seu `.env` deve ficar assim:

```bash
# Server
PORT=3001
NODE_ENV=development

# Supabase - COLE AQUI AS SUAS CREDENCIAIS
SUPABASE_URL=https://zssuffmrgchloymtgmlo.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Firecrawl (optional - for render mode)
FIRECRAWL_API_KEY=fc-sua-chave-real-aqui

# Cache
CACHE_TTL_SECONDS=600

# Rate limiting
MAX_CONCURRENT_REQUESTS=3
REQUEST_DELAY_MS=1000
```

### 3.4 - Salvar o Ficheiro

- **Ctrl + S** (Windows)
- **Cmd + S** (Mac)
- Ou File > Save

---

## 🔄 Passo 4: Reiniciar o Backend

### 4.1 - Parar o Backend Atual

Se o backend estiver a correr:

**No terminal onde está a correr:**
- Pressione **Ctrl + C** (Windows/Linux)
- Pressione **Cmd + C** (Mac)

Ou use o script:
```bash
taskkill /F /IM node.exe /T
```

### 4.2 - Reiniciar o Backend

**Opção A: Script de desenvolvimento**
```bash
cd backend
npm run dev
```

**Opção B: Script global (se criou)**
```bash
# Na raiz do projeto
start-dev.bat
```

### 4.3 - Verificar Logs

Deve ver:
```
🚀 Product Scout API running on http://localhost:3001
📊 Health check: http://localhost:3001/health
```

**NÃO deve ver:**
```
FIRECRAWL_API_KEY not configured
```

Se ainda vê esta mensagem, volte ao Passo 3!

---

## ✅ Passo 5: Testar a Configuração

### 5.1 - Testar Firecrawl Diretamente

Abra um novo terminal e teste se a chave funciona:

```bash
curl -X POST https://api.firecrawl.dev/v0/scrape ^
  -H "Authorization: Bearer fc-sua-chave-aqui" ^
  -H "Content-Type: application/json" ^
  -d "{\"url\":\"https://www.google.com\"}"
```

**Resultado esperado:**
```json
{
  "success": true,
  "data": {
    "html": "<!DOCTYPE html><html>...",
    "content": "Google Search...",
    ...
  }
}
```

**Erro comum:**
```json
{
  "success": false,
  "error": "Invalid API key"
}
```
→ Volte ao Passo 2 e verifique a chave!

### 5.2 - Testar ProductScout API

```bash
curl http://localhost:3001/health
```

**Esperado:**
```json
{"status":"ok","timestamp":"2025-10-18T..."}
```

### 5.3 - Testar Pesquisa com Fallback

```bash
curl -X POST http://localhost:3001/api/search ^
  -H "Content-Type: application/json" ^
  -d "{\"query\":\"arroz\",\"debug\":false}"
```

**Verifique os logs do backend** (no terminal onde está a correr):

**Antes (sem Firecrawl):**
```
[Continente] HTTP blocked, attempting render fallback...
[Continente] FIRECRAWL_API_KEY not configured, cannot use render fallback
```

**Depois (com Firecrawl):**
```
[Continente] HTTP blocked, attempting render fallback...
[Continente] Successfully fetched using render fallback
```

---

## 🧪 Passo 6: Testar Supplier Específico

### 6.1 - Obter ID do Continente

No Supabase SQL Editor:
```sql
SELECT id, name, mode, enabled
FROM suppliers
WHERE name = 'Continente';
```

Copie o `id` (UUID formato: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

### 6.2 - Testar Continente

```bash
curl -X POST http://localhost:3001/api/test-supplier ^
  -H "Content-Type: application/json" ^
  -d "{\"supplier_id\":\"UUID-DO-CONTINENTE-AQUI\",\"query\":\"arroz\",\"debug\":true}"
```

### 6.3 - Analisar Resultado

**Sucesso:**
```json
{
  "search_run": {
    "status": "success",
    "engine": "render",
    "items_found": 12,
    "debug_snapshot_url": "https://..."
  },
  "items": [
    {
      "name": "Arroz Carolino...",
      "price": 1.99,
      ...
    }
  ]
}
```

**Ainda bloqueado:**
```json
{
  "search_run": {
    "status": "error",
    "error_message": "BLOCKED_BY_ROBOT",
    ...
  }
}
```

Se ainda está bloqueado:
- Abra `debug_snapshot_url` no browser
- Verifique se há captcha ou outra proteção
- Pode precisar de ajustar selectors

---

## 🎨 Passo 7: Testar na Interface Web

### 7.1 - Abrir Frontend

```bash
# Se não estiver a correr
cd frontend
npm run dev

# Depois abra
http://localhost:3000
```

### 7.2 - Fazer Pesquisa

1. Digite "arroz" na caixa de pesquisa
2. Clique "Search"
3. Aguarde 3-5 segundos
4. Verifique "Stores Status"

### 7.3 - Verificar Resultados

**Continente deve mostrar:**
- Status: ✅ success
- Items: > 0
- (Pode clicar "View details" para ver engine: "render")

**Se mostrar erro:**
- Clique "View details"
- Veja o error_message
- Abra debug_snapshot_url para inspecionar

---

## 🔧 Troubleshooting

### Problema 1: "Invalid API key"

**Sintoma:**
```json
{"success": false, "error": "Invalid API key"}
```

**Solução:**
1. Verifique se copiou a chave completa (começa com `fc-`)
2. Verifique se não tem espaços extras
3. Verifique se a chave está ativa no dashboard Firecrawl
4. Tente criar uma nova chave

### Problema 2: "FIRECRAWL_API_KEY not configured"

**Sintoma:**
```
[Supplier] FIRECRAWL_API_KEY not configured, cannot use render fallback
```

**Solução:**
1. Verifique se `.env` tem a chave (sem `#`)
2. Verifique se salvou o ficheiro
3. **IMPORTANTE:** Reinicie o backend completamente
4. Verifique se não há outro ficheiro `.env` a sobrescrever

### Problema 3: "Too many requests" / 429

**Sintoma:**
```json
{"success": false, "error": "Rate limit exceeded"}
```

**Solução:**
1. Está no limite do plano grátis (500/mês)
2. Aguarde reset mensal OU
3. Upgrade para plano pago
4. Reduza frequência de testes

### Problema 4: Backend não carrega .env

**Sintoma:**
Chave está no `.env` mas backend não a vê

**Solução:**
```bash
# 1. Verifique se está no diretório correto
cd backend
ls .env  # Deve existir

# 2. Verifique conteúdo
cat .env  # Linux/Mac
type .env # Windows

# 3. Reinstale dependências
npm install

# 4. Limpe cache
rm -rf node_modules
npm install

# 5. Reinicie COMPLETAMENTE
# Feche terminal
# Abra novo terminal
cd backend
npm run dev
```

### Problema 5: Continente ainda bloqueado mesmo com Firecrawl

**Sintoma:**
```json
{"status": "error", "error_message": "BLOCKED_BY_ROBOT"}
```

**Possíveis causas:**
1. Firecrawl também foi bloqueado (raro)
2. Selectors estão incorretos
3. Página mudou estrutura

**Solução:**
1. Abra `debug_snapshot_url`
2. Inspecione HTML real
3. Veja se há produtos visíveis
4. Atualize selectors no Supabase (ver Passo 8)

---

## 📊 Passo 8: (Opcional) Atualizar Continente no Supabase

Se quiser que Continente **sempre** use render (sem esperar por bloqueio):

### No Supabase SQL Editor:

```sql
UPDATE public.suppliers
SET
  mode = 'render',
  selectors = jsonb_build_object(
    'result_selectors', jsonb_build_object(
      'item', '.product-list__item, .product-card, .ct-product-card, [data-product]',
      'name', '.product-card__title, .ct-tile__title, .product-name, h3',
      'code', '[data-sku], .product-sku',
      'price', '.price, .ct-price__value, .product-price',
      'availability', '.availability, .stock',
      'delivery', '.delivery, .eta',
      'link', 'a[href]'
    )
  )
WHERE LOWER(name) = 'continente';

-- Verificar
SELECT name, mode, enabled, selectors
FROM suppliers
WHERE name = 'Continente';
```

---

## 📈 Monitoramento de Uso

### Ver quantos requests já usou:

1. Vá para: https://www.firecrawl.dev/app/usage
2. Verifique:
   - Requests this month: X / 500
   - Requests today: Y
   - Average response time: Z ms

### Dicas para economizar:

1. **Use cache:**
   - Backend já tem cache de 10 minutos
   - Evite testar mesma query repetidamente

2. **Modo HTTP primeiro:**
   - Sistema já faz isso automaticamente
   - Só usa render quando bloqueado

3. **Desative suppliers não essenciais:**
   ```sql
   UPDATE suppliers
   SET enabled = false
   WHERE name IN ('Lidl', 'FNAC');
   ```

4. **Aumente cache TTL:**
   ```bash
   # Em .env
   CACHE_TTL_SECONDS=1800  # 30 minutos em vez de 10
   ```

---

## ✅ Checklist Final

Antes de considerar configuração completa:

- [ ] Conta Firecrawl criada
- [ ] API key obtida (começa com `fc-`)
- [ ] Chave adicionada ao `backend/.env`
- [ ] Backend reiniciado
- [ ] Teste direto Firecrawl passou
- [ ] Health check retorna OK
- [ ] Logs NÃO mostram "FIRECRAWL_API_KEY not configured"
- [ ] Teste de pesquisa mostra "Successfully fetched using render fallback"
- [ ] Frontend funciona e mostra resultados
- [ ] (Opcional) Continente atualizado no Supabase para mode: 'render'

---

## 🎯 Resultado Esperado

Após configuração completa, quando pesquisar "arroz":

**Logs do Backend:**
```
[FNAC] HTTP blocked, attempting render fallback...
[FNAC] Successfully fetched using render fallback
[Rádio Popular] HTTP blocked, attempting render fallback...
[Rádio Popular] Successfully fetched using render fallback
[Continente] HTTP blocked, attempting render fallback...
[Continente] Successfully fetched using render fallback
```

**Response API:**
```json
{
  "query": "arroz",
  "items": [
    {"name": "Arroz Carolino...", "price": 1.99, "store": "Continente"},
    {"name": "Arroz Agulha...", "price": 2.49, "store": "FNAC"},
    ...
  ],
  "per_supplier": [
    {"supplier_name": "Continente", "status": "success", "items_found": 12},
    {"supplier_name": "FNAC", "status": "success", "items_found": 8},
    ...
  ]
}
```

**Frontend:**
```
✅ Continente - success - 12 items
✅ FNAC - success - 8 items
✅ Rádio Popular - success - 5 items
```

---

## 📚 Recursos Úteis

- **Firecrawl Dashboard:** https://www.firecrawl.dev/app
- **Firecrawl Docs:** https://docs.firecrawl.dev/
- **API Reference:** https://docs.firecrawl.dev/api-reference/endpoint/scrape
- **Pricing:** https://www.firecrawl.dev/pricing
- **Support:** support@firecrawl.dev

---

## 🆘 Precisa de Ajuda?

Se algo não funcionar:

1. **Verifique logs do backend** (terminal onde corre `npm run dev`)
2. **Teste Firecrawl diretamente** (curl no Passo 5.1)
3. **Verifique ficheiro .env** (sem espaços, sem aspas, sem #)
4. **Reinicie TUDO** (feche terminais, abra novos)
5. **Abra debug_snapshot_url** para ver HTML real

Se ainda não funcionar, forneça:
- Logs do backend
- Response do teste Firecrawl direto
- Conteúdo do .env (SEM a chave real!)
- Erro específico que aparece

---

**Boa sorte! 🚀**
