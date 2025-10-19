# 🔧 ProductScout Backend - Troubleshooting Guide

## 📋 Quick Reference

### Scripts Available

| Script | Purpose | When to Use |
|--------|---------|-------------|
| `safe-start-backend.bat` | **RECOMMENDED** - Ultra-robust startup with full validation | First time, or after crashes |
| `restart-backend.bat` | Quick restart with cleanup | Normal daily use |
| `emergency-stop.bat` | Force-stop backend safely | When backend is stuck/looping |
| `quick-check.bat` | Check if backend is running | Quick status check |
| `diagnose-backend.bat` | Full system diagnostic | When troubleshooting issues |

---

## 🚨 Common Problems & Solutions

### Problem 1: Exit Code 2 (Backend crashes immediately)

**Symptoms:**
- Backend window closes instantly
- Exit code 2 shown
- VS Code may crash

**Causes & Solutions:**

#### Cause A: Port 3001 already in use
```batch
# Solution: Run emergency stop first
emergency-stop.bat
# Then start again
safe-start-backend.bat
```

#### Cause B: Missing dependencies
```batch
# Solution: Reinstall dependencies
cd backend
npm install
cd ..
safe-start-backend.bat
```

#### Cause C: TypeScript compilation errors
```batch
# Solution: Check for syntax errors
cd backend
npm run build
# Fix any errors shown
cd ..
safe-start-backend.bat
```

#### Cause D: Missing or invalid .env file
```batch
# Solution: Check .env exists in backend folder
# Should contain (example):
# PORT=3001
# NODE_ENV=development
```

---

### Problem 2: Backend Loop (Keeps restarting)

**Symptoms:**
- ts-node-dev keeps restarting
- Console shows constant compilation
- CPU usage high

**Causes & Solutions:**

#### Cause A: File watching issues
```batch
# Solution 1: Stop and clear node_modules cache
emergency-stop.bat
cd backend
rmdir /s /q node_modules
npm install
cd ..
safe-start-backend.bat
```

#### Cause B: Circular dependency or import error
```typescript
// Check for circular imports in:
// - src/index.ts
// - src/routes/*.ts
// - src/services/*.ts
```

---

### Problem 3: Port 3001 Won't Free Up

**Symptoms:**
- Error: "Port 3001 already in use"
- restart-backend.bat fails at cleanup

**Solutions:**

#### Solution 1: Use emergency stop
```batch
emergency-stop.bat
```

#### Solution 2: Manual cleanup
```batch
# Find process using port 3001
netstat -ano | findstr ":3001"
# Note the PID (last column)
taskkill /F /PID <PID>
```

#### Solution 3: Change port temporarily
```bash
# In backend/.env, change:
PORT=3002
# Then restart
```

---

### Problem 4: VS Code Crashes When Running Script

**Symptoms:**
- VS Code freezes
- Must restart VS Code
- Terminal becomes unresponsive

**Causes & Solutions:**

#### Cause: Too many node.exe processes killed
**Prevention:**
- Use `safe-start-backend.bat` instead of `restart-backend.bat`
- `safe-start-backend.bat` only kills processes on port 3001
- Does NOT kill all node.exe (protects Claude Code, VS Code extensions)

#### Recovery:
```batch
# 1. Close VS Code completely
# 2. Run emergency-stop.bat from File Explorer (double-click)
# 3. Reopen VS Code
# 4. Use safe-start-backend.bat
```

---

### Problem 5: "npm not found" Error

**Symptoms:**
- Script fails immediately
- Error: "'npm' is not recognized"

**Solutions:**

#### Solution 1: Verify Node.js installation
```batch
# Run these commands:
where node
where npm
# If not found, reinstall Node.js from https://nodejs.org
```

#### Solution 2: Fix PATH environment variable
```batch
# Add to PATH:
C:\Program Files\nodejs\
# Restart terminal/VS Code after changing PATH
```

---

### Problem 6: Backend Starts But Health Check Fails

**Symptoms:**
- Port 3001 listening
- curl/browser shows connection error
- Backend console shows no errors

**Solutions:**

#### Check 1: Wait for initialization
```batch
# Backend may still be compiling TypeScript
# Wait 10-15 seconds, then check again:
quick-check.bat
```

#### Check 2: Check for runtime errors
```batch
# Look in the backend window for:
# - Module not found errors
# - Database connection errors
# - Missing environment variables
```

#### Check 3: Test manually
```bash
# In browser or curl:
http://localhost:3001/health
# Should return: {"status":"ok","timestamp":"..."}
```

---

## 🔍 Diagnostic Workflow

When you encounter ANY issue:

### Step 1: Quick Check
```batch
quick-check.bat
```
- Shows if backend is running
- Tests health endpoint
- Takes 3 seconds

### Step 2: Full Diagnostic (if issue persists)
```batch
diagnose-backend.bat
```
- Generates detailed report
- Saves to `backend-diagnostics-*.log`
- Checks:
  - Node.js/npm installation
  - Directory structure
  - Running processes
  - Port availability
  - Configuration files

### Step 3: Emergency Stop (if needed)
```batch
emergency-stop.bat
```
- Safely stops all backend processes
- Frees port 3001
- Does NOT affect other applications

### Step 4: Clean Start
```batch
safe-start-backend.bat
```
- Full validation before start
- Detailed logging
- Error messages stay visible

---

## 📊 Understanding Error Codes

| Exit Code | Meaning | Common Cause |
|-----------|---------|--------------|
| 0 | Success | Normal exit (Ctrl+C) |
| 1 | General error | Missing files, permissions |
| 2 | Misuse of shell | Invalid command, syntax error |
| 130 | Terminated by Ctrl+C | User stopped process |
| 3221225786 | Access violation | Port in use, permission denied |

---

## 🛠️ Advanced Troubleshooting

### View Real-Time Logs
```batch
# Backend window shows live logs
# Look for:
# ✅ "🚀 Product Scout API running on http://localhost:3001"
# ❌ "Error: listen EADDRINUSE: address already in use :::3001"
# ❌ "Cannot find module '...'"
```

### Check Backend Startup Logs
```batch
# Logs saved in:
logs\backend-start-*.log
# View latest log to see what happened
```

### Test Individual Components
```batch
# Test TypeScript compilation:
cd backend
npx tsc --noEmit
# Should show no errors

# Test npm scripts:
npm run build
# Should compile successfully

# Test dependencies:
npm list
# Should show no missing packages
```

---

## ⚡ Performance Tips

### Faster Restarts
```batch
# If no code changes, just use:
restart-backend.bat

# If you changed dependencies or had issues:
safe-start-backend.bat
```

### Reduce Restart Frequency
```bash
# ts-node-dev auto-restarts on file changes
# You usually DON'T need to manually restart
# Only restart if:
# - Changed .env
# - Installed new packages
# - Backend is stuck/crashed
```

---

## 📞 Still Having Issues?

### Check These Files
1. `backend/package.json` - Verify "dev" script exists
2. `backend/src/index.ts` - Check for syntax errors
3. `backend/.env` - Verify PORT=3001
4. `backend/tsconfig.json` - Verify TypeScript config

### Generate Diagnostic Report
```batch
diagnose-backend.bat
# Share the generated .log file for help
```

### Nuclear Option (Complete Reset)
```batch
# ⚠️ Only if nothing else works:
emergency-stop.bat

# Delete and reinstall:
cd backend
rmdir /s /q node_modules
rmdir /s /q dist
npm install
cd ..

# Clean start:
safe-start-backend.bat
```

---

## ✅ Prevention Best Practices

1. **Always use `safe-start-backend.bat` after:**
   - Installing new npm packages
   - Changing .env file
   - Pulling code from git
   - VS Code crashes

2. **Use `emergency-stop.bat` before:**
   - Closing VS Code
   - Shutting down computer
   - Running `npm install`

3. **Run `quick-check.bat` to:**
   - Verify backend is running
   - Test health endpoint
   - Check before starting frontend

4. **Check logs in:**
   - Backend terminal window (real-time)
   - `logs\backend-start-*.log` (startup logs)
   - `backend-diagnostics-*.log` (diagnostic reports)

---

## 🎯 Quick Commands Cheat Sheet

```batch
# Start backend (recommended)
safe-start-backend.bat

# Quick restart
restart-backend.bat

# Stop backend
emergency-stop.bat

# Check status
quick-check.bat

# Full diagnostic
diagnose-backend.bat

# Test manually (after start)
curl http://localhost:3001/health
```

---

**Last Updated:** 2025-10-19
**Version:** 2.0 - Anti-Loop/Crash Edition
