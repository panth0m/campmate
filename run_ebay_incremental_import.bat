@echo off
setlocal EnableExtensions
chcp 65001 >nul 2>&1

cd /d "%~dp0"

echo ========================================
echo CampMate eBay incremental importer
echo Category-by-category resume mode
echo ========================================
echo.

echo Categories: tents, chairs, coolers, stoves, lanterns, sleep-systems
set "CATEGORY="
set /p CATEGORY=Category [tents]: 
if not defined CATEGORY set "CATEGORY=tents"

set "TOTAL="
set /p TOTAL=How many NEW products to try this run? [60]: 
if not defined TOTAL set "TOTAL=60"

set "PAGE_SIZE="
set /p PAGE_SIZE=eBay page size per request (1-200) [100]: 
if not defined PAGE_SIZE set "PAGE_SIZE=100"

set "SCRIPT=%~dp0scripts\import_ebay_incremental.py"

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
  py -3 "%SCRIPT%" --category "%CATEGORY%" --total %TOTAL% --page-size %PAGE_SIZE%
) else (
  python "%SCRIPT%" --category "%CATEGORY%" --total %TOTAL% --page-size %PAGE_SIZE%
)

echo.
pause
