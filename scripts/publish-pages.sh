#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# 一键把 docs/ 发布到 GitHub Pages（gh-pages 分支）
#
# 用法：
#   1) 先在仓库根目录执行 npm run build（生成 dist/），再同步 docs/：
#        rm -rf docs && cp -r dist docs
#   2) 执行本脚本：
#        bash scripts/publish-pages.sh
#
# 说明：仓库的 Pages 站点配置为 legacy 模式 + gh-pages 分支根目录，
# 因此本脚本把已提交的 docs/ 内容原样推到 gh-pages 分支即可完成发布。
# 若将来启用了 Actions 工作流（deploy/pages-workflow.yml），可改用自动发布。
# ---------------------------------------------------------------------------
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REMOTE="${PAPER_SPLIT_REMOTE:-https://github.com/yaoyuandejuli/PaperSplit.git}"
BRANCH="gh-pages"

if [ ! -d "$ROOT/docs" ]; then
    echo "❌ 未找到 docs/ 目录。请先执行：npm run build && rm -rf docs && cp -r dist docs"
    exit 1
fi

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
git push --force "$REMOTE" "$BRANCH:$BRANCH"

echo "✅ 已发布到 https://yaoyuandejuli.github.io/PaperSplit/ （通常 1-2 分钟生效）"
