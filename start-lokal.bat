@echo off
cd /d "%~dp0"
where py >nul 2>nul && (py start-lokal.py & goto :end)
where python >nul 2>nul && (python start-lokal.py & goto :end)
echo Python wurde nicht gefunden. Bitte Python 3 von python.org installieren (Haken bei "Add to PATH").
pause
:end
