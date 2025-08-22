#!/bin/bash
set -e

# Build the project
npm run build

# Remove old package if it exists
rm -f package.zip

# Copy files into a temporary folder, respecting .gitignore but keeping dist/
rsync -av \
  --include='dist/' \
  --exclude='.git/' \
  --exclude='.remy/' \
  --exclude-from='.gitignore' \
  ./ ./dist-temp

# Create zip package
cd dist-temp
zip -r ../package.zip .
cd ..

# Cleanup
rm -rf dist-temp

echo "✅ Package created: package.zip"
