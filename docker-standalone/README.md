# PaperSplit · 独立 Docker 部署包

一个**自包含**的部署包：只需要 Docker，**不需要 Node / npm**，构建过程**不联网**。

整个目录可以直接拷贝到任何一台装了 Docker 的机器（NAS、服务器、Linux、Win11）上部署。

---

## 一、目录内容

```
docker-standalone/
├── Dockerfile            单阶段构建：nginx 托管静态产物（无需 npm 构建）
├── docker-compose.yml    一键部署配置（端口 5173:5173）
├── nginx.conf            站点配置：SPA 回退 + gzip + 缓存策略
├── .env.example          端口配置示例
├── .dockerignore         构建上下文排除规则
├── README.md             本文件
└── html/                 已构建好的静态产物（直接放进去即可）
    ├── index.html
    ├── favicon.png
    └── assets/           JS / CSS / 字体 / pdf.js worker
```

---

## 二、部署（30 秒）

把整个 `docker-standalone` 目录拷到目标机器，然后：

```bash
cd docker-standalone
docker compose up -d --build
```

打开 **http://localhost:5173/**

局域网内其他设备访问 **http://<本机IP>:5173/**

---

## 三、常用运维命令

```bash
docker compose ps              # 查看状态与健康检查（healthy / unhealthy）
docker compose logs -f         # 实时日志
docker compose down            # 停止并移除容器（保留镜像）
docker compose restart         # 重启
docker compose up -d --build   # 内容更新后重新构建并替换
```

---

## 四、更换端口

无需改动 compose 文件：

```bash
cp .env.example .env
# 把 PORT 改成你要的端口，例如 9090
docker compose up -d
```

然后访问 `http://localhost:9090/`。

---

## 五、更新页面内容

`html/` 目录里放的就是最终网页文件。要更新：

1. 把新的构建产物覆盖到 `html/` 目录
   （从源码仓库构建：`cd PaperSplit && npm ci && npm run build`，然后把 `dist/` 里的内容复制到本包的 `html/`）
2. 重新构建并启动：

```bash
docker compose up -d --build
```

> 注意：`html/index.html` 与 `html/assets/` 必须来自**同一次构建**，
> 因为 index.html 里引用的是带内容哈希的文件名（如 `index-BBfXsZSL.js`）。
> 混用会导致页面白屏或资源 404。

---

## 六、不用 compose 也可以

```bash
# 构建
docker build -t papersplit-standalone:latest .

# 运行
docker run -d --name papersplit -p 5173:5173 --restart unless-stopped \
  papersplit-standalone:latest
```

---

## 七、飞牛 NAS / 群晖图形界面部署

1. 把 `docker-standalone` 整个目录上传到 `/vol1/docker/papersplit`
   （群晖为 `/volume1/docker/papersplit`）
2. 打开「Docker → 项目 / Compose → 新增」
3. 指向该目录下的 `docker-compose.yml`，选择「构建并启动」
4. 完成后访问 `http://<NAS的IP>:5173`

---

## 八、说明与注意事项

### 不需要联网构建
本包用的是**单阶段 Dockerfile**，直接托管 `html/` 里已构建好的产物，
不像多阶段版本那样需要在容器里执行 `npm ci` 和 `vite build`。
所以断网环境也能正常构建与启动。

### 纯静态服务，无数据存储
PaperSplit 是纯浏览器端应用（PDF 解析、裁剪、导出全部在本地完成）。
容器只是一个静态文件服务器：**不存放、不上传任何试卷文件**，没有数据库。

### 健康检查
内置 healthcheck（`wget` 探测首页 5173 端口），
`docker ps` 会显示 `(healthy)` / `(unhealthy)`。

### 资源占用
限制为 1 核 / 256MB。纯静态服务实际占用远低于此。

### 端口占用
默认占用 **5173**。若被占用（比如本机跑了 `npm run dev`），
改 `.env` 里的 `PORT` 即可。

### 行尾必须是 LF
Dockerfile 的续行符与 YAML 块结构都要求 LF 行尾。
本包内文件已统一为 LF；如果你在 Windows 上编辑过并保存成 CRLF，
构建可能报 `unknown instruction`。用编辑器把行尾改回 LF 即可。
