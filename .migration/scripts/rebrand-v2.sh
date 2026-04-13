#!/bin/bash
# rebrand-v2.sh — qwen-code → moli-code 리브랜딩 (정확한 매핑)
#
# 사용법: bash .migration/scripts/rebrand-v2.sh [dry-run|apply]
#
# v0.14.3에서 패키지 구조:
#   @qwen-code/qwen-code-core  → @dobby/moli-code-core
#   @qwen-code/qwen-code       → @dobby/moli-code
#   @qwen-code/qwen-code-test-utils → @dobby/moli-code-test-utils
#   @qwen-code/qwen-code-sdk   → @dobby/moli-code-sdk
#   @qwen-code/qwen-code-vscode-companion → @dobby/moli-code-vscode-companion
#   @qwen-code/channel-base    → @dobby/moli-code-channel-base
#   @qwen-code/channel-telegram → @dobby/moli-code-channel-telegram
#   @qwen-code/channel-weixin  → @dobby/moli-code-channel-weixin
#   @qwen-code/channel-dingtalk → @dobby/moli-code-channel-dingtalk
#   @qwen-code/webui           → @dobby/moli-code-webui
#   @qwen-code/web-templates   → @dobby/moli-code-web-templates
#   @qwen-code/cli-insight     → @dobby/moli-code-cli-insight
#   qwen-code                  → moli-code  (바이너리명, npm 패키지명)

set -euo pipefail

MODE="${1:-dry-run}"
DRY=""
if [ "$MODE" = "dry-run" ]; then
    DRY="echo [DRY-RUN] "
    echo "🔍 DRY-RUN 모드"
elif [ "$MODE" = "apply" ]; then
    echo "✏️  APPLY 모드"
else
    echo "Usage: $0 [dry-run|apply]"; exit 1
fi

FIND_TS='find . -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.json" -o -name "*.md" -o -name "*.yaml" -o -name "*.yml" -o -name "*.html" -o -name "*.sh"'

# ── 1. npm 패키지명 정확한 매핑 (긴 것부터 치환) ──
PKG_MAP=(
    "@qwen-code/qwen-code-vscode-companion:@dobby/moli-code-vscode-companion"
    "@qwen-code/qwen-code-test-utils:@dobby/moli-code-test-utils"
    "@qwen-code/qwen-code-core:@dobby/moli-code-core"
    "@qwen-code/qwen-code-sdk:@dobby/moli-code-sdk"
    "@qwen-code/qwen-code:@dobby/moli-code"
    "@qwen-code/channel-base:@dobby/moli-code-channel-base"
    "@qwen-code/channel-telegram:@dobby/moli-code-channel-telegram"
    "@qwen-code/channel-weixin:@dobby/moli-code-channel-weixin"
    "@qwen-code/channel-dingtalk:@dobby/moli-code-channel-dingtalk"
    "@qwen-code/web-templates:@dobby/moli-code-web-templates"
    "@qwen-code/cli-insight:@dobby/moli-code-cli-insight"
    "@qwen-code/webui:@dobby/moli-code-webui"
)

for mapping in "${PKG_MAP[@]}"; do
    OLD="${mapping%%:*}"
    NEW="${mapping##*:}"
    echo "  📦 $OLD → $NEW"
    find . ! -path "*/node_modules/*" ! -path "*/.git/*" ! -path "*/.migration/*" \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.json" -o -name "*.md" -o -name "*.yaml" -o -name "*.yml" -o -name "*.html" -o -name "*.sh" -o -name "*.toml" \) -exec sed -i '' "s|${OLD}|${NEW}|g" {} +
done

# ── 2. 바이너리명 / CLI명 ──
echo "  🔧 qwen-code → moli-code (binary)"
find . ! -path "*/node_modules/*" ! -path "*/.git/*" ! -path "*/.migration/*" \( -name "*.ts" -o -name "*.json" -o -name "*.md" -o -name "*.sh" -o -name "*.yaml" \) -exec sed -i '' \
    -e "s|\"qwen-code\"|\"moli-code\"|g" \
    -e "s|'qwen-code'|'moli-code'|g" \
    {} +

# ── 3. 설정 디렉토리: .qwen → .moli ──
# 주의: 변수명 내부의 qwen (qwenDir, qwenClient 등)은 건드리지 않음
# 문자열 리터럴 내의 경로만 치환
echo "  📁 .qwen → .moli (string literals only)"
find packages/ ! -path "*/node_modules/*" \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" \) -exec sed -i '' \
    -e "s|'\/.qwen'|'/.moli'|g" \
    -e "s|\"/.qwen\"|\"/.moli\"|g" \
    -e "s|'\.qwen'|'.moli'|g" \
    -e "s|\"\.qwen\"|\".moli\"|g" \
    -e "s|'\.qwenignore'|'.moliignore'|g" \
    {} +

# 환경변수 QWEN_DIR → MOLI_DIR (대문자만)
find packages/ ! -path "*/node_modules/*" \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
    -e "s|'QWEN_DIR'|'MOLI_DIR'|g" \
    -e "s|process\.env\.QWEN_DIR|process.env.MOLI_DIR|g" \
    {} +

# ── 4. 표시명 ──
echo "  🏷️  Display names"
find . ! -path "*/node_modules/*" ! -path "*/.git/*" ! -path "*/.migration/*" \( -name "*.ts" -o -name "*.json" -o -name "*.md" -o -name "*.html" \) -exec sed -i '' \
    -e "s|Qwen Code|Moli Code|g" \
    -e "s|QwenCode|MoliCode|g" \
    -e "s|qwen-code|moli-code|g" \
    {} +

# ── 5. User-Agent / 식별자 ──
echo "  🌐 User agents & identifiers"
find packages/ ! -path "*/node_modules/*" -exec sed -i '' \
    -e "s|QwenCode/|MoliCode/|g" \
    -e "s|qwen-coder@alibabacloud|moli-coder@molimate|g" \
    -e "s|Qwen-Coder|Moli-Coder|g" \
    -e "s|qwen-coder|moli-coder|g" \
    -e "s|qwen-code@qwen\.ai|moli-code@molimate\.com|g" \
    -e "s|qwen-code@service\.alibabacloud|moli-code@molimate\.com|g" \
    {} +

# ── 6. VS Code extension ID ──
echo "  🧩 VS Code extension"
find packages/vscode-ide-companion/ ! -path "*/node_modules/*" -exec sed -i '' \
    -e "s|qwen-code-|moli-code-|g" \
    -e "s|qwen-code:|moli-code:|g" \
    {} +

# ── 7. Telemetry ──
echo "  📊 Telemetry constants"
find packages/core/src/telemetry/ ! -path "*/node_modules/*" -exec sed -i '' \
    -e "s|qwen-code\.|moli-code.|g" \
    -e "s|qwen-code@|moli-code@|g" \
    {} +

# ── 8. 임시 파일 / 경로 ──
echo "  🗂️  Temp paths"
find packages/ ! -path "*/node_modules/*" -exec sed -i '' \
    -e "s|qwen-code-warnings|moli-code-warnings|g" \
    -e "s|qwen-code-export|moli-code-export|g" \
    -e "s|qwen-code-tool-modify|moli-code-tool-modify|g" \
    -e "s|qwen-code-mcp-client|moli-code-mcp-client|g" \
    -e "s|qwen-code-ide-server|moli-code-ide-server|g" \
    -e "s|qwen-code-oauth|moli-code-oauth|g" \
    -e "s|qwen-code-companion|moli-code-companion|g" \
    -e "s|qwen-code-sandbox|moli-code-sandbox|g" \
    {} +

# ── 9. Sandbox / Docker ──
echo "  🐳 Docker/sandbox"
find packages/cli/ ! -path "*/node_modules/*" -exec sed -i '' \
    -e "s|ghcr\.io/qwenlm/qwen-code|ghcr\.io/dimoteo333/moli-code|g" \
    -e "s|qwen-code-sandbox|moli-code-sandbox|g" \
    -e "s|qwen-code-dev@service|moli-code-dev@molimate|g" \
    {} +

# ── 10. gitService ──
echo "  📝 Git config"
sed -i '' "s|Moli Code|moli-code|" packages/core/src/services/gitService.ts 2>/dev/null || true

# ── 11. config.ts ──
echo "  ⚙️  Config"
find packages/core/src/config/ ! -path "*/node_modules/*" -exec sed -i '' \
    -e "s|qwen-coder@alibabacloud|moli-coder@molimate|g" \
    -e "s|qwen-code@qwen\.ai|moli-code@molimate\.com|g" \
    {} +

# ── 12. Settings paths ──
echo "  📋 System settings paths"
find packages/cli/src/config/ ! -path "*/node_modules/*" -exec sed -i '' \
    -e "s|qwen-code|moli-code|g" \
    {} +

# ── 13. Windows paths ──
echo "  🪟 Windows paths"
find packages/ ! -path "*/node_modules/*" -exec sed -i '' \
    -e "s|ProgramData.*qwen-code|ProgramData\\\\moli-code|g" \
    -e "s|/etc/qwen-code|/etc/moli-code|g" \
    {} +

# ── 14. languageUtils marker ──
echo "  🗣️  Language markers"
find packages/cli/ ! -path "*/node_modules/*" -exec sed -i '' \
    -e "s|qwen-code:llm-output-language|moli-code:llm-output-language|g" \
    {} +

# ── 15. Docs URLs ──
echo "  🔗 Docs URLs"
find packages/ ! -path "*/node_modules/*" -exec sed -i '' \
    -e "s|qwenlm\.github\.io/qwen-code-docs|molimate\.github\.io/moli-code-docs|g" \
    -e "s|github\.com/QwenLM/qwen-code-action|github\.com/dimoteo333/moli-code-action|g" \
    -e "s|github\.com/QwenLM/qwen-code|github\.com/dimoteo333/moli-code|g" \
    {} +

# ── 16. Auth: QWEN_OAUTH → MOLI_OAUTH ──
# 주의: qwenOauthClient 등 변수명은 건드리지 않음
# 문자열 리터럴, enum 값, CSS 클래스만 치환
echo "  🔐 Auth type (string/enum only)"
find packages/ ! -path "*/node_modules/*" \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
    -e "s|'QWEN_OAUTH'|'MOLI_OAUTH'|g" \
    -e "s|\"QWEN_OAUTH\"|\"MOLI_OAUTH\"|g" \
    -e "s|AuthType\.QWEN_OAUTH|AuthType.MOLI_OAUTH|g" \
    -e "s|'qwen-oauth'|'moli-oauth'|g" \
    -e "s|\"qwen-oauth\"|\"moli-oauth\"|g" \
    {} +

# ── 17. Salt / internal identifiers ──
echo "  🧂 Salt/internal"
find packages/ ! -path "*/node_modules/*" -exec sed -i '' \
    -e "s|qwen-code-cli|moli-code-cli|g" \
    -e "s|hostname.*qwen-code|hostname-moli-code|g" \
    {} +

echo ""
echo "✅ 리브랜딩 완료 ($MODE 모드)"
