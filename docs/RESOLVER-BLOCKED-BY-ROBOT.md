# 🔓 Resolver Erro "BLOCKED_BY_ROBOT"

## 🎯 Problema

Quando fazes uma pesquisa, alguns fornecedores retornam:
```
BLOCKED_BY_ROBOT: Page appears to be blocking automated access
```

**Exemplo:**
- ❌ Continente: BLOCKED_BY_ROBOT
- ❌ FNAC: PARSING_ERROR ou BLOCKED_BY_ROBOT
- ⚠️ Rádio Popular: Bloqueado mas funciona com fallback

---

## ✅ Solução: Ativar Modo Render

### O que é o Modo Render?

O ProductScout suporta 2 modos de scraping:

| Modo | Descrição | Quando Usar |
|------|-----------|-------------|
| **HTTP** | Fetch direto (rápido) | Sites simples sem proteção |
| **Render** | Usa Firecrawl (JavaScript) | Sites com bot detection |

**Tu já tens o Firecrawl configurado!** ✅
- API Key: `fc-73b52a6b8bb34ab1af1c81426c3ae421`
- Configurado em: `backend/.env`

---

## 🔧 Como Ativar o Modo Render

### Método 1: SQL (Recomendado) ⭐

1. **Abre Supabase:**
   - Vai a: https://supabase.com
   - Entra no teu projeto

2. **Vai ao SQL Editor:**
   - Menu lateral: **SQL Editor**
   - Clica em: **New Query**

3. **Cola e Executa este SQL:**

```sql
-- Atualizar todos os fornecedores para modo render
UPDATE suppliers
SET mode = 'render'
WHERE name IN ('Continente', 'Rádio Popular', 'FNAC');

-- Verificar
SELECT name, mode, enabled FROM suppliers ORDER BY name;
```

4. **Clica em RUN** ✅

5. **Resultado esperado:**
```
┌──────────────────┬────────┬─────────┐
│ name             │ mode   │ enabled │
├──────────────────┼────────┼─────────┤
│ Continente       │ render │ true    │
│ FNAC             │ render │ true    │
│ Rádio Popular    │ render │ true    │
│ Lidl             │ http   │ false   │
└──────────────────┴────────┴─────────┘
```

---

### Método 2: Interface do Supabase

1. **Abre Supabase Table Editor:**
   - Menu lateral: **Table Editor**
   - Seleciona tabela: **suppliers**

2. **Para cada fornecedor bloqueado:**
   - Clica na linha
   - Edita coluna **mode**
   - Muda de `http` para `render`
   - Clica em **Save**

3. **Fornecedores a atualizar:**
   - ✅ Continente: `http` → `render`
   - ✅ FNAC: `http` → `render`
   - ✅ Rádio Popular: `http` → `render`

---

## 🧪 Testar Depois de Atualizar

### 1. **Faz uma nova pesquisa:**
```
1. Vai a http://localhost:3000
2. Pesquisa: "arroz"
3. Clica "Search"
4. Aguarda ~5-10 segundos (render mode é mais lento)
```

### 2. **Resultado esperado:**
```
┌──────────────────┬─────────┬─────────────┐
│ Supplier         │ Status  │ Items       │
├──────────────────┼─────────┼─────────────┤
│ Continente       │ success │ 12 items    │
│ FNAC             │ success │ 8 items     │
│ Rádio Popular    │ success │ 15 items    │
└──────────────────┴─────────┴─────────────┘
```

### 3. **Se ainda der erro:**
- Pode ser problema de CSS selectors
- Vê seção abaixo "Ajustar CSS Selectors"

---

## 🔍 Entender o Erro

### Por que acontece BLOCKED_BY_ROBOT?

Websites modernos usam várias técnicas para detetar bots:
- ✅ User-Agent checking
- ✅ JavaScript challenges
- ✅ Captchas
- ✅ Rate limiting
- ✅ Behavior analysis

### Como o Modo Render resolve?

O **Firecrawl**:
- ✅ Usa browsers reais (Puppeteer/Playwright)
- ✅ Executa JavaScript
- ✅ Rotação de IPs
- ✅ Headers realistas
- ✅ Timing humano

---

## 📊 Comparação: HTTP vs Render

| Aspecto | HTTP Mode | Render Mode |
|---------|-----------|-------------|
| **Velocidade** | 🚀 Rápido (1-2s) | 🐌 Lento (5-10s) |
| **Custo** | 💚 Grátis | 💛 Pago (Firecrawl) |
| **Anti-Bot** | ❌ Fácil bloquear | ✅ Difícil bloquear |
| **JavaScript** | ❌ Não executa | ✅ Executa |
| **Quando usar** | Sites simples | Sites protegidos |

---

## ⚙️ Modo Híbrido (Atual)

O backend já tem **fallback automático**!

Funciona assim:
```
1. Tenta HTTP primeiro
2. Se detetar bloqueio → automaticamente tenta Render
3. Se Render também falhar → retorna dados demo
```

**Mas é melhor configurar Render direto para sites que bloqueiam!**

---

## 🎯 Configuração Recomendada

### Para cada tipo de site:

**Sites Simples (HTTP):**
- ✅ Blogs
- ✅ Sites estáticos
- ✅ APIs públicas

**Sites Complexos (Render):**
- ✅ **Continente** (ecommerce grande)
- ✅ **FNAC** (JavaScript heavy)
- ✅ **Rádio Popular** (proteção anti-bot)
- ✅ Pingo Doce
- ✅ Worten
- ✅ MediaMarkt

---

## 🔧 Ajustar CSS Selectors (Se Necessário)

Se depois de ativar **Render** ainda houver erros de parsing:

### 1. **Usa o endpoint de teste:**
```bash
POST http://localhost:3001/api/test-supplier

Body:
{
  "supplier_id": "uuid-do-continente",
  "query": "arroz",
  "debug": true
}
```

### 2. **Vê o debug snapshot:**
- Response inclui `debug_snapshot_url`
- Abre esse URL no browser
- Inspeciona o HTML real retornado

### 3. **Atualiza selectors no Supabase:**
```sql
UPDATE suppliers
SET selectors = '{
  "result_selectors": {
    "item": ".new-product-class",
    "name": ".new-title-class",
    "price": ".new-price-class",
    "link": "a.product-link"
  }
}'::jsonb
WHERE name = 'Continente';
```

---

## 📝 Script SQL Completo

Ficheiro criado: **`update-suppliers-to-render.sql`**

Copia e cola no Supabase SQL Editor:

```sql
-- Atualizar Continente para modo render
UPDATE suppliers
SET mode = 'render'
WHERE name = 'Continente';

-- Atualizar Rádio Popular para modo render
UPDATE suppliers
SET mode = 'render'
WHERE name = 'Rádio Popular';

-- Atualizar FNAC para modo render
UPDATE suppliers
SET mode = 'render'
WHERE name = 'FNAC';

-- Verificar configuração
SELECT name, mode, enabled, base_url
FROM suppliers
ORDER BY name;
```

---

## ✅ Checklist de Resolução

- [ ] Abrir Supabase (https://supabase.com)
- [ ] Ir ao SQL Editor
- [ ] Copiar script SQL acima
- [ ] Colar e executar (RUN)
- [ ] Verificar resultado (mode = 'render')
- [ ] Voltar ao ProductScout
- [ ] Fazer nova pesquisa
- [ ] Verificar se funciona!

---

## 🎊 Resultado Final

Depois de configurar para modo render:

**Antes:**
```
Continente: ❌ BLOCKED_BY_ROBOT
FNAC: ❌ PARSING_ERROR
Rádio Popular: ⚠️ BLOCKED_BY_ROBOT (com fallback)
```

**Depois:**
```
Continente: ✅ SUCCESS (12 produtos)
FNAC: ✅ SUCCESS (8 produtos)
Rádio Popular: ✅ SUCCESS (15 produtos)
```

---

## 💡 Dicas Extras

### 1. **Cache:**
O sistema guarda resultados por 10 minutos. Se mudares configuração:
- Aguarda 10 min
- Ou reinicia backend
- Ou usa parâmetro `"debug": true`

### 2. **Custo Firecrawl:**
- Modo Render usa Firecrawl API
- Verifica limites do teu plano
- Podes desativar suppliers se necessário

### 3. **Performance:**
- Render mode é ~5x mais lento
- Mas é o único que funciona em sites protegidos
- Usa cache agressivo para compensar

---

## 🆘 Se Ainda Tiver Problemas

### Erro persiste?

1. **Verifica API key Firecrawl:**
   ```bash
   # Em backend/.env
   FIRECRAWL_API_KEY=fc-73b52a6b8bb34ab1af1c81426c3ae421
   ```

2. **Verifica logs:**
   ```
   logs/startup-*.log
   ```

3. **Testa endpoint direto:**
   ```bash
   curl http://localhost:3001/health
   curl http://localhost:3001/api/suppliers
   ```

4. **Reinicia tudo:**
   ```bash
   stop-all.bat
   # Aguarda 5 segundos
   START-PRODUCTSCOUT.bat
   ```

---

## 📚 Mais Informação

- **Firecrawl Docs:** https://docs.firecrawl.dev
- **Código do Scraper:** `backend/src/services/scraper.ts:170-186`
- **Fallback automático:** Já implementado!

---

**Resumo: Muda `mode` de `http` para `render` no Supabase!** ✅
