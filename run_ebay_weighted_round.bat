@echo off
setlocal EnableExtensions
chcp 65001 >nul 2>&1

cd /d "%~dp0"

echo ========================================
echo CampMate eBay weighted round importer
echo Tents/Chairs priority + incremental resume
echo ========================================
echo.

set "TOTAL="
set /p TOTAL=How many NEW products to try this run across ALL categories? [120]: 
if not defined TOTAL set "TOTAL=120"

set "PERREQ="
set /p PERREQ=eBay page size per request (1-200) [100]: 
if not defined PERREQ set "PERREQ=100"

set "SCRIPT=%~dp0scripts\run_ebay_weighted_round.py"

if not exist "%SCRIPT%" (
  echo.
  echo ERROR: Could not find script:
  echo %SCRIPT%
  echo.
  echo Put this BAT file in your campmate project root folder.
  pause
  exit /b 1
)

where py >nul 2>&1
if %errorlevel%==0 (
  py -3 "%SCRIPT%" --total %TOTAL% --per-request %PERREQ%
) else (
  python "%SCRIPT%" --total %TOTAL% --per-request %PERREQ%
)

echo.
pause
