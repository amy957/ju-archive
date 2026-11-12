@echo off
rem ============================================================
rem  JU portable toolchain shim - node
rem  Real runtime : C:\Users\12601\.workbuddy\binaries\node\versions\22.22.2-6
rem  Version      : v22.22.2
rem  Purpose      : 让本仓库在没有全局 Node 的机器上可复现构建/测试
rem  Usage        : set "PATH=%CD%\_nodebin;%PATH%"
rem ============================================================
"C:\Users\12601\.workbuddy\binaries\node\versions\22.22.2-6\node.exe" %*
exit /b %ERRORLEVEL%
