@echo off
rem ============================================================
rem  JU portable toolchain shim - npm
rem  Real runtime : C:\Users\12601\.workbuddy\binaries\node\versions\22.22.2-6
rem  Version      : 10.9.7
rem ============================================================
call "C:\Users\12601\.workbuddy\binaries\node\versions\22.22.2-6\npm.cmd" %*
exit /b %ERRORLEVEL%
