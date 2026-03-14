@echo off
setlocal
cd /d "%~dp0"

set "PROMPT_SCRIPT=%~dp0scripts\run_ebay_weighted_round_prompt.py"

if not exist "%PROMPT_SCRIPT%" (
  echo Missing file: %PROMPT_SCRIPT%
  pause
  exit /b 1
)

where py >nul 2>nul
if %errorlevel%==0 (
  py -3 "%PROMPT_SCRIPT%"
) else (
  python "%PROMPT_SCRIPT%"
)

pause
