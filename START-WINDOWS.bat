@echo off
cd /d "%~dp0"
echo.
echo ========================================
echo   Client Management System

echo   Requires Node.js 22.5+
echo ========================================
echo.
node -e "const v=Number(process.versions.node.split('.')[0]); if(v<22){console.error('ERROR: Node.js 24 or newer is required. Current: '+process.versions.node); process.exit(1)}"
if errorlevel 1 pause & exit /b 1

if exist node_modules (
  echo Existing node_modules found.
) else (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 pause & exit /b 1
)

echo.
echo Starting app at http://localhost:3000
call npm run dev
pause
