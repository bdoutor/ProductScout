# 📚 ProductScout - Complete Index

**Sistema de Gestão de Backend - Versão Anti-Loop/Crash 2.0**

---

## 🎯 START HERE

**Se és novo ou voltaste após crash:**
1. Lê: `README-SCRIPTS.md` (5 min)
2. Executa: `safe-start-backend.bat`
3. Se falhar: Consulta `TROUBLESHOOTING.md`

**Se queres perceber o que foi feito:**
1. Lê: `DEBUG-NOTES.md`
2. Compara com scripts antigos (se tiveres backup)

---

## 📁 Estrutura de Ficheiros

```
ProductScout/
│
├── 📜 SCRIPTS DE EXECUÇÃO (.bat)
│   ├── safe-start-backend.bat        ⭐ PRINCIPAL - Início ultra-robusto
│   ├── restart-backend.bat           🔄 Restart rápido melhorado
│   ├── emergency-stop.bat            🚨 Para emergências
│   ├── quick-check.bat               ✅ Verificação rápida
│   ├── diagnose-backend.bat          🔍 Diagnóstico completo
│   └── capture-state.bat             📸 Snapshot do sistema
│
├── 📖 DOCUMENTAÇÃO (.md)
│   ├── INDEX.md                      📚 Este ficheiro - índice geral
│   ├── README-SCRIPTS.md             🚀 Guia rápido de uso
│   ├── TROUBLESHOOTING.md            🔧 Resolução de problemas
│   ├── DEBUG-NOTES.md                🔍 Notas técnicas de debug
│   └── POST-TEST-CHECKLIST.md        ✅ Checklist pós-teste
│
├── 📂 LOGS (gerados automaticamente)
│   ├── backend-start-*.log           📝 Logs de início
│   ├── backend-diagnostics-*.log     🔬 Logs de diagnóstico
│   └── system-state-*.log            📊 Snapshots de estado
│
└── 🗂️ BACKEND (código do projeto)
    ├── src/
    ├── package.json
    ├── node_modules/
    └── .env
```

---

## 🔧 Scripts - Referência Rápida

### 1. safe-start-backend.bat ⭐
**Quando usar:** Primeira vez, após crashes, após npm install
**Características:**
- ✅ Validação completa de ambiente
- ✅ Só mata processos na porta 3001
- ✅ Instalação automática de dependências
- ✅ Health check automático
- ✅ Logging detalhado
- ✅ Janela de erro fica aberta

**Tempo:** ~10-15 segundos (primeira vez), ~5 segundos (seguintes)

**Output:**
- Console: Progresso passo-a-passo
- Backend window: Logs do servidor
- Log file: `logs/backend-start-*.log`

---

### 2. restart-backend.bat 🔄
**Quando usar:** Restarts rápidos diários
**Características:**
- ✅ Versão melhorada do script original
- ✅ Cleanup inteligente de processos
- ✅ Contador de processos mortos
- ✅ Referência a emergency-stop se falhar

**Tempo:** ~5 segundos

**Diferença vs safe-start:** Menos validações, mais rápido

---

### 3. emergency-stop.bat 🚨
**Quando usar:** Backend travado, loops, crashes
**Características:**
- ✅ Para APENAS processos na porta 3001
- ✅ Mostra detalhes antes de matar
- ✅ Verifica se limpeza funcionou
- ✅ Não afeta Claude Code ou VS Code

**Tempo:** ~5 segundos

**Seguro:** Não mata processos aleatórios

---

### 4. quick-check.bat ✅
**Quando usar:** Verificar se backend está a correr
**Características:**
- ✅ Apenas leitura (sem modificações)
- ✅ Mostra status da porta 3001
- ✅ Testa health endpoint
- ✅ Mostra PID do processo

**Tempo:** ~3 segundos

**Uso típico:** Antes de iniciar frontend

---

### 5. diagnose-backend.bat 🔍
**Quando usar:** Troubleshooting, análise de problemas
**Características:**
- ✅ Verifica Node.js/npm
- ✅ Verifica estrutura de ficheiros
- ✅ Lista processos e portas
- ✅ Gera relatório detalhado

**Tempo:** ~15 segundos

**Output:** `backend-diagnostics-*.log`

---

### 6. capture-state.bat 📸
**Quando usar:** Antes/depois de testes, debugging
**Características:**
- ✅ Snapshot completo do sistema
- ✅ Processos, portas, ficheiros
- ✅ Versões de software
- ✅ Histórico de logs

**Tempo:** ~5 segundos

**Output:** `system-state-*.log`

**Uso:** Comparar estado antes/depois de mudanças

---

## 📖 Documentação - Referência Rápida

### 1. INDEX.md (este ficheiro) 📚
**Conteúdo:** Visão geral de tudo
**Quando consultar:** Primeira leitura, referência rápida

---

### 2. README-SCRIPTS.md 🚀
**Conteúdo:**
- Quick start
- Tabela de scripts
- Cenários de uso
- Indicadores de sucesso/falha
- Best practices

**Quando consultar:**
- Não sabes qual script usar
- Queres saber o que é normal/anormal
- Precisas de exemplos práticos

**Secções principais:**
- Quick Start
- Usage Scenarios
- Success/Failure Indicators
- Best Practices

---

### 3. TROUBLESHOOTING.md 🔧
**Conteúdo:**
- Problemas comuns + soluções
- Exit codes explicados
- Workflow de diagnóstico
- Cheat sheet de comandos

**Quando consultar:**
- Algo deu errado
- Exit code 2
- Backend não inicia
- VS Code crashou

**Secções principais:**
- Common Problems & Solutions
- Exit Code 2 (detalhado)
- Backend Loop
- Port Won't Free Up
- VS Code Crashes

---

### 4. DEBUG-NOTES.md 🔍
**Conteúdo:**
- Estado atual do sistema (última verificação)
- Problema original reportado
- Root causes identificadas
- Soluções implementadas
- Testes pendentes
- Hipóteses alternativas

**Quando consultar:**
- Precisas entender o porquê das mudanças
- Crash novo aconteceu
- Queres contexto técnico
- Debugging avançado

**Secções principais:**
- ESTADO ATUAL DO SISTEMA
- Root Causes Identificadas
- SE OCORRER NOVO CRASH
- HIPÓTESES ALTERNATIVAS

---

### 5. POST-TEST-CHECKLIST.md ✅
**Conteúdo:**
- Template para preencher após testes
- Observações estruturadas
- Captura de erros
- Comparação expectativas vs realidade

**Quando usar:**
- Após executar qualquer script
- Quando documentar resultados
- Para comparar testes diferentes
- Reportar problemas

**Como usar:**
1. Copia o ficheiro
2. Renomeia: `test-result-YYYYMMDD-HHMMSS.md`
3. Preenche durante/após o teste
4. Guarda para referência futura

---

## 📊 Logs - O que significa cada um

### backend-start-*.log
**Gerado por:** `safe-start-backend.bat`
**Conteúdo:**
- Cada step executado
- Validações realizadas
- Processos mortos
- Erros encontrados
- Health check result

**Como ler:**
- Procura por `[ERROR]` - problemas críticos
- Procura por `[WARNING]` - avisos
- Procura por `[OK]` - sucessos
- Última linha indica estado final

---

### backend-diagnostics-*.log
**Gerado por:** `diagnose-backend.bat`
**Conteúdo:**
- Versões de software
- Estrutura de ficheiros
- Processos em execução
- Portas em uso
- Configurações

**Como ler:**
- Secções separadas por `=====`
- Compara com máquina funcional
- Procura por "NOT FOUND"

---

### system-state-*.log
**Gerado por:** `capture-state.bat`
**Conteúdo:**
- Snapshot completo do momento
- Processos node.exe
- Status de portas
- Estrutura de ficheiros
- Logs recentes

**Como usar:**
- Captura ANTES de teste
- Captura DEPOIS de teste
- Compara com `fc` (file compare):
  ```batch
  fc logs\system-state-before.log logs\system-state-after.log
  ```

---

## 🎓 Fluxos de Trabalho Comuns

### Workflow 1: Início do Dia
```
1. quick-check.bat              (verifica se algo ficou a correr)
2. (se running) emergency-stop.bat
3. safe-start-backend.bat       (início limpo)
4. (abrir frontend/testar)
```

### Workflow 2: Durante Desenvolvimento
```
# Backend com ts-node-dev auto-reload
# NÃO precisa restart manual
# Só restart se:
- Mudaste .env
- Instalaste pacote novo
- Backend crashou
```

### Workflow 3: Backend Crashou
```
1. NÃO fechar janela de erro (screenshot!)
2. capture-state.bat
3. Ler mensagem de erro
4. Consultar TROUBLESHOOTING.md
5. emergency-stop.bat
6. safe-start-backend.bat
```

### Workflow 4: VS Code Crashou
```
1. Fechar VS Code completamente
2. Abrir File Explorer
3. Duplo-clique em emergency-stop.bat
4. Esperar completar
5. Reabrir VS Code
6. safe-start-backend.bat
```

### Workflow 5: Investigar Problema
```
1. capture-state.bat            (estado atual)
2. diagnose-backend.bat         (diagnóstico completo)
3. Ler logs gerados
4. Consultar DEBUG-NOTES.md
5. Tentar solução
6. capture-state.bat            (estado após solução)
7. Comparar estados
```

### Workflow 6: Testar Script Novo/Modificado
```
1. capture-state.bat                    (antes)
2. Executar script de teste
3. Preencher POST-TEST-CHECKLIST.md
4. capture-state.bat                    (depois)
5. Comparar estados
6. Analisar logs
```

---

## 🎯 Resolução de Problemas - Árvore de Decisão

```
PROBLEMA?
│
├─ Backend não inicia
│  │
│  ├─ Exit code 2
│  │  └─> TROUBLESHOOTING.md > "Problem 1: Exit Code 2"
│  │
│  ├─ Port in use
│  │  └─> emergency-stop.bat → retry
│  │
│  └─ npm not found
│     └─> Instalar Node.js
│
├─ Backend em loop
│  └─> TROUBLESHOOTING.md > "Problem 2: Backend Loop"
│
├─ VS Code crashou
│  └─> TROUBLESHOOTING.md > "Problem 4: VS Code Crashes"
│
├─ Não sei o que está errado
│  └─> diagnose-backend.bat → ver output
│
└─ Erro diferente/desconhecido
   │
   ├─ 1. Screenshot do erro
   ├─ 2. capture-state.bat
   ├─ 3. diagnose-backend.bat
   ├─ 4. Preencher POST-TEST-CHECKLIST.md
   └─> DEBUG-NOTES.md > "SE OCORRER NOVO CRASH"
```

---

## 🔗 Links Rápidos por Situação

### "Nunca usei isto antes"
→ `README-SCRIPTS.md` > Quick Start

### "Algo deu errado"
→ `TROUBLESHOOTING.md`

### "Exit code 2"
→ `TROUBLESHOOTING.md` > Problem 1
→ `DEBUG-NOTES.md` > Root Causes Identificadas

### "VS Code crashou"
→ `TROUBLESHOOTING.md` > Problem 4
→ Workflow 4 (acima)

### "Backend em loop"
→ `TROUBLESHOOTING.md` > Problem 2

### "Quero entender o problema original"
→ `DEBUG-NOTES.md` > Problema Original Reportado

### "Preciso testar algo"
→ `POST-TEST-CHECKLIST.md` (copiar e preencher)

### "Não sei qual script usar"
→ `README-SCRIPTS.md` > All Available Scripts

### "Quero ver todos os comandos"
→ `TROUBLESHOOTING.md` > Quick Commands Cheat Sheet

---

## 📞 Processo de Ajuda

Se precisares de ajuda, **nesta ordem**:

### 1. Autodiagnóstico (5 min)
```batch
quick-check.bat
diagnose-backend.bat
```
→ Ver output, consultar TROUBLESHOOTING.md

### 2. Tentativa de Fix (5 min)
```batch
emergency-stop.bat
safe-start-backend.bat
```
→ Se funcionar, problema resolvido!

### 3. Documentação Detalhada (10 min)
→ Consultar secção específica em TROUBLESHOOTING.md
→ Consultar DEBUG-NOTES.md para contexto

### 4. Captura de Informação (5 min)
```batch
capture-state.bat
```
→ Preencher POST-TEST-CHECKLIST.md
→ Screenshots de erros

### 5. Análise Avançada (15 min)
→ Ler todos os logs gerados
→ Comparar com DEBUG-NOTES.md > "ESTADO ATUAL DO SISTEMA"
→ Verificar hipóteses alternativas

### 6. Pedir Ajuda (quando tudo falhar)
**Partilhar:**
- POST-TEST-CHECKLIST.md preenchido
- Logs: backend-start, diagnostics, system-state
- Screenshots de erros
- Descrição do que estavas a fazer

---

## 🏆 Melhores Práticas

### ✅ FAZER:
1. **Usar safe-start após mudanças grandes**
2. **Ler mensagens de erro antes de fechar janelas**
3. **Capturar estado antes de debugging**
4. **Preencher checklist quando testar**
5. **Consultar documentação antes de perguntar**

### ❌ NÃO FAZER:
1. **Matar processos node.exe manualmente** (usar emergency-stop)
2. **Fechar janelas de erro sem ler**
3. **Apagar pasta logs**
4. **Editar scripts sem backup**
5. **Executar múltiplos scripts ao mesmo tempo**

---

## 🔄 Ciclo de Vida Normal

```
[Início] safe-start-backend.bat
   ↓
[Backend Running] - ts-node-dev auto-reload em mudanças
   ↓
[Desenvolvimento] - código, testa, repete
   ↓
(se necessário restart)
   ↓
restart-backend.bat
   ↓
[Backend Running] - continua desenvolvimento
   ↓
[Fim do dia] emergency-stop.bat
   ↓
[Stopped]
```

---

## 📈 Histórico de Versões

### v2.0 - Anti-Loop/Crash Edition (2025-10-19)
- ✅ Criado safe-start-backend.bat
- ✅ Melhorado restart-backend.bat
- ✅ Criado emergency-stop.bat
- ✅ Criado quick-check.bat
- ✅ Criado capture-state.bat
- ✅ Documentação completa
- ✅ Sistema de logging
- ✅ Proteção contra kill de Claude Code
- ✅ Fix do loop FOR com enabledelayedexpansion

### v1.0 - Original (antes de 2025-10-19)
- ❌ Problema: matava todos os node.exe
- ❌ Problema: loop FOR com bug
- ❌ Problema: janela fechava em erro
- ❌ Problema: sem validações

---

## 🎯 Próximos Passos

**AGORA:**
1. Ler README-SCRIPTS.md (5 min)
2. Executar safe-start-backend.bat
3. Se funcionar → sucesso! 🎉
4. Se falhar → TROUBLESHOOTING.md

**DEPOIS (quando tudo funcionar):**
1. Testar restart-backend.bat
2. Testar emergency-stop.bat
3. Familiarizar com quick-check.bat
4. Guardar este INDEX.md como referência

---

**Boa sorte! 🚀**

*Qualquer dúvida, começa sempre por README-SCRIPTS.md*
