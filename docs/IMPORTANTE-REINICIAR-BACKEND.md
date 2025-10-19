# ⚠️ IMPORTANTE: Reiniciar Backend Após Mudanças no Supabase

## 🔍 O Problema

Atualizaste os suppliers no Supabase para modo `render`, mas **o erro continua**:
```
❌ BLOCKED_BY_ROBOT: Page appears to be blocking automated access
```

## 💡 Por Que Acontece?

O backend **carrega a configuração dos suppliers ao fazer cada pesquisa**, mas a configuração pode estar **em cache**!

### Sistema de Cache:
```
1. Backend faz pesquisa
2. Busca configuração dos suppliers no Supabase
3. Guarda resultado em cache (10 minutos)
4. Próximas pesquisas usam cache
```

**Resultado:** Mesmo depois de atualizar no Supabase, o backend ainda usa a configuração antiga em cache!

---

## ✅ Solução: Reiniciar Backend

### **Opção 1: Script Rápido (Recomendado)** ⭐

```
Duplo-clique: restart-backend-only.bat
```

**O que faz:**
- ✅ Para apenas o backend (porta 3001)
- ✅ **Mantém o frontend a correr** (porta 3000)
- ✅ Reinicia o backend
- ✅ Limpa o cache automaticamente

**Tempo:** ~10 segundos

---

### **Opção 2: Restart Completo**

```
1. Duplo-clique: stop-all.bat
2. Aguarda 5 segundos
3. Duplo-clique: START-PRODUCTSCOUT.bat
```

**O que faz:**
- Para backend E frontend
- Reinicia tudo
- Limpa todo o cache

**Tempo:** ~20 segundos

---

### **Opção 3: Limpar Cache Manualmente**

Se não quiseres reiniciar, aguarda **10 minutos** e o cache expira automaticamente.

---

## 📋 Passo a Passo Completo

### 1. ✅ **Já Fizeste:**
```sql
-- No Supabase SQL Editor
UPDATE suppliers
SET mode = 'render'
WHERE name IN ('Continente', 'Rádio Popular', 'FNAC');
```

### 2. ✅ **Verificado:**
A configuração foi atualizada no Supabase:
```
Continente: mode = "render" ✅
FNAC: mode = "render" ✅
Rádio Popular: mode = "render" ✅
```

### 3. ⚠️ **Falta Fazer:**
```
Duplo-clique: restart-backend-only.bat
```

### 4. ✅ **Depois:**
```
1. Volta ao browser (http://localhost:3000)
2. Pesquisa "arroz" de novo
3. Aguarda ~10 segundos
4. ✅ Deve funcionar agora!
```

---

## 🔬 Como Verificar Se Funcionou

### Antes do Reinicio:
```
Continente: ❌ BLOCKED_BY_ROBOT (usando config antiga em cache)
```

### Depois do Reinicio:
```
Continente: ✅ SUCCESS ou ⚠️ Outro tipo de erro (PARSING_ERROR)
```

**Se mudar de BLOCKED_BY_ROBOT para outro erro = PROGRESSO!** ✅

---

## 🧪 Teste Detalhado (Debug Mode)

Para ver exatamente o que está a acontecer:

### 1. **Usa o endpoint de teste:**
```bash
POST http://localhost:3001/api/test-supplier

Body:
{
  "supplier_id": "626eef49-24c4-44e1-aa3b-5239c5ce7a43",
  "query": "arroz",
  "debug": true
}
```

### 2. **Verifica a resposta:**
```json
{
  "search_run": {
    "status": "success" ou "error",
    "engine": "render",  // ← Deve ser "render"!
    "error_message": "...",
    "debug_snapshot_url": "https://..."
  }
}
```

**Se `engine` ainda for "http" → backend não recarregou!**

---

## 🎯 Configuração de Cache

O cache está configurado em `backend/.env`:

```env
CACHE_TTL_SECONDS=600  # 10 minutos
```

**Podes reduzir para testar:**
```env
CACHE_TTL_SECONDS=60   # 1 minuto
```

Depois reinicia backend.

---

## 🔄 Quando Precisas Reiniciar Backend

Sempre que mudares configuração no Supabase:

| Mudança | Reiniciar? |
|---------|-----------|
| Atualizar `mode` (http → render) | ✅ Sim |
| Atualizar CSS `selectors` | ✅ Sim |
| Adicionar novo supplier | ✅ Sim |
| Ativar/desativar supplier | ✅ Sim |
| Mudanças no código backend | ✅ Sim |
| Mudanças no frontend | ❌ Não (hot reload) |

---

## 📊 Fluxo Completo de Atualização

```
┌─────────────────────────────────┐
│ 1. Muda config no Supabase      │
│    (SQL: UPDATE suppliers...)   │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│ 2. REINICIA BACKEND             │
│    (restart-backend-only.bat)   │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│ 3. Backend carrega nova config  │
│    (cache limpo)                │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│ 4. Testa pesquisa               │
│    (deve usar modo render)      │
└─────────────────────────────────┘
```

---

## 🆘 Se Ainda Não Funcionar

### Após reiniciar, se continuar com erro:

#### 1. **Erro: BLOCKED_BY_ROBOT**
```
Causa: Firecrawl API key inválida ou sem créditos
Solução: Verifica API key em backend/.env
```

#### 2. **Erro: PARSING_ERROR**
```
Causa: CSS selectors incorretos
Solução: Atualiza selectors no Supabase
Ver: RESOLVER-BLOCKED-BY-ROBOT.md (seção CSS Selectors)
```

#### 3. **Erro: NETWORK_ERROR**
```
Causa: Firecrawl API offline ou timeout
Solução: Aguarda e tenta de novo
```

#### 4. **Erro: UNKNOWN_ERROR**
```
Causa: Vários possíveis
Solução: Verifica logs em logs/
```

---

## 🎊 Scripts Disponíveis

| Script | O Que Faz |
|--------|-----------|
| `restart-backend-only.bat` | ⚡ Reinicia só backend (rápido) |
| `restart-backend.bat` | Reinicia backend com logs |
| `stop-all.bat` | Para tudo (backend + frontend) |
| `START-PRODUCTSCOUT.bat` | Inicia tudo do zero |

---

## 💡 Dica Pro

**Para desenvolvimento ativo:**

1. Reduz cache para 1 minuto:
```env
CACHE_TTL_SECONDS=60
```

2. Usa debug mode sempre:
```json
{ "query": "arroz", "debug": true }
```

3. Reinicia backend após cada mudança:
```
restart-backend-only.bat
```

---

## ✅ Checklist Rápida

Quando mudares config no Supabase:

- [ ] Mudança feita no Supabase (SQL executado)
- [ ] `restart-backend-only.bat` executado
- [ ] Aguardou backend reiniciar (~10s)
- [ ] Fez nova pesquisa
- [ ] Verificou se erro mudou
- [ ] Se ainda BLOCKED → verifica Firecrawl API key
- [ ] Se agora PARSING → atualiza CSS selectors

---

## 🎯 Resumo

**Problema:** Config atualizada no Supabase mas backend ainda usa cache antiga

**Solução:**
```
restart-backend-only.bat
```

**Simples assim!** ✅
