#!/bin/bash
echo "Building Roslyn Parser..."
cd roslyn-parser
dotnet build -c Release
if [ $? -ne 0 ]; then
    echo "Build failed!"
    exit 1
fi
echo "Build successful!"
cd ..

