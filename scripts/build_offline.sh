#!/bin/bash
# Build offline install package for moli-code
# This creates a tarball that can be installed without network access

set -e

echo "Building moli-code offline package..."
node scripts/sync-package-versions.js
PACKAGE_VERSION=$(node -p "require('./package.offline.json').version")
PACKAGE_FILE="moli-code-${PACKAGE_VERSION}.tgz"

# Build and bundle the project
echo "Running build and bundle..."
npm run build
npm run bundle

# Backup original package.json
cp package.json package.json.backup

# Replace with offline package.json (no lifecycle scripts)
cp package.offline.json package.json

# Pack the tarball
echo "Creating tarball..."
npm pack

# Restore original package.json
mv package.json.backup package.json

echo ""
echo "✅ Offline package created successfully!"
echo "Package: ${PACKAGE_FILE}"
echo ""
echo "To install offline:"
echo "  npm install -g ${PACKAGE_FILE}"
