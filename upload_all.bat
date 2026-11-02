@echo off
setlocal enabledelayedexpansion

echo =======================================================================
echo     PanzerNavSystem - Combined Single-Flash Upload (Site + Firmware)
echo =======================================================================
echo.
echo [INFO] Combining website and firmware into ONE SINGLE FLASH BINARY...
echo [INFO] This prevents partition erasing conflicts and flashes everything at once.
echo.

set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

:: 1. Build the website and embed into C++ PROGMEM header
echo [STEP 1/2] Building Vite website and generating embedded firmware header...
call "%SCRIPT_DIR%build_site.bat"
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Website compilation failed. Aborting upload.
    exit /b %ERRORLEVEL%
)

:: 2. Parse target board and locate PlatformIO
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

:: 3. Compile unified binary and upload in ONE single flash operation
echo.
echo [STEP 2/2] Compiling and uploading unified binary (Firmware + Website) to target: %TARGET_ENV%...
cd /d "%SCRIPT_DIR%firmware"
"%PIO_CMD%" run -e %TARGET_ENV% --target upload !EXTRA_ARGS!
set "UPLOAD_EXIT_CODE=%ERRORLEVEL%"

cd /d "%SCRIPT_DIR%"
if %UPLOAD_EXIT_CODE% neq 0 (
    echo.
    echo [ERROR] Upload failed with exit code %UPLOAD_EXIT_CODE%.
    echo Common troubleshooting tips:
    echo   1. Verify your ESP32 or ESP-12E / NodeMCU board is connected via USB.
    echo   2. Specify the serial port explicitly, e.g.:
    echo        upload_all.bat esp32 --upload-port COM3
    echo        upload_all.bat esp8266 --upload-port COM4
    echo   3. On ESP32 boards with manual boot: hold BOOT, tap EN/RST, then release BOOT.
    echo      On ESP-12E boards: hold FLASH (GPIO0 to GND), tap RST, then release FLASH.
    echo   4. Close any open Serial Monitor or terminal locking the COM port.
    exit /b %UPLOAD_EXIT_CODE%
)

echo.
echo =======================================================================
echo [OK] Combined single-flash upload completed successfully!
echo   - Firmware and Website are both active inside %TARGET_ENV% flash.
echo   - No separate LittleFS upload required.
echo.
echo Ready to drive:
echo   1. Connect your phone to Wi-Fi: "PanzerTank-AP" (password: panzer123456)
echo   2. Open your mobile browser to: http://192.168.4.1/
echo =======================================================================
exit /b 0
