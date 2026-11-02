@echo off
setlocal enabledelayedexpansion

echo =======================================================================
echo         PanzerNavSystem - Build All (Website + Firmware)
echo =======================================================================

set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

:: 1. Build the website
echo [STEP 1/3] Building Vite production web assets...
call "%SCRIPT_DIR%build_site.bat"
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Web build failed. Aborting full build.
    exit /b %ERRORLEVEL%
)

:: 2. Stage website assets into firmware/data for LittleFS
echo.
echo [STEP 2/3] Staging site/dist into firmware/data for LittleFS packaging...
if not exist "%SCRIPT_DIR%firmware\data" (
    mkdir "%SCRIPT_DIR%firmware\data"
)

:: Remove previously staged files in firmware\data except .gitkeep
for /f "delims=" %%F in ('dir /b /a:-d "%SCRIPT_DIR%firmware\data\*" 2^>nul') do (
    if /i not "%%F"==".gitkeep" (
        del /q "%SCRIPT_DIR%firmware\data\%%F" 2>nul
    )
)
if exist "%SCRIPT_DIR%firmware\data\assets" (
    rd /s /q "%SCRIPT_DIR%firmware\data\assets" 2>nul
)

:: Copy newly built site files into firmware/data
xcopy /e /y /i /q "%SCRIPT_DIR%site\dist\*" "%SCRIPT_DIR%firmware\data\"
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Failed to stage web assets to firmware/data.
    exit /b %ERRORLEVEL%
)
echo [OK] Web assets successfully staged to firmware/data.

:: 3. Locate PlatformIO
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
    echo [ERROR] PlatformIO CLI - pio - was not found in PATH or standard locations.
    echo Please install PlatformIO: python -m pip install platformio
    exit /b 1
)

:: 4. Build Firmware
echo.
echo [STEP 3/3] Compiling ESP8266 firmware with PlatformIO...
cd /d "%SCRIPT_DIR%firmware"
"%PIO_CMD%" run
set "PIO_EXIT_CODE=%ERRORLEVEL%"

cd /d "%SCRIPT_DIR%"
if %PIO_EXIT_CODE% neq 0 (
    echo [ERROR] PlatformIO firmware build failed with exit code %PIO_EXIT_CODE%.
    exit /b %PIO_EXIT_CODE%
)

echo.
echo =======================================================================
echo [OK] Full build completed successfully!
echo   - Site is built and staged in firmware/data
echo   - Firmware binary is compiled in firmware/.pio/build/
echo =======================================================================
exit /b 0
