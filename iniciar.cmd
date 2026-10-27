@echo off
if exist "%~dp0..\INICIAR-MENTOR-IA.cmd" (
  call "%~dp0..\INICIAR-MENTOR-IA.cmd"
  exit /b
)
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Instale o Node.js 24.10 ou posterior em https://nodejs.org/
  pause
  exit /b 1
)
echo Mentor IA - aplicacao local
echo Acesse http://127.0.0.1:3000/login/ no navegador.
echo Mantenha esta janela aberta. Ctrl+C para encerrar.
node --env-file-if-exists=.env server/index.mjs
pause
