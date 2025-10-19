# Como iniciar o ProductScout

## Forma mais simples (Duplo clique):

1. **Duplo clique** em `start.bat`
2. Aguarde alguns segundos
3. O navegador abrirá automaticamente em http://localhost:3000

---

## Parar os servidores:

- **Duplo clique** em `stop.bat`

---

## Forma manual (Terminal):

### Terminal 1 - Backend:
```bash
cd backend
npm run dev
```

### Terminal 2 - Frontend:
```bash
cd frontend
npm run dev
```

### Depois abra o navegador:
http://localhost:3000

---

## Usando VS Code:

1. Abra o painel **Run and Debug** (Ctrl+Shift+D)
2. Selecione **"Start Backend Only"** e clique em ▶️
3. Selecione **"Start Frontend Only"** e clique em ▶️
4. Abra http://localhost:3000 no navegador

---

## Troubleshooting:

**Erro "Port already in use":**
- Execute `stop.bat` para parar todos os servidores
- Tente novamente

**Página não carrega:**
- Verifique se ambos os servidores estão a correr
- Backend deve estar em http://localhost:3001
- Frontend deve estar em http://localhost:3000
