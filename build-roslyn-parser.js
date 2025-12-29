const { execSync } = require('child_process');
const path = require('path');
const os = require('os');

const platform = os.platform();
const isWindows = platform === 'win32';

console.log('Building Roslyn Parser...');

try {
  const roslynPath = path.join(__dirname, 'roslyn-parser');
  
  if (isWindows) {
    execSync('dotnet build -c Release', { 
      cwd: roslynPath, 
      stdio: 'inherit' 
    });
  } else {
    execSync('dotnet build -c Release', { 
      cwd: roslynPath, 
      stdio: 'inherit' 
    });
  }
  
  console.log('Roslyn parser build successful!');
} catch (error) {
  console.warn('⚠️  Warning: Failed to build Roslyn parser:', error.message);
  console.warn('⚠️  Make sure .NET 8 SDK is installed.');
  console.warn('⚠️  Server will start, but C# parsing features will not work until the parser is built.');
  console.warn('⚠️  To build manually, run: npm run build:roslyn');
  // Don't exit - allow server to start even if build fails
}

