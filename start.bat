@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

:: Get script directory
set "PROJECT_DIR=%~dp0"
set "BACKEND_DIR=%PROJECT_DIR%backend"
set "FRONTEND_DIR=%PROJECT_DIR%frontend"

title Interview Assistant - Starting...

echo ==========================================
echo     Interview Assistant AI Mock Interview
echo ==========================================
echo.

:: === Check Python virtual environment ===
if not exist "%BACKEND_DIR%\.venv\Scripts\python.exe" (
    echo [ERROR] Python virtual environment not found. Please create .venv first.
    pause
    exit /b 1
)

:: === Check node_modules ===
if not exist "%FRONTEND_DIR%\node_modules" (
    echo [ERROR] node_modules not found. Please run "npm install" in frontend/ directory first.
    pause
    exit /b 1
)

:: === Start Backend ===
echo [1/2] Starting backend service (port 8000) ...
start "Interview-Backend" /D "%BACKEND_DIR%" cmd /k "call .venv\Scripts\activate.bat && python main.py"

:: Wait for backend to be ready
echo Waiting for backend to start...
timeout /t 3 /nobreak >nul

:: === Start Frontend ===
echo [2/2] Starting frontend service (port 5173) ...
start "Interview-Frontend" /D "%FRONTEND_DIR%" cmd /k "npm run dev"

:: Wait for frontend to be ready
echo Waiting for frontend to be ready...
timeout /t 4 /nobreak >nul

:: === Open browser ===
start http://localhost:5173

echo.
echo ==========================================
echo    Startup Complete!
echo    Backend API : http://localhost:8000
echo    Frontend    : http://localhost:5173
echo.
echo    Closing this window will not affect services
echo    To stop services, close the "Interview-Backend"
echo    and "Interview-Frontend" windows
echo ==========================================
echo.
pause