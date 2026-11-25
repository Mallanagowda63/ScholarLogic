@echo off
REM Stops the ScholarLogic eSSL helper and removes it from startup. Run as administrator.
schtasks /End /TN "ScholarLogic eSSL Helper" >nul 2>&1
schtasks /Delete /F /TN "ScholarLogic eSSL Helper"
echo The helper is stopped and will no longer start with this computer.
pause
