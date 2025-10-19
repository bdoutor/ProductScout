# ✅ POST-TEST CHECKLIST

**Preencher IMEDIATAMENTE após executar o teste**

---

## 📝 INFORMAÇÃO DO TESTE

**Data/Hora:** ____________________
**Script Executado:** [ ] safe-start-backend.bat [ ] restart-backend.bat [ ] Outro: __________
**Executado de:** [ ] VS Code Terminal [ ] CMD [ ] File Explorer (duplo-clique)

---

## ✅ RESULTADO GERAL

**Status Final:**
- [ ] ✅ SUCESSO TOTAL - Backend iniciou e funciona
- [ ] ⚠️ SUCESSO PARCIAL - Backend iniciou mas com warnings
- [ ] ❌ FALHA - Backend não iniciou
- [ ] 💥 CRASH - VS Code crashou

---

## 📊 OBSERVAÇÕES DURANTE EXECUÇÃO

### Fase 1: Validações Iniciais (Steps 0-2)
- [ ] Step 0 (Verify npm) passou
- [ ] Step 1 (Stop processes) passou
- [ ] Step 2 (Verify directory) passou

**Observações:**
```
_________________________________________________________________
_________________________________________________________________
```

### Fase 2: Limpeza de Porta (Step 3)
- [ ] Porta 3001 estava livre
- [ ] Porta 3001 estava ocupada mas foi liberada
- [ ] Porta 3001 não libertou (ERRO)
- [ ] Processos mortos: ________

**Observações:**
```
_________________________________________________________________
_________________________________________________________________
```

### Fase 3: Dependências (Step 4)
- [ ] node_modules já existia
- [ ] node_modules foi instalado
- [ ] npm install falhou (ERRO)

**Observações:**
```
_________________________________________________________________
_________________________________________________________________
```

### Fase 4: Configuração (Step 4-5)
- [ ] package.json válido
- [ ] .env encontrado
- [ ] .env não encontrado (warning ok)

**Observações:**
```
_________________________________________________________________
_________________________________________________________________
```

### Fase 5: Início do Backend (Step 5)
- [ ] Janela do backend ABRIU
- [ ] Janela do backend NÃO abriu (ERRO)
- [ ] Janela abriu mas fechou imediatamente

**Se abriu, que mensagens apareceram:**
```
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________
```

### Fase 6: Health Check (Step 6)
- [ ] Backend está listening na porta 3001
- [ ] Health endpoint responde
- [ ] Health endpoint não responde (timeout)

**Observações:**
```
_________________________________________________________________
_________________________________________________________________
```

---

## 🪟 ESTADO DAS JANELAS

**Quantas janelas/terminais abertos após o teste:**
- Script principal (restart/safe-start): [ ] Aberto [ ] Fechado
- Backend (nova janela): [ ] Aberto [ ] Fechado [ ] Não abriu
- VS Code: [ ] Funcionando [ ] Travado [ ] Crashou

---

## 🔍 CAPTURA DE ERROS

### Exit Code (se houver erro)
**Exit code:** __________

**Mensagem de erro completa:**
```
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________
```

### Última mensagem antes do erro
```
_________________________________________________________________
_________________________________________________________________
```

### Screenshots
- [ ] Screenshot do erro capturado
- [ ] Screenshot da janela backend capturado
- [ ] Screenshot do VS Code capturado

**Localização dos screenshots:** _______________________________

---

## 📂 LOGS GERADOS

**Verificar se logs foram criados:**
- [ ] `logs/backend-start-*.log` existe
- [ ] `logs/system-state-*.log` existe (se capture-state foi rodado)

**Nomes dos ficheiros log:**
```
_________________________________________________________________
_________________________________________________________________
```

**Última linha do log backend-start:**
```
_________________________________________________________________
_________________________________________________________________
```

---

## 🔬 VERIFICAÇÕES PÓS-TESTE

### Executar agora (cola os resultados):

#### 1. Estado da porta 3001
```batch
netstat -ano | findstr ":3001"
```
**Resultado:**
```
_________________________________________________________________
```

#### 2. Processos node.exe
```batch
tasklist | findstr "node.exe"
```
**Resultado:**
```
_________________________________________________________________
_________________________________________________________________
```

#### 3. Teste manual do health endpoint (se backend iniciou)
```batch
curl http://localhost:3001/health
```
**Resultado:**
```
_________________________________________________________________
```

---

## 🎯 COMPARAÇÃO COM EXPECTATIVAS

### ✅ Coisas que funcionaram como esperado:
```
1. _________________________________________________________________
2. _________________________________________________________________
3. _________________________________________________________________
```

### ❌ Coisas que NÃO funcionaram:
```
1. _________________________________________________________________
2. _________________________________________________________________
3. _________________________________________________________________
```

### ⚠️ Comportamentos estranhos/inesperados:
```
1. _________________________________________________________________
2. _________________________________________________________________
3. _________________________________________________________________
```

---

## 🔄 AÇÕES DE FOLLOW-UP

### Se SUCESSO:
- [ ] Testar restart-backend.bat (se usou safe-start)
- [ ] Testar emergency-stop.bat
- [ ] Testar múltiplos restarts consecutivos
- [ ] Documentar configuração que funcionou

### Se FALHA:
- [ ] Analisar logs em detalhe
- [ ] Consultar TROUBLESHOOTING.md
- [ ] Consultar DEBUG-NOTES.md seção "SE OCORRER NOVO CRASH"
- [ ] Executar diagnose-backend.bat
- [ ] Capturar estado com capture-state.bat

### Se CRASH DO VS CODE:
- [ ] Anotar exatamente quando crashou (qual step)
- [ ] Verificar se processo node.exe ficou zombie
- [ ] Executar emergency-stop.bat antes de reabrir VS Code
- [ ] Considerar rodar scripts fora do VS Code (File Explorer)

---

## 🧪 TESTES ADICIONAIS REALIZADOS

**Se o backend iniciou com sucesso, testar:**

### Teste 1: Endpoint de pesquisa
```bash
curl -X POST http://localhost:3001/api/search -H "Content-Type: application/json" -d "{\"query\":\"teste\"}"
```
- [ ] Funcionou
- [ ] Erro: _______________________________________________________

### Teste 2: Restart
```batch
restart-backend.bat
```
- [ ] Funcionou
- [ ] Erro: _______________________________________________________

### Teste 3: Emergency Stop
```batch
emergency-stop.bat
```
- [ ] Funcionou
- [ ] Erro: _______________________________________________________

---

## 📊 MÉTRICAS

**Tempo total do teste:** __________ segundos

**Tempo até backend responder:** __________ segundos

**Número de tentativas necessárias:** __________

**CPU/Memória durante o teste:**
- CPU: ___________%
- RAM: __________ MB

---

## 💭 OBSERVAÇÕES GERAIS

**Qualquer outra observação relevante:**
```
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________
```

---

## 🎓 LIÇÕES APRENDIDAS

**O que aprendi com este teste:**
```
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________
```

**Mudanças/melhorias sugeridas para os scripts:**
```
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________
```

---

## ✍️ ASSINATURA

**Teste realizado por:** ____________________
**Data:** ____________________
**Próximo passo:** ____________________

---

**IMPORTANTE:** Guardar este checklist preenchido para comparação com testes futuros!

**Sugestão de nome do ficheiro:** `test-result-YYYYMMDD-HHMMSS.md`
