# 🔍 DEBUG NOTES - ProductScout Backend
**Last Updated:** 2025-10-19
**Session:** Anti-Loop/Crash Implementation

---

## 📌 ESTADO ATUAL DO SISTEMA

### ✅ Verificações Realizadas (Últimos Testes)
```
Data/Hora: 2025-10-19
Estado da Porta 3001: LIVRE ✅
Processos node.exe ativos: 1 (PID 33568 - Claude Code, NÃO é backend) ✅
npm instalado: SIM ✅
node instalado: SIM ✅
Estrutura backend: OK ✅
package.json existe: SIM ✅
node_modules existe: SIM ✅
Script "dev" existe: SIM ✅
```

### 🎯 Problema Original Reportado
```
Sintoma: Backend crasha com exit code 2 ao executar restart-backend.bat
Consequência: VS Code também crasha
Quando acontece: Sempre ao correr manualmente o ficheiro bat de restart
Frequência: Loop constante, impossível avançar
```

### 🔧 Root Causes Identificadas
1. **Script original matava TODOS os node.exe**
   - Incluía Claude Code (PID 33568)
   - Incluía extensões VS Code
   - Causava crash do VS Code

2. **Loop FOR com bug crítico (linha 45 original)**
   ```batch
   # ERRADO (versão original):
   for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001"') do (
       echo Killing process ID: %%a
       taskkill /F /PID %%a 2>&1
   )
   # Problema: %%a não expande corretamente dentro do loop
   # Causa: Exit code 2 (comando malformado)
   ```

3. **Janela fechava imediatamente (cmd /c)**
   - Impossível ver erro real
   - User ficava sem informação

4. **Sem validações prévias**
   - npm podia não existir → exit code 2
   - package.json podia não existir → exit code 2
   - Porta podia ficar ocupada → EADDRINUSE

---

## 🛠️ SOLUÇÕES IMPLEMENTADAS

### Script 1: `safe-start-backend.bat` ⭐ PRINCIPAL
**Características:**
- ✅ **Mata APENAS processos na porta 3001** (linha 76-90)
- ✅ Usa `enabledelayedexpansion` + `!VAR!` corretamente
- ✅ Validação de npm (linha 18-26)
- ✅ Validação de package.json (linha 61-65)
- ✅ Wrapper script com captura de exit code (linha 148)
- ✅ Logging para arquivo `logs/backend-start-*.log`
- ✅ Health check após iniciar (linha 230-250)

**Comando de teste crítico (linha 77):**
```batch
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":3001" ^| findstr "LISTENING"') do (
    set PID=%%a
    if defined PID (
        echo [INFO] Killing process ID: !PID!
        taskkill /F /PID !PID! >nul 2>&1
```
**Diferença chave:** `!PID!` em vez de `%%a` ou `%PID%`

### Script 2: `emergency-stop.bat` 🚨
**Quando usar:**
- Backend em loop infinito
- VS Code travado
- restart-backend.bat falhou

**Proteção:** Só mata processos em LISTENING na porta 3001

### Script 3: `restart-backend.bat` (MELHORADO)
**Melhorias aplicadas:**
- Linha 77: set KILLED_COUNT=0
- Linha 78: for /f com `2^>nul`
- Linha 85: set /a KILLED_COUNT+=1
- Linha 105: Referência a emergency-stop.bat

### Script 4: `quick-check.bat`
**Uso:** Verificação rápida sem modificações
**Seguro:** Apenas leitura, zero risk

### Script 5: `diagnose-backend.bat`
**Gera:** `backend-diagnostics-*.log`
**Útil para:** Análise post-mortem

---

## ⚠️ PONTOS CRÍTICOS DE ATENÇÃO

### 🚨 CRITICAL: Não confundir processos node.exe
```
PID 33568 = Claude Code (conexões para 34.36.57.103:443)
Backend   = Escuta em 0.0.0.0:3001 ou 127.0.0.1:3001
```
**Comando para diferenciar:**
```batch
netstat -ano | findstr ":3001" | findstr "LISTENING"
# Se retornar algo = é o backend
# Se retornar vazio = backend NÃO está a correr
```

### 🚨 CRITICAL: Git Bash vs CMD
```
Ambiente detectado: Git Bash (baseado no erro do `dir /b`)
Problema: Alguns comandos Windows falham no Git Bash
Solução: Scripts .bat devem rodar em CMD nativo
```
**Verificação:**
```batch
echo %COMSPEC%
# Deve retornar: C:\Windows\System32\cmd.exe
```

### 🚨 CRITICAL: Path com espaços
```
Path atual: C:\Users\bruno.doutor\OneDrive - MedicineOne\Ambiente de Trabalho\DOC\DOC\AI Coding\ProductScout
Espaços em: "OneDrive - MedicineOne" e "Ambiente de Trabalho" e "AI Coding"
```
**Proteção implementada:**
- Uso de `pushd/popd` em vez de `cd`
- Quotes em paths quando necessário
- `%CD%` sempre entre aspas se usado em echo

---

## 🔬 TESTES PENDENTES

### ❓ Teste 1: safe-start-backend.bat (PRÓXIMO)
**Expectativa:** Backend deve iniciar sem crash
**Se falhar:** Janela fica aberta mostrando erro
**Log em:** `logs/backend-start-*.log`

**Possíveis falhas:**
1. **.env missing** → Backend inicia mas pode ter problemas com configs
2. **Dependência faltando** → npm run dev falha na importação
3. **Porta ocupada ainda** → EADDRINUSE mesmo após cleanup
4. **TypeScript error** → Compilação falha no ts-node-dev

### ❓ Teste 2: Restart após sucesso
**Cenário:** safe-start funciona, depois testar restart-backend.bat
**Objetivo:** Verificar se cleanup funciona com backend a correr

### ❓ Teste 3: Emergency stop durante execução
**Cenário:** Backend a correr, executar emergency-stop.bat
**Objetivo:** Verificar cleanup seguro

### ❓ Teste 4: Múltiplos restarts consecutivos
**Cenário:** Testar 3-5 restarts seguidos
**Objetivo:** Verificar se não cria processos zombie

---

## 📊 MÉTRICAS DE SUCESSO

### ✅ Sucesso Total:
- [ ] safe-start-backend.bat inicia backend sem erros
- [ ] Backend responde em http://localhost:3001/health
- [ ] Janela do backend mostra: "🚀 Product Scout API running on http://localhost:3001"
- [ ] restart-backend.bat consegue fazer cleanup e reiniciar
- [ ] emergency-stop.bat para o backend sem afetar VS Code
- [ ] VS Code NÃO crasha durante nenhuma operação

### ⚠️ Sucesso Parcial:
- [ ] Backend inicia mas health check falha (pode ser timing)
- [ ] Cleanup funciona mas leva mais de 5 segundos
- [ ] Primeira tentativa falha mas segunda funciona

### ❌ Falha:
- [ ] Exit code 2 persiste
- [ ] VS Code crasha
- [ ] Porta 3001 não liberta
- [ ] npm run dev falha com erro específico

---

## 🐛 SE OCORRER NOVO CRASH

### Informação a Capturar IMEDIATAMENTE:

1. **Screenshot da janela de erro** (antes de fechar!)
2. **Exit code exato**
3. **Último log gerado:**
   ```batch
   dir logs\backend-start-*.log /o-d
   # Ver o mais recente
   ```

4. **Estado do sistema:**
   ```batch
   netstat -ano | findstr ":3001"
   tasklist | findstr "node.exe"
   ```

5. **Conteúdo do erro no terminal do backend**

6. **Qual script foi executado:**
   - [ ] safe-start-backend.bat
   - [ ] restart-backend.bat
   - [ ] emergency-stop.bat
   - [ ] Outro: __________

### Comandos de Debug:
```batch
# Ver processos detalhados
wmic process where "name='node.exe'" get ProcessId,CommandLine,ExecutablePath

# Ver todas as conexões node.exe
netstat -ano | findstr "node"

# Verificar se npm funciona
npm --version

# Testar compilação TypeScript
cd backend
npx tsc --noEmit
cd ..

# Testar npm run dev manualmente (sem script)
cd backend
npm run dev
# (anotar output EXATO)
```

---

## 🎯 HIPÓTESES ALTERNATIVAS (Se tudo falhar)

### Hipótese A: Antivírus bloqueando
**Sintoma:** taskkill não funciona mesmo com admin
**Solução:** Adicionar exceção para pasta ProductScout

### Hipótese B: Permissões do Windows
**Sintoma:** "Access denied" ao matar processo
**Solução:** Rodar script como administrador

### Hipótese C: Firewall bloqueando porta 3001
**Sintoma:** Backend inicia mas não responde
**Solução:** Adicionar regra de firewall

### Hipótese D: TypeScript/ts-node-dev corrompido
**Sintoma:** Compilação falha sempre
**Solução:**
```batch
cd backend
npm uninstall ts-node-dev
npm install ts-node-dev --save-dev
```

### Hipótese E: Cache do npm corrompido
**Sintoma:** Erros estranhos em módulos
**Solução:**
```batch
npm cache clean --force
cd backend
rmdir /s /q node_modules
npm install
```

---

## 📝 NOTAS PARA ITERAÇÃO FUTURA

### Se Exit Code 2 persistir:
1. **Verificar sintaxe batch line-by-line**
   - Executar cada comando individualmente no CMD
   - Identificar exatamente qual linha dá exit code 2

2. **Considerar alternativas:**
   - PowerShell script em vez de .bat
   - Node.js script (usando `child_process`)
   - npm script que faz o cleanup

3. **Logs mais verbosos:**
   - Adicionar `echo [DEBUG] Before command X`
   - Capturar stdout E stderr separadamente
   - Timestamp em cada linha

### Se VS Code continuar crashando:
1. **Desabilitar extensões uma a uma**
   - Especialmente: ESLint, Prettier, Git extensions
2. **Testar fora do VS Code**
   - Rodar scripts via File Explorer (duplo clique)
   - Ver se problema é VS Code específico
3. **Atualizar VS Code**
   - Pode ser bug da versão atual

### Alternativa Radical:
**Usar package.json script em vez de .bat:**
```json
{
  "scripts": {
    "kill-backend": "npx kill-port 3001",
    "safe-start": "npm run kill-backend && npm run dev"
  }
}
```
**Vantagem:** Cross-platform, menos propenso a bugs de sintaxe
**Desvantagem:** Perde validações customizadas

---

## 🔗 REFERÊNCIAS ÚTEIS

### Comandos Windows Batch:
- `enabledelayedexpansion`: https://ss64.com/nt/delayedexpansion.html
- `for /f`: https://ss64.com/nt/for_cmd.html
- `netstat`: https://ss64.com/nt/netstat.html

### Exit Codes:
- 0 = Success
- 1 = General error
- 2 = Misuse of shell command
- 130 = Terminated by Ctrl+C
- 3221225786 = Access violation (port in use)

### npm/Node.js:
- ts-node-dev docs: https://github.com/wclr/ts-node-dev
- EADDRINUSE error: Port já em uso
- MODULE_NOT_FOUND: Dependência faltando

---

## 📞 QUESTÕES IMPORTANTES PARA INVESTIGAR

### Se teste falhar:

1. **O erro é consistente?**
   - Acontece sempre da mesma forma?
   - Ou é intermitente/aleatório?

2. **Qual o timing do erro?**
   - No início do script (validações)?
   - Durante o kill de processos?
   - Ao executar npm run dev?
   - Após backend iniciar?

3. **A janela backend abre?**
   - Se SIM: O que mostra antes de crashar?
   - Se NÃO: Erro é no script principal

4. **O log foi gerado?**
   - Se SIM: Qual a última linha?
   - Se NÃO: Script falhou muito cedo

5. **VS Code crashou?**
   - Se SIM: Foi durante ou depois do script?
   - Se NÃO: Progresso! Problema isolado

6. **Processo ficou zombie?**
   - `tasklist | findstr "node.exe"` mostra algo?
   - `netstat -ano | findstr ":3001"` mostra algo?

---

## ✅ CHECKLIST PRÉ-TESTE

Antes de executar `safe-start-backend.bat`:

- [ ] VS Code está aberto e estável
- [ ] Nenhum outro processo na porta 3001 (`quick-check.bat`)
- [ ] Pasta `logs` foi criada (script cria automaticamente)
- [ ] Terminal está em CMD (não Git Bash)
- [ ] Path atual é raiz do ProductScout
- [ ] Hora anotada para correlacionar com logs

---

## 🎬 PRÓXIMO PASSO

**EXECUTAR:** `safe-start-backend.bat`

**Observar:**
1. Cada step que é printado
2. Se janela do backend abre
3. Mensagens na janela backend
4. Tempo que leva até completar

**Capturar:** Qualquer erro, por menor que seja

**Reportar:** Estado final (sucesso/falha) + logs + screenshots

---

**FIM DAS NOTAS DE DEBUG**

*Estas notas serão atualizadas após cada teste/iteração.*
