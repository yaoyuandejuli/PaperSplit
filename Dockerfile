# syntax=docker/dockerfile:1
# ============================================================
# PaperSplit · 多阶段构建（nginx 托管静态产物，推荐）
# 构建阶段用源码生成 dist/，运行阶段用 nginx 提供静态服务。
# 飞牛 NAS / 群晖 / 任意支持 Docker 的环境通用。
# ============================================================

# ---------- 构建阶段：用源码生成 dist/ ----------
# Node 版本必须满足 Vite 7 的 engines 要求（^20.19.0 || >=22.12.0）。
# node:20-alpine 标签会随官方滚动更新，固定到 22-alpine 可长期稳定满足该要求。
FROM node:22-alpine AS build
WORKDIR /app
# 先装依赖，利用层缓存加速重复构建
COPY package.json package-lock.json ./
# --no-audit/--no-fund 跳过与构建无关的联网审计，减少构建时间与失败面。
# --foreground-scripts 让 esbuild 的 postinstall 正常执行并输出到构建日志
# （npm 11+ 默认不自动执行依赖的安装脚本，esbuild 需要它来落地平台二进制）。
RUN npm ci --no-audit --no-fund --foreground-scripts
# 再拷源码并构建（dist/ 在构建阶段重新生成，无需仓库里提交旧产物）
COPY . .
RUN npm run build

# ---------- 运行阶段：nginx 托管静态文件 ----------
FROM nginx:1.27-alpine
# 自定义配置：正确处理 SPA 回退与带哈希资源的长期缓存
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
# 容器内监听 5173（与 docker-compose.yml 的 5173:5173 映射一致）
EXPOSE 5173
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:5173/ >/dev/null 2>&1 || exit 1
CMD ["nginx", "-g", "daemon off;"]
