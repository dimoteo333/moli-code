#!/bin/bash
# rebrand.sh — qwen-code → moli-code 리브랜딩 자동화
# 
# 사용법: bash .migration/scripts/rebrand.sh [dry-run|apply]
#   dry-run: 변경사항만 출력
#   apply: 실제 적용
#
# 확장성: 향후 버전 업그레이드 시, 클린 업스트림 소스에 이 스크립트만 실행하면 리브랜딩 완료

set -euo pipefail

MODE="${1:-dry-run}"
DRY=""

if [ "$MODE" = "dry-run" ]; then
    DRY="echo [DRY-RUN] "
    echo "🔍 DRY-RUN 모드 — 변경사항만 표시"
elif [ "$MODE" = "apply" ]; then
    echo "✏️  APPLY 모드 — 실제 적용"
else
    echo "Usage: $0 [dry-run|apply]"
    exit 1
fi

# ── 리브랜딩 매핑 ──
# 향후 브랜드 변경 시 이 매핑만 수정하면 됨

# Package names
$DRY find . -name "package.json" ! -path "*/node_modules/*" -exec sed -i '' \
    -e 's/"@anthropic-ai\/qwen-code/"@dobby\/moli-code/g' \
    -e 's/"qwen-code"/"moli-code"/g' \
    -e 's/"@qwen-code\/qwen-code-core"/"@dobby\/moli-code-core"/g' \
    -e 's/"@qwen-code\/qwen-code"/"@dobby\/moli-code"/g' \
    -e 's/"@qwen-code\/qwen-code-test-utils"/"@dobby\/moli-code-test-utils"/g' \
    -e 's/"@qwen-code\/qwen-code-sdk"/"@dobby\/moli-code-sdk"/g' \
    -e 's/"@qwen-code\/qwen-code-vscode-companion"/"@dobby\/moli-code-vscode-companion"/g' \
    {} +

# Binary/command names
$DRY find . -name "package.json" ! -path "*/node_modules/*" -exec sed -i '' \
    -e 's/"qwen-code":/"moli-code":/g' \
    -e 's/"qwen":/"moli":/g' \
    {} +

# Config directory: .qwen → .moli
$DRY find packages/ -name "*.ts" ! -path "*/node_modules/*" -exec sed -i '' \
    -e "s/\.qwen/.moli/g" \
    -e "s/QWEN_DIR/MOLI_DIR/g" \
    -e "s/qwen_dir/moli_dir/g" \
    {} +

# Display names
$DRY find packages/ -name "*.ts" ! -path "*/node_modules/*" -exec sed -i '' \
    -e "s/Qwen Code/Moli Code/g" \
    -e "s/QwenCode/MoliCode/g" \
    -e "s/qwen code/moli code/g" \
    {} +

# User agent strings
$DRY find packages/ -name "*.ts" ! -path "*/node_modules/*" -exec sed -i '' \
    -e "s/QwenCode\//MoliCode\//g" \
    {} +

# VS Code extension name
$DRY find packages/vscode-ide-companion/ -name "package.json" ! -path "*/node_modules/*" -exec sed -i '' \
    -e "s/Qwen Code Companion/Moli Code Companion/g" \
    -e "s/qwen-code-companion/moli-code-companion/g" \
    {} +

# Import paths in TypeScript
$DRY find packages/ -name "*.ts" ! -path "*/node_modules/*" -exec sed -i '' \
    -e "s/@qwen-code\//@dobby\/moli-code-/g" \
    {} +

# README/docs
$DRY find . -name "README.md" ! -path "*/node_modules/*" -exec sed -i '' \
    -e "s/Qwen Code/Moli Code/g" \
    -e "s/qwen-code/moli-code/g" \
    -e "s/qwen code/moli code/g" \
    {} +

echo ""
echo "✅ 리브랜딩 완료 ($MODE 모드)"
echo "⚠️  수동 확인 필요:"
echo "   1. AuthType enum — MOLI_OAUTH 추가 여부"
echo "   2. 환경변수 — QWEN_* → MOLI_* 변환"
echo "   3. API 엔드포인트 — qwen.ai 관련 URL"
echo "   4. 라이선스/저작권 표기"
