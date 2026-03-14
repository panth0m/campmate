@echo off
setlocal EnableExtensions
chcp 65001 >nul 2>&1
pushd "%~dp0" || (
  echo ERROR: Could not open the campmate project folder.
  pause
  exit /b 1
)

if not exist "scripts\run_ebay_weighted_round_prompt.py" (
  echo ERROR: Missing scripts\run_ebay_weighted_round_prompt.py
  echo Put this BAT file in your campmate project root folder.
  pause
  exit /b 1
)

where py >nul 2>&1
if %errorlevel%==0 (
  py -3 "scripts\run_ebay_weighted_round_prompt.py"
) else (
  python "scripts\run_ebay_weighted_round_prompt.py"
)

echo.
popd
pause
