@echo off
rem ============================================================
rem  JU portable toolchain shim - npx
rem  Real runtime : C:\Users\12601\.workbuddy\binaries\node\versions\22.22.2-6
rem ============================================================
call "C:\Users\12601\.workbuddy\binaries\node\versions\22.22.2-6\npx.cmd" %*
exit /b %ERRORLEVEL%
