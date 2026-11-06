# syntax=docker/dockerfile:1
# ============================================================
# PaperSplit · 独立部署包（单阶段，零构建）
# ------------------------------------------------------------
# 与仓库根目录的多阶段 Dockerfile 的区别：
#   根目录版本  = 容器内 npm ci + vite build，需要联网拉依赖
#   本版本     = 直接托管已经构建好的 html/ 产物，
#                构建时不联网、不需要 Node、不需要 npm，
#                几秒就能构建完成，离线环境也能用。
#
# 用法：
#   docker compose up -d --build
#   访问 http://localhost:5173/
#
# 需要更新页面内容时：把新的 dist/ 内容覆盖到 html/ 目录后重新 build。
# ============================================================

FROM nginx:1.27-alpine

# 站点配置：SPA 回退、gzip 压缩、带哈希资源长缓存
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 已构建好的静态产物（由 Vite 打包，含 pdf.js worker 内联）
COPY html/ /usr/share/nginx/html

EXPOSE 5173

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:5173/ >/dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]
