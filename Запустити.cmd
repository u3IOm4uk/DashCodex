@echo off
cd /d "%~dp0"
echo Dashboard: http://127.0.0.1:8080/
echo Keep this window open while using the dashboard.
"C:\Users\a.kozakevych\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" -m http.server 8080 --bind 127.0.0.1
pause
