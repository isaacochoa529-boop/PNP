@echo off
title PNP Launcher

cd /d "%~dp0"

echo Starting PNP...
py -3.12 main.py

echo.
echo ----------------------------
echo PNP has closed.
pause