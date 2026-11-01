# syntax=docker/dockerfile:1
# ============================================================
# PaperSplit · 多阶段构建（nginx 托管静态产物，推荐）
# 构建阶段用源码生成 dist/，运行阶段用 nginx 提供静态服务。
# 飞牛 NAS / 群晖 / 任意支持 Docker 的环境通用。
# ============================================================

# ---------- 构建阶段：用源码生成 dist/ ----------
FROM node:20-alpine AS build
WORKDIR /app
# 先装依赖，利用层缓存加速重复构建
COPY package.json package-lock.json ./
RUN npm ci
# 再拷源码并构建（dist/ 在构建阶段重新生成，无需仓库里提交旧产物）
COPY . .
RUN npm run build

# ---------- 运行阶段：nginx 托管静态文件 ----------
FROM nginx:1.27-alpine
# 自定义配置：正确处理 SPA 回退与带哈希资源的长期缓存
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget -qO- http://localhost/ >/dev/null 2>&1 || exit 1
CMD ["nginx", "-g", "daemon off;"]
