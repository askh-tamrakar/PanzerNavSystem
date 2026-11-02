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
echo [OK] Website build succeeded! Generated assets in site/dist/:
dir /b /s "%SCRIPT_DIR%site\dist"

cd /d "%SCRIPT_DIR%"
exit /b 0
