# PaperSplit · Docker 部署说明

两种等价部署方式，均为「从源码构建 → 容器内运行」，无需在宿主机安装 Node。

| 文件 | 运行时 | 端口映射 | 说明 |
|---|---|---|---|
| `docker-compose.yml`（根目录） | nginx | **5173 → 5173** | **推荐**。体积小、并发强、gzip 压缩好 |
| `docker-compose.node.yml`（根目录） | Node 内置服务器 | **5173 → 5173** | 依赖链更短，不引入 nginx |

---

## 一、最快：一键本地部署

在**仓库根目录**执行：

```bash
docker compose up -d --build
```

访问 **http://localhost:5173/**（局域网内其他设备用 `http://<本机IP>:5173/`）

`docker compose` 会自动发现根目录的 `docker-compose.yml`，不需要 `-f` 参数。

### 常用运维命令

```bash
docker compose ps              # 查看状态与健康检查（healthy / unhealthy）
docker compose logs -f         # 实时日志
docker compose down            # 停止并移除容器（保留镜像）
docker compose up -d --build   # 重新构建并替换为最新代码
```

---

## 二、Node 版（不依赖 nginx）

```bash
docker compose -f docker-compose.node.yml up -d --build
```

功能与 nginx 版完全一致，只是运行阶段改用项目自带的零依赖服务器
`scripts/serve.js`，依赖链更短。

---

## 三、自定义端口

无需改动 compose 文件 —— 在仓库根目录建一个 `.env`：

```bash
cp .env.example .env
# 把 PORT 改成你要的端口，例如 9090
```

```bash
docker compose up -d
```

访问 **http://localhost:9090/**

---

## 四、直接运行镜像（不构建）

```bash
# 从源码构建的本地镜像
docker run -d --name papersplit -p 5173:5173 --restart unless-stopped papersplit:latest

# 或拉取 GHCR 上已发布的镜像（需联网）
docker run -d --name papersplit -p 5173:5173 --restart unless-stopped \
  ghcr.io/yaoyuandejuli/papersplit:latest
```

---

## 五、飞牛 NAS / 群晖图形界面部署

1. 把仓库克隆到 `/vol1/docker/papersplit`（群晖为 `/volume1/docker/papersplit`）
2. 打开「Docker → 项目 / Compose → 新增」
3. 指向**根目录**的 `docker-compose.yml`，选择「构建并启动」
4. 完成后访问 `http://<NAS的IP>:5173`

> 根目录的 compose 文件已把 `build.context` 设为 `.`（即仓库根），
> 因此无论从哪个目录指定 `-f`，构建上下文都是正确的。

---

## 六、注意事项

### 端口占用
默认占用宿主机 **5173**。若已被占用（如本地跑了 `npm run dev`），改根目录 `.env` 里的 `PORT`。

### 镜像会重新构建前端
Dockerfile 的构建阶段用 `src/` 重新生成 `dist/`，所以**镜像里始终是最新代码**，
仓库中提交的 `dist/` 不会被使用（`.dockerignore` 已将其排除）。

### 数据与隐私
本项目 100% 在浏览器端处理文件，**容器内不会存放、也不会上传任何试卷**。
容器只是一个静态文件服务器，没有数据库、没有上传目录。

### 健康检查
两个 compose 文件都内置了 healthcheck（`wget` 探测首页 5173 端口），
`docker ps` 中会显示 `(healthy)` / `(unhealthy)`。

### 资源占用
已限制为 1 核 / 256MB。纯静态服务通常占用远低于此。

---

## 七、文件清单

```
docker-compose.yml           ← 根目录，nginx 版 compose（推荐）
docker-compose.node.yml      ← 根目录，Node 版 compose
.env.example                 ← 根目录，端口等环境变量示例
Dockerfile                   nginx 版多阶段构建
Dockerfile.node              Node 版多阶段构建
.dockerignore                构建上下文排除规则
.gitattributes               强制 Docker 相关文件使用 LF 行尾（关键！）
deploy/
  nginx.conf                 nginx 站点配置（含 gzip / 缓存策略）
.github/workflows/
  publish-docker.yml         自动构建并推送到 GHCR（amd64 + arm64）
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
