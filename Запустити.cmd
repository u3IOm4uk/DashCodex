@echo off
cd /d "%~dp0"

echo.
echo ==========================================
echo Dashboard:
echo http://192.168.0.3:8080/
echo ==========================================
echo.
echo Keep this window open while using dashboard.
echo.

"C:\Users\Osiris\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" -m http.server 8080 --bind 0.0.0.0

pause