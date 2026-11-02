@echo off
setlocal enabledelayedexpansion

echo =======================================================================
echo          PanzerNavSystem - Build & Upload Site to LittleFS
echo =======================================================================

set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

:: 1. Build the website
echo [STEP 1/3] Building production website...
call "%SCRIPT_DIR%build_site.bat"
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Website build failed. Aborting LittleFS upload.
    exit /b %ERRORLEVEL%
)

:: 2. Stage into firmware/data
echo.
echo [STEP 2/3] Staging site/dist into firmware/data ...
if not exist "%SCRIPT_DIR%firmware\data" (
    mkdir "%SCRIPT_DIR%firmware\data"
)

for /f "delims=" %%F in ('dir /b /a:-d "%SCRIPT_DIR%firmware\data\*" 2^>nul') do (
    if /i not "%%F"==".gitkeep" (
        del /q "%SCRIPT_DIR%firmware\data\%%F" 2>nul
    )
)
if exist "%SCRIPT_DIR%firmware\data\assets" (
    rd /s /q "%SCRIPT_DIR%firmware\data\assets" 2>nul
)

xcopy /e /y /i /q "%SCRIPT_DIR%site\dist\*" "%SCRIPT_DIR%firmware\data\"
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Failed to stage files to firmware/data.
    exit /b %ERRORLEVEL%
)
echo [OK] Files staged to firmware/data.

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

:: 4. Upload LittleFS image
echo.
echo [STEP 3/3] Packaging and uploading LittleFS image with PlatformIO...
cd /d "%SCRIPT_DIR%firmware"
"%PIO_CMD%" run --target uploadfs %*
set "FS_EXIT_CODE=%ERRORLEVEL%"

cd /d "%SCRIPT_DIR%"
if %FS_EXIT_CODE% neq 0 (
    echo.
    echo [ERROR] LittleFS upload failed with exit code %FS_EXIT_CODE%.
    echo Common troubleshooting tips:
    echo   1. Verify your ESP-12E / NodeMCU board is connected via USB.
    echo   2. Specify the serial port explicitly, e.g.:
    echo        upload_site.bat --upload-port COM3
    echo   3. Close any open Serial Monitor or terminal locking the COM port.
    exit /b %FS_EXIT_CODE%
)

echo.
echo [OK] LittleFS filesystem successfully flashed to ESP-12E!
echo The control panel can now be opened directly by connecting to the tank Wi-Fi:
echo   http://192.168.4.1/
exit /b 0
