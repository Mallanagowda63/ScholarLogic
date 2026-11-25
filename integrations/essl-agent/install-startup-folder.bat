@echo off
REM ScholarLogic eSSL helper: start by itself whenever this user signs in to Windows (no administrator needed).
REM Use this when install-windows.bat says "Could not create the startup task" (e.g. security software blocks it).
setlocal
cd /d "%~dp0"

for /f "delims=" %%N in ('where node 2^>nul') do if not defined NODE set "NODE=%%N"
if not defined NODE (
  echo Node.js is not installed. Install the LTS version from https://nodejs.org and run this again.
  pause
  exit /b 1
)

set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "LAUNCHER=%STARTUP%\ScholarLogic eSSL Helper.vbs"

REM A tiny launcher that runs the helper with no window
> "%LAUNCHER%" echo Set sh = CreateObject("WScript.Shell")
>> "%LAUNCHER%" echo sh.CurrentDirectory = "%~dp0"
>> "%LAUNCHER%" echo sh.Run """%NODE%"" ""%~dp0essl-agent.js""", 0, False

if not exist "%LAUNCHER%" (
  echo Could not write to the Startup folder.
  pause
  exit /b 1
)

REM Start it now as well
wscript "%LAUNCHER%"

echo.
echo Done. The helper is running now (in the background) and starts by itself whenever you sign in to this computer.
echo Its log is in "%~dp0agent.log".
echo To stop it for good: delete "%LAUNCHER%"
pause
