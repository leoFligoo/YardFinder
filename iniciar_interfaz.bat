@echo off
setlocal
cd /d "%~dp0"
set "YARD_PYTHON=python"
if exist ".venv\Scripts\python.exe" set "YARD_PYTHON=.venv\Scripts\python.exe"

"%YARD_PYTHON%" -B diagnostico_entorno.py
if errorlevel 1 goto entorno_incompleto

"%YARD_PYTHON%" -B interfaz.py %*
set "YARD_EXIT=%ERRORLEVEL%"
pause
exit /b %YARD_EXIT%

:entorno_incompleto
echo.
echo No se pudo validar el entorno Python. Revisa los mensajes anteriores.
echo Para preparar un entorno local con Python 3.12 instalado:
echo   py -3.12 -m venv .venv
echo   .venv\Scripts\python.exe -m pip install -r requirements.txt
pause
exit /b 1
