#!/bin/bash
# 오프라인 개발 환경 준비 스크립트
# 온라인 환경에서 실행하여 오프라인 전달용 아카이브 생성
#
# 사용법:
#   chmod +x scripts/prepare-offline-dev.sh
#   ./scripts/prepare-offline-dev.sh
#
# 오프라인 Windows PC에서:
#   1. 아카이브 압축 해제
#   2. 소스 수정 (packages/cli/src/... 등)
#   3. npm run dev          — 개발 모드 테스트
#   4. npm run pack:offline — 새 패키지 빌드
#   5. npm install -g dobby-moli-code-0.1.0.tgz

set -e

ARCHIVE_NAME="moli-code-offline-dev.tar.gz"

echo "=== Moli Code 오프라인 개발 환경 준비 ==="
echo ""

echo "1. Installing dependencies..."
npm ci

echo ""
echo "2. Creating offline archive..."
tar -czf "$ARCHIVE_NAME" \
  --exclude='.git' \
  --exclude='*.tgz' \
  --exclude="$ARCHIVE_NAME" \
  --exclude='dist/' \
  --exclude='package/' \
  --exclude='coverage/' \
  --exclude='.claude/' \
  .

ARCHIVE_SIZE=$(ls -lh "$ARCHIVE_NAME" | awk '{print $5}')
echo ""
echo "=== 완료 ==="
echo "아카이브: $ARCHIVE_NAME ($ARCHIVE_SIZE)"
echo ""
echo "오프라인 PC로 전달 후:"
echo "  1. 압축 해제: tar -xzf $ARCHIVE_NAME -C moli-code"
echo "  2. cd moli-code"
echo "  3. git init  (generate-git-commit-info.js에 필요)"
echo "  4. npm run dev -- --help  (테스트)"
echo "  5. npm run pack:offline   (패키지 빌드)"
