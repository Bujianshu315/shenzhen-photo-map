@echo off
chcp 936 >nul
title 深圳出片地图 - 本地预览
cls
echo.
echo   ============================================
echo     深圳出片地图 · 本地预览
echo   ============================================
echo.
echo   正在启动本地服务，请稍等 1-2 秒...
echo   浏览器会自动打开这个地址：
echo.
echo       http://127.0.0.1:8000/
echo.
echo   如果浏览器没自动打开，就把上面这行地址
echo   复制到浏览器地址栏，回车即可。
echo.
echo   --------------------------------------------------
echo   用完之后：直接关闭这个黑色窗口 = 停止服务。
echo   --------------------------------------------------
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"
echo.
echo   服务已停止，窗口可以关闭了。
pause
