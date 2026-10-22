@echo off
REM ScholarLogic eSSL helper: start automatically when this computer starts (no login needed).
REM Right-click this file and choose "Run as administrator".
setlocal
cd /d "%~dp0"

net session >nul 2>&1
if errorlevel 1 (
  echo Please right-click install-windows.bat and choose "Run as administrator".
  pause
  exit /b 1
)

for /f "delims=" %%N in ('where node 2^>nul') do if not defined NODE set "NODE=%%N"
if not defined NODE (
  echo Node.js is not installed. Install the LTS version from https://nodejs.org and run this again.
  pause
  exit /b 1
)

if not exist "%~dp0agent.config.json" (
  echo agent.config.json is missing. Copy agent.config.example.json to agent.config.json and fill in the secret.
  pause
  exit /b 1
)

echo Testing one read of the machine and one send to the server...
"%NODE%" "%~dp0essl-agent.js" --once
if errorlevel 1 (
  echo.
  echo The test failed. Read the message above, fix agent.config.json, and run this again.
  pause
  exit /b 1
)

schtasks /Create /F /TN "ScholarLogic eSSL Helper" /SC ONSTART /RU SYSTEM /RL HIGHEST /TR "\"%NODE%\" \"%~dp0essl-agent.js\"" >nul
if errorlevel 1 (
  echo Could not create the startup task.
  pause
  exit /b 1
)
schtasks /Run /TN "ScholarLogic eSSL Helper" >nul

echo.
echo Done. The helper is running now and will start by itself whenever this computer starts.
echo Its log is in "%~dp0agent.log".
pause
