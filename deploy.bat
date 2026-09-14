@echo off
chcp 65001 >nul
setlocal

rem PureNavigation deploy launcher. Double-click it.
rem
rem This file only finds Git Bash and hands over to scripts/deploy.sh.
rem All logic lives in deploy.sh -- do not duplicate it here.
rem
rem   deploy.bat               full deploy
rem   deploy.bat --no-build    skip the frontend build
rem   deploy.bat --no-web      install the app, touch neither systemd nor nginx
rem
rem Two hard constraints on this file:
rem   1) Save as CRLF. cmd reads .bat line by line and turns an LF-only file into
rem      nonsense like "'m' is not recognized as an internal or external command".
rem   2) Keep it pure ASCII. Once chcp switches the console to 65001, cmd's batch
rem      parser drifts on multi-byte characters and breaks lines mid-word.
rem      Chinese output comes from bash, which handles UTF-8 correctly.

set "REPO=%~dp0."
cd /d "%REPO%"
if errorlevel 1 goto :nocd

set "BASH="
if exist "%ProgramFiles%\Git\bin\bash.exe" set "BASH=%ProgramFiles%\Git\bin\bash.exe"
if defined BASH goto :run
if exist "%ProgramFiles(x86)%\Git\bin\bash.exe" set "BASH=%ProgramFiles(x86)%\Git\bin\bash.exe"
if defined BASH goto :run
if exist "%LocalAppData%\Programs\Git\bin\bash.exe" set "BASH=%LocalAppData%\Programs\Git\bin\bash.exe"
if defined BASH goto :run

echo.
echo Git Bash was not found, and scripts/deploy.sh is a shell script.
echo Install Git for Windows, then double-click this file again:
echo     https://git-scm.com/download/win
echo.
echo If Git lives on another drive, edit the paths above, or run it yourself:
echo     "D:\path\to\Git\bin\bash.exe" -lc "cd /d/Data/LLM/PureNavigation ^&^& bash scripts/deploy.sh"
pause
exit /b 1

:nocd
echo Cannot enter the folder this .bat sits in. Was the repo moved or renamed?
pause
exit /b 1

:run
echo Using %BASH%
echo Expect prompts as you go: a y/N confirmation, the SSH password, then sudo.
echo.
"%BASH%" -l -c "bash scripts/deploy.sh %*"
set "RC=%ERRORLEVEL%"

echo.
if "%RC%"=="0" echo deploy.sh finished cleanly (exit code 0).
if not "%RC%"=="0" echo deploy.sh exited with code %RC% -- the reason is printed above.
pause
exit /b %RC%
