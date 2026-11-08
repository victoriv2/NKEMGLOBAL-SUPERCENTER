@echo off
echo ========================================================
echo Starting Nkem Shop Web Server on http://localhost:8080 ...
echo ========================================================
start http://localhost:8080
"C:\Users\hp\.local\bin\uv.exe" run python -m http.server 8080
pause
