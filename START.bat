@echo off
title Itenary
cd /d "%~dp0"
echo.
echo   Itenary - starting up...
echo.
where node >nul 2>nul || (echo Node.js 22.13+ is required. Download it from https://nodejs.org & pause & exit /b 1)
if not exist node_modules (
  echo   Installing dependencies (first run only^)...
  call npm install || (pause & exit /b 1)
)
if not exist dist\index.html (
  echo   Building the web app (first run only^)...
  call npm run build || (pause & exit /b 1)
)
start "" http://localhost:4000
call npm start
pause
