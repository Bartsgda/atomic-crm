@echo off
echo [stitch] Starting localhost server on http://localhost:8899
echo [stitch] Ctrl+C to stop
start "" http://localhost:8899
python -m http.server 8899 --directory "%~dp0"
