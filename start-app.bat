@echo off
echo ========================================
echo  Test Documentation Generator
echo ========================================
echo.

REM Kill existing processes on ports 3000 and 3001
echo Checking for existing processes on ports 3000 and 3001...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
    echo Killing process %%a on port 3000...
    taskkill /PID %%a /F >nul 2>&1
)

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001 ^| findstr LISTENING') do (
    echo Killing process %%a on port 3001...
    taskkill /PID %%a /F >nul 2>&1
)

timeout /t 1 /nobreak >nul
echo.

REM Check if .env file exists
if not exist .env (
    echo WARNING: .env file not found!
    echo Please create a .env file with your OPENAI_API_KEY
    echo See .env.example for reference
    echo.
)

REM Check if node_modules exists (dependencies installed)
if not exist node_modules (
    echo Installing dependencies...
    call npm install
    echo.
)

if not exist client\node_modules (
    echo Installing client dependencies...
    cd client
    call npm install
    cd ..
    echo.
)

REM Check if Roslyn parser is built
if not exist roslyn-parser\bin\Release\net8.0\RoslynParser.exe (
    echo.
    echo Roslyn parser not found. Building it now...
    echo.
    call npm run build:roslyn
    if errorlevel 1 (
        echo.
        echo WARNING: Failed to build Roslyn parser!
        echo C# parsing features will not work until the parser is built.
        echo.
        echo To build manually:
        echo   1. Install .NET 8 SDK from https://dotnet.microsoft.com/download/dotnet/8.0
        echo   2. Run: npm run build:roslyn
        echo.
        echo Continuing to start server anyway...
        echo.
        timeout /t 2 /nobreak >nul
    ) else (
        echo Roslyn parser built successfully!
        echo.
    )
)

echo Starting servers...
echo Backend will run on: http://localhost:3001
echo Frontend will run on: http://localhost:3000
echo.
echo Press Ctrl+C to stop both servers
echo ========================================
echo.

echo Running: npm run start:all
call npm run start:all

