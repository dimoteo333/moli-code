#!/bin/bash
# Build Node.js SEA (Single Executable Application) for moli-code
#
# Usage:
#   ./scripts/build_sea.sh              # Build for current platform (macOS/Linux)
#   ./scripts/build_sea.sh --windows    # Cross-build Windows exe (downloads node.exe)
#
# Requirements:
#   - Official Node.js binary (Homebrew node lacks SEA fuse)
#   - For macOS: codesign (Xcode CLI tools)
#
# Output:
#   dist-sea/moli-code        (macOS/Linux binary)
#   dist-sea/moli-code.exe    (Windows exe)
#   dist-sea/assets/          (required runtime assets: ripgrep, locales, etc.)

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

TARGET_WINDOWS=false
NODE_DL_VERSION="$(node -v)"

if [ "$1" = "--windows" ]; then
  TARGET_WINDOWS=true
fi

echo "=== moli-code SEA Build ==="
echo "Node.js: $NODE_DL_VERSION"
echo "Target: $([ "$TARGET_WINDOWS" = true ] && echo 'Windows x64' || echo 'Current platform')"
echo ""

# Step 1: Build the project
echo "[1/6] Building project..."
npm run build

# Step 2: Create CJS bundle for SEA
echo "[2/6] Creating CJS bundle for SEA..."
node esbuild.sea.config.js

# Step 3: Copy runtime assets
echo "[3/6] Copying runtime assets..."
ASSETS_DIR="dist-sea/assets"
rm -rf "$ASSETS_DIR"
mkdir -p "$ASSETS_DIR"

# Build dist/ assets first
node scripts/copy_bundle_assets.js

# Copy from dist/ to dist-sea/assets/
[ -d "dist/vendor" ] && cp -R dist/vendor "$ASSETS_DIR/"
[ -d "dist/locales" ] && cp -R dist/locales "$ASSETS_DIR/"
[ -d "dist/bundled" ] && cp -R dist/bundled "$ASSETS_DIR/"
[ -f "dist/molimate.config.json" ] && cp dist/molimate.config.json "$ASSETS_DIR/"
for f in dist/*.sb; do
  [ -f "$f" ] && cp "$f" "$ASSETS_DIR/" 2>/dev/null || true
done

echo "   Assets copied to $ASSETS_DIR"

# Step 4: Generate SEA blob
echo "[4/6] Generating SEA blob..."
node --experimental-sea-config sea-config.json

# Helper: download official Node.js binary (Homebrew builds lack SEA fuse)
download_node_binary() {
  local platform="$1"  # darwin-arm64, darwin-x64, linux-x64, win-x64
  local cache_dir="dist-sea/.node-cache"
  mkdir -p "$cache_dir"

  if [ "$platform" = "win-x64" ]; then
    local cached="$cache_dir/node-${NODE_DL_VERSION}-win-x64.exe"
    if [ ! -f "$cached" ]; then
      local url="https://nodejs.org/dist/${NODE_DL_VERSION}/win-x64/node.exe"
      echo "   Downloading $url ..."
      curl -L -o "$cached" "$url"
    else
      echo "   Using cached $cached"
    fi
    echo "$cached"
  else
    local cached="$cache_dir/node-${NODE_DL_VERSION}-${platform}"
    if [ ! -f "$cached" ]; then
      local url="https://nodejs.org/dist/${NODE_DL_VERSION}/node-${NODE_DL_VERSION}-${platform}.tar.gz"
      echo "   Downloading $url ..."
      curl -L -o "${cached}.tar.gz" "$url"
      tar xzf "${cached}.tar.gz" -C "$cache_dir" "node-${NODE_DL_VERSION}-${platform}/bin/node"
      mv "$cache_dir/node-${NODE_DL_VERSION}-${platform}/bin/node" "$cached"
      rm -rf "$cache_dir/node-${NODE_DL_VERSION}-${platform}" "${cached}.tar.gz"
    else
      echo "   Using cached $cached"
    fi
    echo "$cached"
  fi
}

# Step 5 & 6: Build the executable
if [ "$TARGET_WINDOWS" = true ]; then
  echo "[5/6] Preparing Windows Node.js binary..."
  NODE_BIN=$(download_node_binary "win-x64")
  DEST_EXE="dist-sea/moli-code.exe"
  cp "$NODE_BIN" "$DEST_EXE"

  echo "[6/6] Injecting SEA blob into Windows exe..."
  npx --yes postject "$DEST_EXE" NODE_SEA_BLOB dist-sea/sea-prep.blob \
    --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 \
    --overwrite

  EXE_SIZE=$(du -h "$DEST_EXE" | cut -f1)
  echo ""
  echo "=== Build Complete ==="
  echo "Executable: $DEST_EXE ($EXE_SIZE)"
  echo "Assets:     $ASSETS_DIR/"
  echo ""
  echo "To run on Windows, copy both 'moli-code.exe' and 'assets/' folder"
  echo "to the same directory, then run:"
  echo "  moli-code.exe"

else
  # Detect current platform
  ARCH=$(uname -m)
  OS=$(uname -s | tr '[:upper:]' '[:lower:]')
  case "$ARCH" in
    arm64|aarch64) PLATFORM="${OS}-arm64" ;;
    x86_64)        PLATFORM="${OS}-x64" ;;
    *)             echo "Unsupported architecture: $ARCH"; exit 1 ;;
  esac

  echo "[5/6] Preparing Node.js binary ($PLATFORM)..."
  NODE_BIN=$(download_node_binary "$PLATFORM")
  DEST_BIN="dist-sea/moli-code"
  cp "$NODE_BIN" "$DEST_BIN"
  chmod u+w "$DEST_BIN"

  # Remove code signature on macOS (required before postject)
  if [ "$(uname)" = "Darwin" ]; then
    codesign --remove-signature "$DEST_BIN" 2>/dev/null || true
  fi

  echo "[6/6] Injecting SEA blob..."
  npx --yes postject "$DEST_BIN" NODE_SEA_BLOB dist-sea/sea-prep.blob \
    --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 \
    --overwrite \
    $([ "$(uname)" = "Darwin" ] && echo "--macho-segment-name NODE_SEA")

  # Re-sign on macOS
  if [ "$(uname)" = "Darwin" ]; then
    codesign --sign - "$DEST_BIN" 2>/dev/null || true
  fi

  chmod +x "$DEST_BIN"

  BIN_SIZE=$(du -h "$DEST_BIN" | cut -f1)
  echo ""
  echo "=== Build Complete ==="
  echo "Executable: $DEST_BIN ($BIN_SIZE)"
  echo "Assets:     $ASSETS_DIR/"
  echo ""
  echo "To run:"
  echo "  ./dist-sea/moli-code"
fi
