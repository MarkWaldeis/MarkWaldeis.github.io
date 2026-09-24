@echo off
cd /d "%~dp0"
echo Starte FABWERK Server auf http://localhost:8030 ...
start "Fabwerk Server" cmd /c "py -3 -m http.server 8030 2>nul || python -m http.server 8030"
timeout /t 1 >nul
start "" http://localhost:8030/
echo Browser-Fenster geoeffnet. Server laeuft - zum Beenden dieses Fenster schliessen.
pause
