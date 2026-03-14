@echo off
setlocal
cd /d "%~dp0"

echo =========================================
echo CampMate eBay image sync
echo Fills real product images into products_source.json
echo =========================================
echo.
set /p LIMIT=How many products to scan this run? [40]: 
if "%LIMIT%"=="" set LIMIT=40

echo.
if exist "%LocalAppData%\Python\pythoncore-3.14-64\python.exe" (
  "%LocalAppData%\Python\pythoncore-3.14-64\python.exe" scripts\sync_product_images_ebay.py --limit %LIMIT%
) else if exist "%LocalAppData%\Programs\Python\Python311\python.exe" (
  "%LocalAppData%\Programs\Python\Python311\python.exe" scripts\sync_product_images_ebay.py --limit %LIMIT%
) else (
  py -3 scripts\sync_product_images_ebay.py --limit %LIMIT%
)

echo.
pause
