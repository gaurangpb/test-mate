@echo off
echo Building Roslyn Parser...
cd roslyn-parser
dotnet build -c Release
if %ERRORLEVEL% NEQ 0 (
    echo Build failed!
    exit /b %ERRORLEVEL%
)
echo Build successful!
cd ..

