@echo off
setlocal enabledelayedexpansion

echo =======================================================================
echo             PanzerNavSystem - Upload Firmware to ESP-12E
echo =======================================================================

set "SCRIPT_DIR=%~dp0"

:: Locate PlatformIO
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

echo [INFO] Running PlatformIO firmware upload with arguments: %*
cd /d "%SCRIPT_DIR%firmware"
"%PIO_CMD%" run --target upload %*
set "UPLOAD_EXIT_CODE=%ERRORLEVEL%"

cd /d "%SCRIPT_DIR%"
if %UPLOAD_EXIT_CODE% neq 0 (
    echo.
    echo [ERROR] Firmware upload failed with exit code %UPLOAD_EXIT_CODE%.
    echo Common troubleshooting tips:
    echo   1. Verify your ESP-12E / NodeMCU board is connected via USB.
    echo   2. Specify the serial port explicitly, e.g.:
    echo        upload_firmware.bat --upload-port COM3
    echo   3. On bare ESP-12E boards, ensure GPIO0 is pulled to GND while resetting into bootloader.
    echo   4. Close any open Serial Monitor or terminal locking the COM port.
    exit /b %UPLOAD_EXIT_CODE%
)

echo.
echo [OK] Firmware successfully uploaded to ESP-12E!
exit /b 0
