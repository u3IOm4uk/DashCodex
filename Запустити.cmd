@echo off
setlocal
cd /d "%~dp0"

set "PORT=8080"
set "HOST=127.0.0.1"
set "URL=http://%HOST%:%PORT%/"

where py >nul 2>nul
if %errorlevel%==0 (
    set "PY_CMD=py -3"
    goto :run
)

where python >nul 2>nul
if %errorlevel%==0 (
    set "PY_CMD=python"
    goto :run
)

where python3 >nul 2>nul
if %errorlevel%==0 (
    set "PY_CMD=python3"
    goto :run
)

echo [ПОМИЛКА] Python 3 не знайдено у PATH.
echo Встановіть Python 3 або запустіть у корені проєкту:
echo   python -m http.server %PORT% --bind %HOST%
echo.
pause
exit /b 1

:run
echo КОНТУР: %URL%
echo Сервер доступний лише локально на цьому ПК.
echo Закрийте це вікно, щоб зупинити сервер.
echo.
start "" "%URL%"
%PY_CMD% -m http.server %PORT% --bind %HOST%

if errorlevel 1 (
    echo.
    echo [ПОМИЛКА] Не вдалося запустити локальний HTTP-сервер.
    pause
)

endlocal
