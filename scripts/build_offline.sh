#!/bin/bash
# Build offline install package for moli-code
# This creates a tarball that can be installed without network access

set -e

echo "Building moli-code offline package..."

# Build and bundle the project
echo "Running build and bundle..."
npm run build

# Build channel packages (required by CLI)
for ch in base telegram weixin dingtalk; do
  echo "Building channels/$ch..."
  npx tsc --build packages/channels/$ch
  echo "  Copying to CLI node_modules..."
  rm -rf packages/cli/node_modules/@dobby/moli-code-channel-$ch
  mkdir -p packages/cli/node_modules/@dobby
  cp -r packages/channels/$ch packages/cli/node_modules/@dobby/moli-code-channel-$ch
  rm -rf packages/cli/node_modules/@dobby/moli-code-channel-$ch/src
  rm -rf packages/cli/node_modules/@dobby/moli-code-channel-$ch/node_modules
  rm -f packages/cli/node_modules/@dobby/moli-code-channel-$ch/tsconfig.tsbuildinfo
done

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
echo "Package: moli-code-0.3.0.tgz"
echo ""
echo "To install offline:"
echo "  npm install -g moli-code-0.3.0.tgz"
