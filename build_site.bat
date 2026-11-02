@echo off
setlocal enabledelayedexpansion

echo =======================================================================
echo               PanzerNavSystem - Building Website (Vite)
echo =======================================================================

set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%site"

if not exist "package.json" (
    echo [ERROR] Cannot find site/package.json. Ensure the script is executed from the repository root.
    exit /b 1
)

echo [INFO] Running production build in site/ ...
call npm.cmd run build
set "BUILD_EXIT_CODE=%ERRORLEVEL%"

if %BUILD_EXIT_CODE% neq 0 (
    echo [ERROR] Website build failed with exit code %BUILD_EXIT_CODE%.
    cd /d "%SCRIPT_DIR%"
    exit /b %BUILD_EXIT_CODE%
)

echo.
echo [INFO] Embedding web assets into firmware/include/site_assets.h for single-flash deployment ...
cd /d "%SCRIPT_DIR%"
node scripts\embed_assets.js
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Asset embedding failed with exit code %ERRORLEVEL%.
    exit /b %ERRORLEVEL%
)

echo.
echo [OK] Website build and firmware embedding succeeded!
exit /b 0
