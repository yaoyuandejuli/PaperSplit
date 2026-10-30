#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# 一键把 docs/ 发布到 GitHub Pages（gh-pages 分支）
#
# 用法（仓库根目录）：
#   npm run build                  # 生成 dist/
#   rm -rf docs && cp -r dist docs # 同步构建产物到 docs/
#   npm run publish:pages          # 发布到线上
#
# 站点配置：Pages = legacy 构建 + gh-pages 分支根目录，
# 因此本脚本把 docs/ 的内容原样推到 gh-pages 分支即完成发布。
# ---------------------------------------------------------------------------
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REMOTE="${PAPER_SPLIT_REMOTE:-https://github.com/yaoyuandejuli/PaperSplit.git}"
BRANCH="gh-pages"
SITE_URL="https://yaoyuandejuli.github.io/PaperSplit/"

# --- 前置检查 ---------------------------------------------------------------
command -v git >/dev/null 2>&1 || { echo "❌ 未找到 git，请先安装"; exit 1; }

if [ ! -d "$ROOT/docs" ]; then
    echo "❌ 未找到 docs/ 目录"
    echo "   请先执行：npm run build && rm -rf docs && cp -r dist docs"
    exit 1
fi

if [ ! -f "$ROOT/docs/index.html" ]; then
    echo "❌ docs/index.html 不存在，docs/ 可能是空的"
    exit 1
fi

# --- 提示 docs/ 与 dist/ 是否同步（避免发布过期内容）------------------------
if [ -d "$ROOT/dist" ] && [ -f "$ROOT/dist/index.html" ]; then
    if ! diff -q "$ROOT/dist/index.html" "$ROOT/docs/index.html" >/dev/null 2>&1; then
        echo "⚠️  docs/index.html 与 dist/index.html 不一致"
        echo "   可能发布了过期内容，建议先执行：rm -rf docs && cp -r dist docs"
    fi
fi

# --- 准备发布内容 -----------------------------------------------------------
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

cp -r "$ROOT/docs/." "$TMP/"
touch "$TMP/.nojekyll"   # 跳过 Jekyll 处理，保证 assets 原样发布

cd "$TMP"
git init -q
git checkout -q -b "$BRANCH"
git config user.name "$(git -C "$ROOT" config user.name || echo yaoyuandejuli)"
git config user.email "$(git -C "$ROOT" config user.email || echo yaoyuandejuli@users.noreply.github.com)"
git add -A
git commit -q -m "chore: publish docs to $BRANCH ($(date '+%Y-%m-%d %H:%M'))"

# --- 发布 -------------------------------------------------------------------
git push --force "$REMOTE" "$BRANCH:$BRANCH"

echo ""
echo "✅ 已推送到 $BRANCH 分支"
echo "🌐 站点地址：$SITE_URL"
echo "⏳ GitHub Pages 通常 1-2 分钟完成部署，稍后刷新即可看到新版本"
