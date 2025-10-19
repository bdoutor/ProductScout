# 🚀 ProductScout - Backend Scripts Guide

## 📋 Quick Start

### First Time / After Crash
```batch
safe-start-backend.bat
```

### Daily Use
```batch
restart-backend.bat
```

### Emergency
```batch
emergency-stop.bat
```

---

## 📚 All Available Scripts

| Script | Purpose | Safety | Speed |
|--------|---------|--------|-------|
| `safe-start-backend.bat` | ⭐ Ultra-robust startup with full validation | 🟢 Highest | 🟡 Slower |
| `restart-backend.bat` | Quick restart with cleanup | 🟢 High | 🟢 Fast |
| `emergency-stop.bat` | Force-stop backend safely | 🟢 Safe | 🟢 Instant |
| `quick-check.bat` | Check backend status | 🟢 Read-only | 🟢 3 sec |
| `diagnose-backend.bat` | Full diagnostic + report | 🟢 Read-only | 🟡 15 sec |
| `capture-state.bat` | Snapshot system state | 🟢 Read-only | 🟢 5 sec |

---

## 🎯 Usage Scenarios

### Scenario 1: Starting Backend (First Time)
```batch
# 1. Capture initial state
capture-state.bat

# 2. Start backend
safe-start-backend.bat

# 3. Verify it's running
quick-check.bat
```

### Scenario 2: Backend is Running, Need to Restart
```batch
# Just restart
restart-backend.bat
```

### Scenario 3: Backend is Stuck / Looping
```batch
# 1. Emergency stop
emergency-stop.bat

# 2. Check it stopped
quick-check.bat

# 3. Safe restart
safe-start-backend.bat
```

### Scenario 4: Something is Wrong, Don't Know What
```batch
# 1. Capture state
capture-state.bat

# 2. Run diagnostic
diagnose-backend.bat

# 3. Check troubleshooting guide
# Open TROUBLESHOOTING.md
```

### Scenario 5: Exit Code 2 / Crash Happened
```batch
# 1. DON'T close the error window yet!
# 2. Take screenshot
# 3. Run diagnostic
diagnose-backend.bat

# 4. Capture state
capture-state.bat

# 5. Check logs
dir logs\*.log /o-d

# 6. Open DEBUG-NOTES.md for analysis
```

---

## 🔍 Understanding the Logs

### Where Logs Are Stored
```
logs/
├── backend-start-YYYYMMDD-HHMMSS.log    (from safe-start-backend.bat)
├── backend-diagnostics-YYYYMMDD-HHMMSS.log  (from diagnose-backend.bat)
└── system-state-YYYYMMDD-HHMMSS.log     (from capture-state.bat)
```

### How to Read Logs
```batch
# View latest startup log
type logs\backend-start-*.log | more

# View latest diagnostic
type logs\backend-diagnostics-*.log | more

# Compare states before/after
fc logs\system-state-202510191000.log logs\system-state-202510191001.log
```

---

## ✅ Success Indicators

When everything works correctly, you should see:

### In safe-start-backend.bat window:
```
========================================
 Startup Complete!
========================================

[INFO] Backend window is open.
[INFO] Log file: logs\backend-start-20251019-100530.log

Quick links:
 - Backend:      http://localhost:3001
 - Health check: http://localhost:3001/health
 - API search:   http://localhost:3001/api/search
```

### In backend window (separate):
```
Starting ProductScout Backend...
[INFO] Starting development server...

> product-scout-backend@1.0.0 dev
> ts-node-dev --respawn --transpile-only src/index.ts

🚀 Product Scout API running on http://localhost:3001
📊 Health check: http://localhost:3001/health
```

### In quick-check.bat:
```
========================================
 Backend Quick Health Check
========================================

[STATUS] Backend is RUNNING on port 3001

[INFO] Process ID: 12345

[TEST] Checking health endpoint...
{"status":"ok","timestamp":"2025-10-19T10:05:30.123Z"}

[OK] Health endpoint is responding!
```

---

## ❌ Failure Indicators

### Exit Code 2
```
[ERROR] Backend failed with exit code 2
```
**What to do:** Check DEBUG-NOTES.md section "SE OCORRER NOVO CRASH"

### Port In Use
```
[ERROR] Port 3001 still in use after cleanup!
```
**What to do:** Run `emergency-stop.bat`

### npm Not Found
```
[FATAL ERROR] npm not found in PATH!
```
**What to do:** Install Node.js from https://nodejs.org

### VS Code Crashed
**What to do:**
1. Close VS Code
2. Run `emergency-stop.bat` from File Explorer
3. Reopen VS Code
4. Run `safe-start-backend.bat`

---

## 🛡️ Safety Features

### What These Scripts WON'T Do:
- ❌ Kill Claude Code process
- ❌ Kill VS Code extension processes
- ❌ Delete any source code
- ❌ Modify package.json
- ❌ Delete node_modules (unless you explicitly do it)
- ❌ Change .env files

### What These Scripts WILL Do:
- ✅ Kill ONLY processes listening on port 3001
- ✅ Create log files for debugging
- ✅ Validate environment before starting
- ✅ Keep error windows open for diagnosis
- ✅ Install dependencies if missing (with confirmation)

---

## 📞 Troubleshooting

### Problem: Script shows "Access Denied"
**Solution:** Run as Administrator (right-click → Run as administrator)

### Problem: "The system cannot find the path specified"
**Solution:** Make sure you're in the ProductScout root folder

### Problem: Backend starts but can't connect
**Solution:**
1. Check if firewall is blocking port 3001
2. Try http://127.0.0.1:3001/health instead of localhost
3. Check backend window for errors

### Problem: Script runs but nothing happens
**Solution:** Check the backend window - it opens in a separate window

---

## 🎓 Best Practices

### DO:
✅ Use `safe-start-backend.bat` after:
  - Git pull
  - npm install
  - Changing .env
  - VS Code crash

✅ Use `quick-check.bat` before starting frontend

✅ Use `emergency-stop.bat` before:
  - Closing VS Code
  - Shutting down PC
  - Running npm install

✅ Capture state before and after when debugging

### DON'T:
❌ Run multiple scripts simultaneously
❌ Close error windows before reading them
❌ Delete logs folder
❌ Edit scripts while they're running
❌ Kill node.exe manually from Task Manager (use emergency-stop.bat)

---

## 📖 Documentation Files

- **README-SCRIPTS.md** (this file) - Quick reference
- **TROUBLESHOOTING.md** - Detailed problem solving guide
- **DEBUG-NOTES.md** - Technical details for debugging
- **logs/*.log** - Generated diagnostic files

---

## 🔗 Quick Commands Reference

```batch
# Start backend (safest)
safe-start-backend.bat

# Quick restart
restart-backend.bat

# Stop backend
emergency-stop.bat

# Check status
quick-check.bat

# Full diagnostic
diagnose-backend.bat

# Capture state for debugging
capture-state.bat

# View latest log
type logs\backend-start-*.log

# Test backend manually
curl http://localhost:3001/health
```

---

## 🆘 Emergency Contacts

If all scripts fail and you need help:

1. **Capture all logs:**
   ```batch
   capture-state.bat
   diagnose-backend.bat
   ```

2. **Take screenshots of:**
   - Error window (don't close it!)
   - VS Code terminal
   - Backend window (if it opened)

3. **Share these files:**
   - Latest `backend-start-*.log`
   - Latest `backend-diagnostics-*.log`
   - Latest `system-state-*.log`
   - Screenshots

4. **Include this info:**
   - What script were you running?
   - What were you trying to do?
   - When did it start failing?
   - Any recent changes (git pull, npm install, etc.)?

---

**Version:** 2.0 - Anti-Loop/Crash Edition
**Last Updated:** 2025-10-19
**Maintained by:** Claude Code Session
