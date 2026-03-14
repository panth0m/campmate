@echo off
setlocal
cd /d "%~dp0"

if not exist "scripts\run_ebay_weighted_round.py" (
  echo [ERROR] Missing file: scripts\run_ebay_weighted_round.py
  echo Put this BAT file inside your campmate project root folder.
  echo Example: the same folder that contains index.html, worker.js, assets, data, scripts.
  pause
  exit /b 1
)

echo ==========================================
echo CampMate eBay weighted round importer
echo Tents/Chairs priority + incremental resume
echo ==========================================
echo.
set /p TOTAL=How many NEW products to try this run across ALL categories? [120]: 
if "%TOTAL%"=="" set TOTAL=120

set /p PERREQ=eBay page size per request (1-200) [100]: 
if "%PERREQ%"=="" set PERREQ=100

python "scripts\run_ebay_weighted_round.py" --total %TOTAL% --per-request %PERREQ%

echo.
if exist "data\ebay_weighted_round_last_run.json" (
  echo Done. Summary saved to data\ebay_weighted_round_last_run.json
) else (
  echo Finished, but summary file was not created. Check the messages above.
)
pause
