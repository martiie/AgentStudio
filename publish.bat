@echo off
setlocal

powershell -ExecutionPolicy Bypass -File "%~dp0publish.ps1" %*
if errorlevel 1 exit /b %errorlevel%

endlocal
