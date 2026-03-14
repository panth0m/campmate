@echo off
setlocal
cd /d "%~dp0"
if exist "%LocalAppData%\Programs\Python\Python314\python.exe" (
  "%LocalAppData%\Programs\Python\Python314\python.exe" scripts\run_catalog_cleanup.py
) else if exist "%LocalAppData%\Programs\Python\Python313\python.exe" (
  "%LocalAppData%\Programs\Python\Python313\python.exe" scripts\run_catalog_cleanup.py
) else if exist "%LocalAppData%\Python\pythoncore-3.14-64\python.exe" (
  "%LocalAppData%\Python\pythoncore-3.14-64\python.exe" scripts\run_catalog_cleanup.py
) else (
  py -3 scripts\run_catalog_cleanup.py
)
pause
