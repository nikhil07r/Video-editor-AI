@echo off
title CapCut AI Video Editor
cd /d C:\VideoEditorAI
echo ========================================================
echo        STARTING LOCAL AI VIDEO EDITOR ENGINE
echo ========================================================
echo.
echo Starting web server on http://localhost:4500 ...
start http://localhost:4500
node server.js
pause
