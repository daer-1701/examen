@echo off
echo Iniciando examen en http://localhost:8080
echo Cierra esta ventana para detener el servidor.
cd /d "%~dp0"
python -m http.server 8080
