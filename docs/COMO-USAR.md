# 🚀 Como Usar o ProductScout

## ⚡ Início Rápido (Recomendado)

### Opção 1: Duplo-clique (Mais Fácil!)
1. Faz **duplo-clique** no ficheiro: **`START-PRODUCTSCOUT.bat`**
2. Aguarda 10-15 segundos
3. O browser abre automaticamente em: **http://localhost:3000**
4. Pronto! Podes começar a pesquisar produtos! 🎉

### Opção 2: Executar manualmente
```batch
start-all.bat
```

---

## 🛑 Parar os Serviços

### Duplo-clique em:
```
stop-all.bat
```

Ou fecha as janelas do terminal que foram abertas.

---

## 📊 O que Acontece Quando Inicias?

O script `start-all.bat` faz automaticamente:

1. ✅ **Verifica npm** - Garante que Node.js está instalado
2. ✅ **Limpa processos antigos** - Mata qualquer instância anterior nas portas 3000 e 3001
3. ✅ **Valida diretórios** - Confirma que backend e frontend existem
4. ✅ **Inicia Backend** - Porta 3001 (API)
5. ✅ **Inicia Frontend** - Porta 3000 (Interface Web)
6. ✅ **Abre o Browser** - Diretamente na página de pesquisa!

Tudo em **~15 segundos**! ⚡

---

## 🌐 URLs Importantes

| Serviço | URL | Descrição |
|---------|-----|-----------|
| **Frontend** | http://localhost:3000 | Página de pesquisa (interface do utilizador) |
| **Backend API** | http://localhost:3001 | API REST |
| **Health Check** | http://localhost:3001/health | Verificar se backend está OK |
| **Suppliers** | http://localhost:3001/api/suppliers | Lista de fornecedores |

---

## 🎯 Usar a Aplicação

1. **Abre o browser** em: http://localhost:3000
2. **Escreve um produto** na caixa de pesquisa (ex: "arroz", "leite", "café")
3. **Clica "Search"**
4. **Vê os resultados** de vários fornecedores numa tabela comparativa!

### Funcionalidades:
- ✅ Pesquisa em múltiplos fornecedores simultaneamente
- ✅ Comparação de preços
- ✅ Ver disponibilidade
- ✅ Links diretos para compra
- ✅ Ordenação por preço
- ✅ Diagnósticos detalhados (modo debug)

---

## 🔧 Scripts Disponíveis

### Principais
| Script | Função |
|--------|--------|
| **START-PRODUCTSCOUT.bat** | 🚀 Inicia tudo (RECOMENDADO) |
| **start-all.bat** | Inicia backend + frontend |
| **stop-all.bat** | Para todos os serviços |

### Backend apenas
| Script | Função |
|--------|--------|
| **safe-start-backend.bat** | Inicia só o backend (com validações) |
| **restart-backend.bat** | Reinicia o backend |

### Outros
| Script | Função |
|--------|--------|
| **emergency-stop.bat** | Para TUDO (emergência) |
| **quick-check.bat** | Verifica estado dos serviços |
| **diagnose-backend.bat** | Diagnóstico completo |

---

## 📁 Estrutura do Projeto

```
ProductScout/
├── START-PRODUCTSCOUT.bat    ⭐ DUPLO-CLIQUE AQUI!
├── start-all.bat              Startup completo
├── stop-all.bat               Parar tudo
├── backend/                   API (porta 3001)
│   ├── src/
│   ├── .env                   Configurações
│   └── package.json
├── frontend/                  Interface Web (porta 3000)
│   ├── src/
│   │   ├── app/page.tsx      Página principal
│   │   └── components/       Componentes React
│   └── package.json
└── logs/                      Logs de execução
```

---

## ⚠️ Resolução de Problemas

### Problema: "Port 3000 already in use"
**Solução:**
```batch
stop-all.bat
```
Depois tenta novamente.

### Problema: Browser não abre automaticamente
**Solução:** Abre manualmente: http://localhost:3000

### Problema: "npm not found"
**Solução:** Instala Node.js de https://nodejs.org

### Problema: Backend não responde
**Solução:**
1. Verifica os logs em `logs/`
2. Corre `diagnose-backend.bat`
3. Tenta `safe-start-backend.bat`

### Problema: Erros de CORS
**Solução:** Garante que o backend está a correr (porta 3001)

---

## 🎓 Fluxo Típico de Trabalho

### Desenvolvimento Normal
```batch
# 1. Iniciar
duplo-clique em START-PRODUCTSCOUT.bat

# 2. Trabalhar normalmente
# O browser abre automaticamente
# Faz as tuas pesquisas!

# 3. Parar quando terminares
duplo-clique em stop-all.bat
```

### Se Algo Correr Mal
```batch
# 1. Para tudo
stop-all.bat

# 2. Aguarda 5 segundos

# 3. Reinicia
START-PRODUCTSCOUT.bat
```

---

## 📊 Logs

Todos os arranques criam logs detalhados em:
```
logs/startup-YYYYMMDD-HHMMSS.log
```

Útil para debug se algo falhar!

---

## 🚀 Próximos Passos (Opcional)

Depois de dominar o básico, podes:

1. **Adicionar mais fornecedores** - Edita a BD Supabase
2. **Ajustar CSS selectors** - Para obter dados reais
3. **Personalizar frontend** - Edita `frontend/src/`
4. **Configurar notificações** - Para alertas de preços

---

## ✅ Checklist de Primeira Utilização

- [ ] Node.js instalado? (verifica com `node -v`)
- [ ] Duplo-clique em **START-PRODUCTSCOUT.bat**
- [ ] Aguarda ~15 segundos
- [ ] Browser abre automaticamente?
- [ ] Vês a página de pesquisa?
- [ ] Testa pesquisar "arroz"
- [ ] Vês resultados?
- [ ] Quando terminares, corre **stop-all.bat**

---

## 🆘 Suporte

Se tiveres problemas:
1. Verifica os logs em `logs/`
2. Corre `diagnose-backend.bat`
3. Tenta `emergency-stop.bat` seguido de `START-PRODUCTSCOUT.bat`
4. Revê a documentação técnica em `VALIDACOES-COMPLETAS.md`

---

## 🎉 Pronto!

Agora tens tudo configurado para usar o ProductScout!

**Comando mais importante:**
```
Duplo-clique: START-PRODUCTSCOUT.bat
```

Diverte-te a pesquisar e comparar produtos! 🛒✨
