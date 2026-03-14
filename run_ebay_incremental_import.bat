@echo off
setlocal
cd /d "%~dp0"

if not exist "scripts\import_ebay_incremental.py" (
  echo [ERROR] Missing file: scripts\import_ebay_incremental.py
  echo Put this BAT file inside your campmate project root folder.
  pause
  exit /b 1
)

set /p CATEGORY=Category (tents/chairs/coolers/stoves/lanterns/sleep-systems) [tents]: 
if "%CATEGORY%"=="" set CATEGORY=tents

set /p TOTAL=How many NEW products to add this run? [60]: 
if "%TOTAL%"=="" set TOTAL=60

set /p PERREQ=eBay page size per request (1-200) [100]: 
if "%PERREQ%"=="" set PERREQ=100

python "scripts\import_ebay_incremental.py" --category %CATEGORY% --total %TOTAL% --per-request %PERREQ%

echo.
pause
