#!/bin/bash
# Build offline VSIX extension package for moli-code
# This creates a .vsix that includes the bundled CLI + vendor + production deps
# so the extension works fully offline after `code --install-extension`.
#
# Usage:
#   bash scripts/build_vsix.sh              # Build for current platform
#   bash scripts/build_vsix.sh --prune-rg   # Prune ripgrep for non-current platforms
#
# Prerequisites:
#   - Node.js >= 20
#   - npx (for vsce)
#   - Root npm install already done

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
EXT_DIR="$ROOT_DIR/packages/vscode-ide-companion"
BUNDLED_CLI_DIR="$EXT_DIR/dist/qwen-cli"

PRUNE_RG=false
if [ "${1:-}" = "--prune-rg" ]; then
  PRUNE_RG=true
fi

echo "╔══════════════════════════════════════════════╗"
echo "║   moli-code VSIX Offline Builder             ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# ── Step 1: Build all workspaces ──
echo "📦 [1/7] Building all workspaces..."
cd "$ROOT_DIR"
npm run build

# ── Step 2: Bundle CLI (esbuild + copy assets) ──
echo "📦 [2/7] Bundling CLI..."
npm run bundle

# ── Step 3: Prepare dist/ package metadata ──
echo "📋 [3/7] Preparing dist/ package metadata..."
node "$ROOT_DIR/scripts/prepare-package.js"

# ── Step 4: Build VSCode extension (production) ──
echo "🔨 [4/7] Building VSCode extension (production)..."
cd "$EXT_DIR"
npm run build:prod

# Remove dev artifacts from dist/
rm -f dist/extension.cjs dist/extension.cjs.map dist/webview.js.map

# ── Step 5: Copy bundled CLI into extension ──
echo "📂 [5/7] Copying bundled CLI into extension..."
node "$EXT_DIR/scripts/copy-bundled-cli.js"

# ── Step 6: Install production deps (offline runtime) ──
echo "📥 [6/7] Installing production deps into bundled CLI..."
npm install --prefix "$BUNDLED_CLI_DIR" --omit=dev --no-audit --no-fund \
  --workspaces=false --include-workspace-root=false

# Optionally prune ripgrep for non-current platforms
if [ "$PRUNE_RG" = true ]; then
  echo "✂️  Pruning ripgrep for non-current platforms..."
  RG_DIR="$BUNDLED_CLI_DIR/vendor/ripgrep"
  CURRENT_PLATFORM="$(node -e "
    const p = process.platform;
    const a = process.arch;
    console.log(a + '-' + p);
  ")"
  if [ -d "$RG_DIR" ]; then
    for dir in "$RG_DIR"/*/; do
      dirname=$(basename "$dir")
      if [ "$dirname" != "$CURRENT_PLATFORM" ]; then
        echo "  Removing: $dirname"
        rm -rf "$dir"
      fi
    done
  fi
fi

# ── Step 7: Package VSIX ──
echo "📦 [7/7] Packaging VSIX..."
cd "$EXT_DIR"

# vsce package
npx vsce package --no-dependencies

# Move VSIX to root
VSIX_FILE=$(ls -t moli-code-vscode-ide-companion-*.vsix 2>/dev/null | head -1)
if [ -n "$VSIX_FILE" ]; then
  mv "$VSIX_FILE" "$ROOT_DIR/$VSIX_FILE"
  VSIX_SIZE=$(du -h "$ROOT_DIR/$VSIX_FILE" | cut -f1)
  echo ""
  echo "✅ VSIX created successfully!"
  echo "   File: $VSIX_FILE"
  echo "   Size: $VSIX_SIZE"
  echo ""
  echo "To install:"
  echo "  code --install-extension $VSIX_FILE"
else
  echo "❌ VSIX creation failed"
  exit 1
fi
