@echo off
setlocal enabledelayedexpansion

echo =======================================================================
echo          PanzerNavSystem - Environment and Dependency Setup
echo =======================================================================
echo.

set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

:: 1. Check Node.js
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not found in PATH.
    echo Please download and install Node.js - LTS version recommended - from:
    echo   https://nodejs.org/
    exit /b 1
)
for /f "tokens=*" %%v in ('node -v') do set "NODE_VER=%%v"
echo [OK] Node.js detected: %NODE_VER%

:: 2. Check npm
where npm >nul 2>&1
if %ERRORLEVEL% neq 0 (
    where npm.cmd >nul 2>&1
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] npm is not found in PATH.
        exit /b 1
    )
)
echo [OK] npm detected.

:: 3. Check PlatformIO CLI
set "PIO_CMD="
where pio >nul 2>&1
if %ERRORLEVEL% equ 0 (
    set "PIO_CMD=pio"
) else (
    if exist "%LOCALAPPDATA%\Programs\Python\Python312\Scripts\pio.exe" (
        set "PIO_CMD=%LOCALAPPDATA%\Programs\Python\Python312\Scripts\pio.exe"
    ) else if exist "%LOCALAPPDATA%\Programs\Python\Python311\Scripts\pio.exe" (
        set "PIO_CMD=%LOCALAPPDATA%\Programs\Python\Python311\Scripts\pio.exe"
    ) else if exist "%USERPROFILE%\.platformio\penv\Scripts\pio.exe" (
        set "PIO_CMD=%USERPROFILE%\.platformio\penv\Scripts\pio.exe"
    )
)

if not defined PIO_CMD (
    echo [WARNING] PlatformIO CLI - pio - was not found in PATH or standard locations.
    echo To build and upload firmware from the command line, install PlatformIO via pip:
    echo   python -m pip install platformio
    echo or install the PlatformIO IDE extension in VS Code.
) else (
    for /f "tokens=*" %%p in ('"%PIO_CMD%" --version') do set "PIO_VER=%%p"
    echo [OK] PlatformIO detected: !PIO_VER!
)

:: 4. Install site dependencies using lockfile
echo.
echo [INFO] Installing website dependencies in site/ ...
cd /d "%SCRIPT_DIR%site"
if exist "package-lock.json" (
    call npm.cmd ci
    if !ERRORLEVEL! neq 0 (
        echo [WARNING] npm ci failed. Attempting npm install...
        call npm.cmd install
        if !ERRORLEVEL! neq 0 (
            echo [ERROR] Failed to install website dependencies.
            cd /d "%SCRIPT_DIR%"
            exit /b 1
        )
    )
) else (
    call npm.cmd install
    if !ERRORLEVEL! neq 0 (
        echo [ERROR] Failed to install website dependencies.
        cd /d "%SCRIPT_DIR%"
        exit /b 1
    )
)
echo [OK] Website dependencies installed successfully.

:: 5. Create local firmware config template if not present
cd /d "%SCRIPT_DIR%"
if not exist "firmware\include\config.local.h" (
    if exist "firmware\include\config.local.h.example" (
        copy "firmware\include\config.local.h.example" "firmware\include\config.local.h" >nul
        echo [OK] Created firmware\include\config.local.h template - ignored by git.
    )
)

echo.
echo =======================================================================
echo Setup complete! You are ready to build the site and firmware:
echo   - Run build_site.bat to compile the website.
echo   - Run build_all.bat to build both the website and firmware.
echo   - Run upload_firmware.bat to flash the ESP-12E board.
echo   - Run upload_site.bat to upload the website into LittleFS.
echo =======================================================================
exit /b 0
