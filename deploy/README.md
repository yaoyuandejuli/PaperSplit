# PaperSplit · Docker 部署说明

本目录提供两种等价部署方式，均为「从源码构建 → 容器内运行」，无需在宿主机安装 Node。

| 文件 | 运行时 | 对外端口 | 说明 |
|---|---|---|---|
| `docker-compose.yml` | nginx | 8080 → 80 | **推荐**。体积小、并发强、gzip 压缩好 |
| `docker-compose.node.yml` | Node 内置服务器 | 8080 → 8080 | 依赖链更短，不引入 nginx |

---

## 一、最快的方式：一条命令

```bash
docker run -d --name papersplit -p 8080:80 --restart unless-stopped \
  ghcr.io/yaoyuandejuli/papersplit:latest
```

访问 **http://<服务器IP>:8080**

> 该镜像由 `.github/workflows/publish-docker.yml` 在每次 push 到 `master` 时自动构建并推送，
> 同时提供 `linux/amd64` 与 `linux/arm64` 两个架构（飞牛 NAS / 群晖常见为 ARM64）。

---

## 二、从本地源码构建（compose 方式）

把仓库克隆到目标机器后：

```bash
cd PaperSplit

# nginx 版（推荐）
docker compose -f deploy/docker-compose.yml up -d --build

# 或 Node 版
docker compose -f deploy/docker-compose.node.yml up -d --build
```

访问 **http://<服务器IP>:8080**

### 常用运维命令

```bash
# 查看状态与健康状况
docker compose -f deploy/docker-compose.yml ps

# 实时日志
docker compose -f deploy/docker-compose.yml logs -f

# 停止并移除容器（不会删除镜像）
docker compose -f deploy/docker-compose.yml down

# 重新构建并替换为最新代码
docker compose -f deploy/docker-compose.yml up -d --build
```

---

## 三、自定义端口

无需改动 compose 文件 —— 在 `deploy/` 下建一个 `.env`：

```bash
cd deploy
cp .env.example .env
# 把 PORT 改成你要的端口，例如 9090
```

```bash
docker compose -f deploy/docker-compose.yml up -d
```

访问 **http://<服务器IP>:9090**

---

## 四、飞牛 NAS / 群晖图形界面部署

1. 通过 SSH 或文件管理器，把仓库放到 `/vol1/docker/papersplit`（群晖为 `/volume1/docker/papersplit`）
2. 打开「Docker → 项目 / Compose → 新增」
3. 指向 `deploy/docker-compose.yml`，选择「构建并启动」
4. 完成后访问 `http://<NAS的IP>:8080`

---

## 五、注意事项

### 端口占用
默认占用宿主机 **8080**。若已被占用，改 `deploy/.env` 里的 `PORT` 即可。

### 镜像会重新构建前端
Dockerfile 的构建阶段用 `src/` 重新生成 `dist/`，所以**镜像里始终是最新代码**，
仓库中提交的 `dist/` 不会被使用（`.dockerignore` 已将其排除）。

### 数据与隐私
本项目 100% 在浏览器端处理文件，**容器内不会存放、也不会上传任何试卷**。
容器只是一个静态文件服务器，没有数据库、没有上传目录。

### 健康检查
两个 compose 文件都内置了 healthcheck（`wget` 探测首页），
`docker ps` 中会显示 `(healthy)` / `(unhealthy)`，可用于确认服务是否正常。

### 资源占用
已限制为 1 核 / 256MB。纯静态服务通常占用远低于此。
如需调整，改 compose 文件里的 `deploy.resources.limits`。

---

## 六、文件清单

```
Dockerfile                     nginx 版多阶段构建
Dockerfile.node                Node 版多阶段构建
.dockerignore                  构建上下文排除规则
.gitattributes                 强制 Docker 相关文件使用 LF 行尾（关键！）
deploy/
  docker-compose.yml           nginx 版 compose
  docker-compose.node.yml      Node 版 compose
  nginx.conf                   nginx 站点配置（含 gzip / 缓存策略）
  .env.example                 端口等环境变量示例
.github/workflows/
  publish-docker.yml           自动构建并推送到 GHCR（amd64 + arm64）
```

### 为什么需要 .gitattributes

Dockerfile 的续行符（行尾 `\`）与 YAML 的块结构都要求 **LF 行尾**。
若在 Windows 上 checkout 成 CRLF，`docker build` 可能报
`unknown instruction: ...` 或 YAML 解析异常。
`.gitattributes` 中已强制这些文件在所有平台保持 LF。

若历史提交中已是 CRLF，执行一次：

```bash
git add --renormalize .
git commit -m "chore: normalize line endings to LF"
```
