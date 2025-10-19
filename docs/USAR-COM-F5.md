# 🚀 Usar ProductScout com F5 no Visual Studio 2022

## ✅ CONFIGURADO! Agora funciona com F5!

### 🎯 O que acontece quando fazes F5:

1. ✅ Visual Studio compila o projeto C#
2. ✅ O `Program.cs` executa automaticamente o `START-PRODUCTSCOUT.bat`
3. ✅ O script inicia:
   - Backend (porta 3001)
   - Frontend (porta 3000)
4. ✅ Browser abre automaticamente em http://localhost:3000
5. ✅ **Página de pesquisa já está visível!**

---

## 📋 Como Usar:

### 1️⃣ **Abrir Projeto no Visual Studio 2022**
```
Duplo-clique: ProductScout.sln
```

### 2️⃣ **Pressionar F5**
```
Teclado: F5
ou
Menu: Debug → Start Debugging
```

### 3️⃣ **Aguardar**
Vais ver no Output do Visual Studio:
```
========================================
 Starting ProductScout Services...
========================================

[OK] ProductScout startup script launched!
[INFO] Backend and Frontend are starting...
[INFO] Browser will open automatically at http://localhost:3000

This ASP.NET Core app is a launcher.
You can close this window after the browser opens.
```

### 4️⃣ **Browser Abre Automaticamente**
- ✅ Abre em http://localhost:3000
- ✅ Página de pesquisa visível
- ✅ Pronto para usar!

### 5️⃣ **Usar Aplicação**
- Escreve "arroz" na caixa
- Clica "Search"
- Vê os resultados!

---

## 🛑 Para Parar:

### Opção 1: No Visual Studio
```
Shift + F5
ou
Menu: Debug → Stop Debugging
```

**Depois:**
```
Duplo-clique: stop-all.bat
```
(Para parar backend e frontend)

### Opção 2: Direto
```
Duplo-clique: stop-all.bat
```

---

## 📊 Fluxo Completo:

```
┌─────────────────────────────────────────┐
│  1. Abre ProductScout.sln no VS 2022   │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  2. Pressiona F5                        │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  3. VS compila e executa Program.cs     │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  4. Program.cs lança                    │
│     START-PRODUCTSCOUT.bat              │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  5. Script inicia:                      │
│     - Backend (3001)                    │
│     - Frontend (3000)                   │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  6. Browser abre automaticamente        │
│     http://localhost:3000               │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  7. ✅ PRONTO! Página de pesquisa       │
│     visível e funcional!                │
└─────────────────────────────────────────┘
```

---

## 🔍 O que Foi Modificado:

### 1. **Program.cs**
```csharp
// Adiciona auto-startup quando em Development
if (app.Environment.IsDevelopment())
{
    // Executa START-PRODUCTSCOUT.bat automaticamente
    var startupScriptPath = Path.Combine(app.Environment.ContentRootPath, "START-PRODUCTSCOUT.bat");
    Process.Start(startupScriptPath);
}
```

### 2. **launchSettings.json**
```json
{
  "launchBrowser": false  // Desativa browser do ASP.NET
                         // O script abre o browser correto
}
```

### 3. **START-PRODUCTSCOUT.bat**
- Já existia, não foi modificado
- Inicia backend + frontend + browser

---

## ⚠️ Importante:

### Janelas que Abrem:
1. ✅ **Visual Studio Output** - Mostra "ProductScout startup script launched!"
2. ✅ **Terminal do Script** - Mostra progresso do startup
3. ✅ **Browser** - Abre automaticamente em localhost:3000

### Podes Fechar:
- ❌ Não feches o terminal do script (se fechares, backend/frontend param)
- ✅ Podes minimizar o terminal
- ✅ Podes fechar o debugger do Visual Studio (o script continua)

---

## 🎯 Workflow Recomendado:

### Para Desenvolver:
```
1. F5 no Visual Studio
2. Aguarda ~20 segundos
3. Browser abre automaticamente
4. Começa a usar!
```

### Para Parar:
```
1. Fecha o browser (se quiseres)
2. Duplo-clique: stop-all.bat
```

### Para Reiniciar:
```
1. stop-all.bat
2. Aguarda 5 segundos
3. F5 no Visual Studio de novo
```

---

## 🆘 Resolução de Problemas:

### Problema: "START-PRODUCTSCOUT.bat not found"
**Solução:**
- Garante que estás a correr o Visual Studio a partir da pasta raiz do projeto
- O ficheiro `START-PRODUCTSCOUT.bat` deve estar na mesma pasta que `ProductScout.sln`

### Problema: Browser não abre
**Solução:**
- O script está a correr em background
- Aguarda mais 10-15 segundos
- Ou abre manualmente: http://localhost:3000

### Problema: "Port 3000 already in use"
**Solução:**
```
1. stop-all.bat
2. Aguarda 5 segundos
3. F5 de novo
```

### Problema: Backend não responde
**Solução:**
- Verifica logs em `logs/`
- Corre `diagnose-backend.bat`

---

## 📈 Comparação: Antes vs Depois

| Aspecto | Antes | Depois (com F5) |
|---------|-------|-----------------|
| **Iniciar** | Duplo-clique em START-PRODUCTSCOUT.bat | **F5 no Visual Studio** |
| **Passos** | 1 (duplo-clique) | 1 (F5) |
| **Tempo** | ~20 segundos | ~20 segundos |
| **Browser** | Abre automaticamente | Abre automaticamente |
| **Página** | Pesquisa (localhost:3000) | Pesquisa (localhost:3000) |
| **Integrado com VS?** | ❌ Não | ✅ **Sim!** |

---

## 🎊 Vantagens do F5:

✅ **Tudo integrado no Visual Studio**
✅ **Um único comando (F5)**
✅ **Workflow familiar para devs .NET**
✅ **Debugging do launcher disponível**
✅ **Automático e sem esforço**

---

## 📝 Notas:

1. **O projeto ASP.NET Core é um "launcher"**
   - Não serve conteúdo web
   - Apenas executa o script de startup
   - Podes fechá-lo depois do script iniciar

2. **Backend e Frontend são processos separados**
   - Correm independentemente do Visual Studio
   - Precisas de `stop-all.bat` para os parar

3. **Browser abre em localhost:3000 (não 65386)**
   - O ASP.NET Core corre em 65386/65387
   - Mas redireciona para localhost:3000
   - O ProductScout real está em 3000

---

## ✅ Checklist de Primeira Utilização com F5:

- [ ] Visual Studio 2022 instalado
- [ ] Projeto aberto (ProductScout.sln)
- [ ] Pressiona F5
- [ ] Vê mensagem "ProductScout startup script launched!" no Output
- [ ] Aguarda ~20 segundos
- [ ] Browser abre automaticamente
- [ ] Vê página de pesquisa
- [ ] Testa pesquisar "arroz"
- [ ] Funciona!
- [ ] Quando terminares: stop-all.bat

---

## 🎉 ESTÁ PRONTO!

Agora quando fizeres **F5** no Visual Studio 2022:
- ✅ Tudo inicia automaticamente
- ✅ Browser abre na página certa
- ✅ Pronto para pesquisar produtos!

**É só pressionar F5!** 🚀
