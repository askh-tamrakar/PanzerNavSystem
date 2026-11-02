@echo off
setlocal enabledelayedexpansion

echo =======================================================================
echo             PanzerNavSystem - Upload Firmware to ESP-12E
echo =======================================================================

set "SCRIPT_DIR=%~dp0"

set "TARGET_ENV="
set "EXTRA_ARGS="

:parse_loop
if "%~1"=="" goto after_parse
if /i "%~1"=="esp32" (
    set "TARGET_ENV=esp32dev"
    shift
    goto parse_loop
)
if /i "%~1"=="esp32dev" (
    set "TARGET_ENV=esp32dev"
    shift
    goto parse_loop
)
if /i "%~1"=="esp8266" (
    set "TARGET_ENV=nodemcuv2"
    shift
    goto parse_loop
)
if /i "%~1"=="esp12e" (
    set "TARGET_ENV=nodemcuv2"
    shift
    goto parse_loop
)
if /i "%~1"=="nodemcu" (
    set "TARGET_ENV=nodemcuv2"
    shift
    goto parse_loop
)
if /i "%~1"=="nodemcuv2" (
    set "TARGET_ENV=nodemcuv2"
    shift
    goto parse_loop
)
set "EXTRA_ARGS=!EXTRA_ARGS! %1"
shift
goto parse_loop

:after_parse
if not defined TARGET_ENV set "TARGET_ENV=nodemcuv2"

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

:: Ensure embedded site assets header exists for single-flash deployment
if not exist "%SCRIPT_DIR%firmware\include\site_assets.h" (
    echo [INFO] Generating embedded web assets header before firmware build...
    call "%SCRIPT_DIR%build_site.bat"
)

echo [INFO] Flashing combined firmware + embedded web control panel to %TARGET_ENV%...
cd /d "%SCRIPT_DIR%firmware"
"%PIO_CMD%" run -e %TARGET_ENV% --target upload !EXTRA_ARGS!
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
echo [OK] Combined firmware binary (with embedded website) successfully uploaded to ESP-12E!
echo Both firmware and website are active in flash from this single upload.
echo Open http://192.168.4.1/ on your phone connected to "PanzerTank-AP".
exit /b 0
