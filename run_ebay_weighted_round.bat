@echo off
setlocal
cd /d "%~dp0"

if not exist "scripts\run_ebay_weighted_round_prompt.py" (
  echo ERROR: scripts\run_ebay_weighted_round_prompt.py not found.
  pause
  exit /b 1
)

py -3 "scripts\run_ebay_weighted_round_prompt.py"
if errorlevel 1 (
  echo.
  echo Failed with py -3. Trying python...
  python "scripts\run_ebay_weighted_round_prompt.py"
)

echo.
pause
