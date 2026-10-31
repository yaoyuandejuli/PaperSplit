<a id="chinese"></a>

<div align="center">

  <img src="public/favicon.png" alt="PaperSplit" width="104" height="104">

  <h1>PaperSplit</h1>

  <p>
    <a href="https://yaoyuandejuli.github.io/PaperSplit/">
      <img alt="在线体验 Live Demo" src="https://img.shields.io/badge/%E5%9C%A8%E7%BA%BF%E4%BD%93%E9%AA%8C%20%7C%20Live%20Demo-6366f1?style=for-the-badge&logo=github&logoColor=white">
    </a>
    <img alt="MIT License" src="https://img.shields.io/badge/License-MIT-10b981?style=for-the-badge">
    <img alt="Build with Vite" src="https://img.shields.io/badge/build-Vite-646cff?style=for-the-badge&logo=vite&logoColor=white">
    <br>
    <img alt="纯前端 No Backend" src="https://img.shields.io/badge/%E7%BA%AF%E5%89%8D%E7%AB%AF%20%7C%20No%20Backend-0ea5e9?style=for-the-badge">
    <img alt="离线可用 Offline Ready" src="https://img.shields.io/badge/%E7%A6%BB%E7%BA%BF%E5%8F%AF%E7%94%A8%20%7C%20Offline-ready-8b5cf6?style=for-the-badge">
  </p>

  <p><sub><i>A privacy-first A3 to A4 PDF splitter. 100% client-side processing.</i><br>（🚀 在线体验，无需安装，打开即用 &nbsp;·&nbsp; <i>Live demo — no install, runs in your browser</i>）</sub></p>

  <p><a href="#chinese"><b>简体中文</b></a> · <a href="#english"><b>English</b></a></p>

</div>

<p align="center">
  <a href="#quickstart">🚀 先试为快</a> ·
  <a href="#preview">🖼️ 界面预览</a> ·
  <a href="#features">✨ 核心功能</a> ·
  <a href="#dev">🚀 快速开始</a> ·
  <a href="#deploy">🚢 部署</a> ·
  <a href="#faq">❓ 常见问题</a> ·
  <a href="#english">📖 English</a>
</p>

<a id="quickstart"></a>

## 🚀 先试为快：两种零门槛方式

| 方式 | 操作 | 适合谁 |
|---|---|---|
| **① 在线体验**<br>（最推荐） | 点 **[https://yaoyuandejuli.github.io/PaperSplit/](https://yaoyuandejuli.github.io/PaperSplit/)** | 只想用的人，零安装、零配置 |
| **② 本地静态托管** | 下载 ZIP → 进入 **`dist/`** → 起一个静态服务器 | 内网 / 离线环境 |

**方式② 的启动命令**

```bash
# 推荐：项目自带零依赖服务器（Node 内置模块，并发与 MIME 都已处理好）
npm run serve              # 服务 dist/，打开 http://localhost:8080
npm run serve 3000         # 换端口
npm run serve 3000 docs    # 换端口与服务目录

# 备选：其他静态服务器
npx serve dist
npx http-server dist -p 8080
```

> ⚠️ **不建议用 `python -m http.server`**：它是 HTTP/1.0、不支持 keep-alive，浏览器并发拉取资源时连接会被直接断开，表现为样式错乱、按钮没反应或「无法加载 PDF 文件」。它只适合临时看一眼，不能当部署方案。

> ⚠️ **请勿直接双击仓库根目录的 `index.html`**：那是**源码版**页面，`src/` 里使用的是裸模块标识符（`pdfjs-dist` / `jspdf` / `material-icons`），浏览器无法解析。
> 表现是**界面能显示、但所有按钮都没反应**（控制台报模块解析错误）——这不是版本问题，也不是项目坏了。
> 正确做法：用上面**方式①**在线体验，或把 **`dist/`** 交给静态服务器，或 `npm run dev` 跑源码版。详见下方 [常见问题](#faq)。

## 📖 简介

*A privacy-first A3 to A4 PDF splitter. 100% client-side processing.*

> 正在找英文说明？跳转 **[📖 English](#english)**。

**PaperSplit** 是一个纯浏览器端运行的轻量工具，专门把 **A3 试卷 / 文档拆分成 A4**，并顺手去掉装订密封线、擦掉多余标记。文件不上传、不依赖网络，所有处理都在本机完成。

> 站点标语：**试卷本地拆分，一键适配A4打印**（左上角与浏览器标签页标题同步展示）

<a id="preview"></a>

## 🖼️ 界面预览

![PaperSplit 工作界面](screenshots/preview.png)

<a id="features"></a>

## ✨ 核心功能

- **智能导入**：拖拽上传 PDF 或图片（JPG / PNG）。
- **多栏分割**：一页可切成 **N 栏**；「两栏 / 重置 / 三栏」三个按钮并排一行，「增加分割线」「去除分割线」并排一行。
- **方向校正**：「左转 / 重置 / 右转」三个按钮并排一行，再用 ±15° 滑块微调（滑块两侧的「−」「+」可逐 0.5° 增减，抵达 ±15° 时按钮自动禁用），角度实时显示，每页独立生效；滑块下方的「应用当前页 / 应用所有页」可把角度保存到本页或一键复制到所有页面。
- **密封线调整**（独立分区）：密封区域**位置不限** —— 默认奇数页靠左、偶数页靠右（各占 15%）；开启后**直接拖动斜纹区即可整体平移**，拖动两侧虚线可调整范围。画布上用斜纹阴影标出**导出时会被裁掉**的区域。「去除密封线 / 重置」两个按钮并排一行，「重置」可清除本页所有密封区域。
- **左右密封区可并存**：「靠左」「靠右」是可独立开关的按钮 —— 点一次出现、再点一次消失，**左右两侧可以同时存在**（适合双侧装订），宽度沿用另一侧的设置，也可拖动虚线单独调整。
- **密封区与分割线互不限制**：密封区域挖掉后，其余部分再按分割线分栏，两者可同时使用。
- **擦除内容**：框选矩形或涂抹笔刷擦除多余内容，点「应用」后画布直接显示擦除效果，导出 PDF 时真实擦除。
- **裁剪后调整**：某栏太小看不清时，放大 / 缩小 / 重置，「应用当前页」与「应用所有页」并排一行，比例在导出时真实生效；旁边的「修改后文件预览」实时显示成品页效果，多页时自动换行排版、每页尽可能放大，画布高度按内容自适应，不再留多余空白。
- **多文件合并** — 一次选择多个 PDF 与图片，合并成一份连续文档；左栏顶部显示已导入的文件（可移除单个文件、继续追加、点击跳转），下方是页面缩略图
- **导出前排序** — 页面先后的唯一调整入口：导出前逐页拖动微调最终顺序，支持上下按钮与一键恢复默认，跨文件同样适用
- **分区应用**：方向、编辑工具、密封线、裁剪后调整四个分区都提供「应用当前页 / 应用所有页」两个并排按钮 —— 前者确认并保存本页设置，后者一键把设置复制到所有页面（密封线跨奇偶时自动镜像到另一侧，保持书页左右对称）。
- **高清导出**：基于 `jsPDF` 生成标准 **A4（210×297mm）** PDF，可选等比留白 / 拉伸填满 / 等比填满三种排版方式。
- **编辑自动保存**：分割线、密封线、角度、缩放比例与擦除标记自动存在本机浏览器（localStorage），重开同一文件自动恢复，可一键清除。
- **离线可用 & 响应式**：PDF worker、图标与字体全部本地打包，断网 / 内网照常使用；PC 与手机都能操作。**手机端面板重排** —— 顶部是「已导入文件」**横向平铺条**（文件卡片左右滑动即可看全，「＋」继续添加、「×」移除某个文档），下方是页面缩略图；下滑使用右侧调整功能时，**顶部始终吸着一行迷你预览**，实时显示当前页的分割线与密封区，改完一眼就能看到结果；「文件导出」区不再固定在屏幕底部，回到文档流末尾，滚到底才出现。

<a id="dev"></a>

## 🚀 快速开始

```bash
git clone https://github.com/yaoyuandejuli/PaperSplit.git
cd PaperSplit
npm install

npm run dev      # 源码版（热更新），访问终端显示的地址，通常 http://localhost:5173
npm run serve    # 构建版，先 npm run build，再访问 http://localhost:8080
```

> 只想用、不想折腾环境？直接打开[在线版本](https://yaoyuandejuli.github.io/PaperSplit/)即可。

**使用流程**

1. **导入**：点击「选择文件」，或把文件直接拖进工作区。
2. **调整**：拖动红色分割线确定分栏位置；用「两栏 / 三栏」「增加分割线」细分；扫描歪斜就用方向校正；多余内容用「擦除内容」；密封线在「密封线调整」里开启与换边。
3. **应用**：调好一页后，点「应用当前页」保存本页设置，或点「应用所有页」复制到整份文档（密封线跨奇偶会自动镜像）。
4. **导出**：点「文件导出」下载标准 A4 的 PDF。

## 🛠️ 技术栈

原生 JavaScript（ES6 Modules）· `pdfjs-dist`（页面渲染）· `jspdf`（PDF 生成）· CSS3 · Vite

## 📂 项目结构

```
/
├── index.html          # 入口页面
├── style.css           # 全局样式
├── vite.config.js      # 构建配置
├── src/                # 源码
│   ├── main.js         # 入口与事件绑定
│   ├── state.js        # 全局状态
│   ├── dom.js          # DOM 元素引用
│   ├── file-handler.js # 文件载入与 PDF 解析
│   ├── viewer.js       # 画布渲染与翻页
│   ├── editor.js       # 分割线 / 密封线 / 批量应用
│   ├── exporter.js     # PDF 导出
│   ├── export-geometry.js # 切片范围与 A4 排版几何
│   ├── crop-adjust.js  # 裁剪后调整
│   ├── mask-editor.js  # 擦除内容（框选 + 涂抹）
│   ├── storage.js      # 编辑配置本地保存 / 恢复
│   ├── toast.js        # 轻提示
│   └── utils.js        # 旋转与擦除绘制辅助
├── public/             # 静态资源（favicon、logo）
├── screenshots/        # README 预览图
├── dist/               # 构建产物（可直接托管）
├── docs/               # 与 dist/ 相同的副本，供 GitHub Pages 使用
├── deploy/             # Docker 部署配置（compose）+ Actions 自动部署模板
└── scripts/            # 本地服务器（serve.js）与一键发布脚本
```

<a id="deploy"></a>

## 🚢 部署

**线上地址**：https://yaoyuandejuli.github.io/PaperSplit/

### 一键发布

```bash
npm run build
rm -rf docs && cp -r dist docs     # 同步构建产物
npm run publish:pages               # 推到 gh-pages 分支，1-2 分钟生效
```

### Docker 部署（飞牛 NAS / 群晖 / 任意 NAS）

仓库里已备好两份现成的 compose 文件（`deploy/` 目录），克隆后改一行路径就能用。

**方案一：nginx（推荐）** —— 只托管 `dist/` 静态文件，镜像小、并发强、最稳

```bash
git clone https://github.com/yaoyuandejuli/PaperSplit.git /vol1/docker/papersplit
cd /vol1/docker/papersplit
# 编辑 deploy/docker-compose.yml，把 volumes 的路径改成你的实际目录
docker compose -f deploy/docker-compose.yml up -d
```

**方案二：Node 版** —— 用项目自带的服务器（无需额外依赖）

```bash
cd /vol1/docker/papersplit
docker compose -f deploy/docker-compose.node.yml up -d
```

> 两种方案都直接托管**仓库里已构建好的 `dist/`**（构建产物已随仓库提交），所以容器内无需装依赖、无需执行构建。
> 以后更新只要在宿主机执行 `git pull`，再 `docker compose restart` 即可。

### 任意静态服务器

```bash
npm run serve            # 项目自带（零依赖，Node 内置模块，并发与 MIME 都已处理好）
npx serve dist           # 或 npx http-server dist -p 8080
```

> ⚠️ **不要用 `python -m http.server` 部署**：它是 HTTP/1.0、不支持 keep-alive，浏览器并发拉取资源时连接会被直接断开，页面会出现样式错乱、按钮失效或「无法加载 PDF 文件」。
> 另外部分简易服务器会把 `.js` 返回成 `application/octet-stream`，浏览器对 module 脚本做严格 MIME 校验，同样会导致加载失败。本项目对这两类问题都做了内置兼容，但**仍建议使用能并发处理请求的服务器**（nginx / `npm run serve`）。

### GitHub Actions 自动发布（可选）

把 `deploy/pages-workflow.yml` 复制为 `.github/workflows/deploy.yml` 并推送，之后每次改动 `docs/` 都会自动发布。

<a id="faq"></a>

## ❓ 常见问题（FAQ）

**Q：双击仓库里的 `index.html`，界面能显示但按钮点了没反应？**

这是最常见的问题。浏览器出于安全限制，**不允许 `file://` 协议加载 ES 模块**，而仓库根目录的 `index.html` 是**源码版**（`src/` 里写的是 `pdfjs-dist`、`jspdf` 这类裸模块标识符），必须经 Vite 打包才能运行。

**解决办法（任选其一）**：① 直接用[在线版本](https://yaoyuandejuli.github.io/PaperSplit/)；② 把 `dist/` 目录交给静态服务器（推荐 `npm run serve`）；③ 克隆仓库后 `npm install && npm run dev` 跑源码版。

> 本项目已内置 `file://` 检测，会直接弹出提示层告诉你该怎么做，不用猜。

**Q：上传 PDF 提示「无法加载 PDF 文件」，但图片能正常处理？**

这是**服务器的问题，不是文件的问题**（同一份 PDF 在在线版能正常打开）。图片不依赖 PDF 解析组件，所以图片正常、只有 PDF 失败，通常说明服务器**没有稳定响应那个约 1 MB 的解析组件脚本**。常见原因：

① **服务器扛不住浏览器的并发请求** —— 典型是 `python -m http.server`：它是 HTTP/1.0、不支持 keep-alive，浏览器一并发就连通都断，样式、主脚本、解析组件会随机加载失败。

```bash
npm run serve              # 项目自带，零依赖，已处理好并发与 MIME
npx serve dist
npx http-server dist -p 8080
```

② **服务器没有正确设置 MIME 类型** —— 把 `.js` 返回成 `application/octet-stream` 时，浏览器会拒绝执行该脚本。

③ 服务器对 `assets/` 目录做了访问限制或白名单。

> **本项目的处理方式**：解析组件的源码在**构建时就被写进主程序文件里**，运行时直接用，不再向服务器单独请求它。所以只要页面能打开（图片能正常处理），PDF 就一定能用 —— 上面三类问题都不会再出现。
> 如果你的页面**连界面样式都错乱**，那是服务器连基础资源都响应不稳定，请按 ① 换成规范服务器（`npm run serve`）。

**Q：需要联网吗？文件会上传吗？**

**都不需要**。PDF worker、图标与字体全部随应用本地打包，断网 / 内网可用；所有解析与处理都在浏览器内完成，文件不会离开你的电脑。

**Q：支持哪些文件格式？**

PDF、JPG、PNG。图片按单页处理。

**Q：编辑的内容会丢吗？**

分割线、密封线、方向角度、缩放比例与擦除标记会自动存在**本机浏览器的 localStorage**（按文件指纹区分）。重新打开同一文件会自动恢复；也可以在「文件导出」区点「清除本文件保存记录」随时清掉。

**Q：导出的 PDF 是什么规格？**

始终是**标准 A4（210×297mm）**，可选等比留白 / 拉伸填满 / 等比填满三种排版方式。

**Q：手机上能用吗？**

可以，界面为响应式设计，支持触摸拖动分割线。

## 🤝 贡献指南

欢迎提 PR 和 issue。**动手前请先看这条硬性要求**：

> ⚠️ **`src/` 目录里用的是裸模块标识符**（`import ... from 'pdfjs-dist'`、`'jspdf'`、`'material-icons'`），
> 浏览器**无法直接解析**，必须经 Vite 构建。因此：
> - **不要**把 `src/` 里的模块标识符改成相对路径，也不要直接编辑 `dist/` / `docs/` 里的构建产物（它们是生成物）；
> - 改完代码必须重新构建并同步产物，否则线上与仓库产物会不一致：
>
> ```bash
> npm install
> npm run build                    # 产出 dist/
> rm -rf docs && cp -r dist docs  # 同步到 docs/
> npm run publish:pages            # 发布到 gh-pages
> npm run serve                    # 本地预览 dist/（http://localhost:8080）
> ```

其他约定：

- 代码风格沿用现有模块：原生 ES6 Modules、不引入框架，样式集中在 `style.css`；
- 改动 UI 时同步更新 `index.html` 里的**操作指南**文案；
- 提交前请本地自测一遍：导入 PDF → 分栏 → 密封线 → 擦除 → 导出 A4；
- 涉及新依赖时，请确认它能被离线打包（不要依赖 CDN）；
- **PDF 解析组件（worker）的加载方式**在 `vite.config.js` 的 `inlinePdfWorker` 插件中定制：构建时把 worker 源码以 base64 写入独立 chunk，运行时动态导入解码成 Blob URL。这样浏览器不再需要单独请求 worker 文件，可规避服务器 MIME 错误与并发断连。改动 worker 相关逻辑时，请一并检查该插件。

## 📄 开源协议

[MIT License](LICENSE) © PaperSplit

## 📅 更新日志

### 2026-10-31

- **手机端「已导入文件」移到最上方，改为横向平铺条**：原先文件清单收在右侧竖条里，要点标题展开浮层才能看到多份文件。现在整条清单提到页面**最上方**，文件卡片**横向平铺、左右滑动**即可看全；标题行右侧的「**＋**」随时可以继续添加更多文件（此前只有多文件时才出现），每张卡片上的「**×**」可直接移除该文档，点击卡片跳转到该文件首页。下方是页面缩略图（横向滑动）。
- **手机端新增置顶迷你预览**：要调分割 / 密封 / 方向必须下滑到功能区，此时主画布已滚出视口，看不到改动效果。现在右面板最上方多了一条**吸顶迷你预览**（78px），实时显示当前页并叠加**红色虚线分割线**与**半透明密封区**，下滑调参数时结果始终顶在最上面，边调边看。
- **手机端取消导出区底部固定**：「文件导出」区原先 `position: sticky; bottom: 0` 长期占据屏幕底部，压缩了画布与工具区空间。现改为回归文档流末尾 —— **只有滚动到底部才会出现**，滑到底即可看到当前的调整功能区并完成导出。
- **密封线区去掉「手动选区域」按钮**：删除该按钮及其「在画布上框选新建区域」的全部代码（框选模式、`state.sealSelectMode`、选框高亮样式等一并清理），第一行改为「去除密封线 / 重置」两个按钮。**滑动调整区域的功能完整保留** —— 开启密封线后直接拖动斜纹区即可整体平移，拖动两侧虚线仍可调整范围。
- **微调纠偏滑块两侧新增「−」「+」按钮**：滑块左侧为「−」、右侧为「+」，点击按滑块步长（0.5°）逐格增减当前页角度；抵达 ±15° 上/下限后对应按钮自动禁用，不会出现「点了没反应」。滑块本身仍可自由拖动。
- **新增站点宣传语**：左上角「PaperSplit」下方增加一行小字「**试卷本地拆分，一键适配A4打印**」，与英文主标题共同构成网站标题；浏览器标签页标题同步改为「PaperSplit - 试卷本地拆分，一键适配A4打印」，输入网址后地址栏即可看到标语。桌面端与手机端分别做了字号适配（手机端 0.64rem，顶栏不被撑高）。
- **方向调整区按钮重排**：「左转 / **重置** / 右转」三个按钮并排一行（重置居中，取代原先单独的「重置角度」）；滑块下方改为「**应用当前页** / **应用所有页**」两个按钮并排一行。
- **编辑工具区按钮重排**：「两栏 / **重置** / 三栏」三个按钮并排一行（重置居中，只把分割线恢复为默认单中线，不再连带清除密封线）；下方「增加分割线 / 去除分割线」保持一行，再下方改为「**应用当前页** / **应用所有页**」。
- **密封线区按钮重排**：去掉「批量应用」整块（**奇数页 / 偶数页** 按钮及其代码一并删除），改为「去除密封线 / 手动选区域 / **重置**」三个按钮并排一行；「重置」只清除本页密封区域，不影响分割线。下方新增「**应用当前页** / **应用所有页**」两个并排按钮（应用所有页跨奇偶时仍自动镜像）。
- **裁剪后调整区文案统一**：「应用到当前页」改名为「**应用当前页**」，与其它分区保持一致。
- **四个分区统一「应用当前页 / 应用所有页」**：方向、编辑工具、密封线、裁剪后调整的按钮命名与排版完全对齐；「应用当前页」负责确认并写入本页设置（给出 Toast 反馈），「应用所有页」负责批量复制。
- **同步更新**：页面内「操作指南」文案、README 中英文功能说明与更新日志均已对齐新界面。

### 2026-10-30

- **密封区域支持左右并存**：「靠左」「靠右」由「快捷吸附」改为**可独立开关的按钮** —— 点一次出现、再点一次消失，**左右两侧可以同时存在**（适合双侧装订）。数据模型由 `sealRange: {x0,x1}` 升级为 `sealRanges: []`（一页可有多个区域），几何层用「区间相减」算出剩余区域：挖掉左右两端后中间仍是一个连续区域，挖在中间则自然分成左右两段各自分栏。宽度默认沿用另一侧的设置，也可拖动两侧虚线单独调整。
- **编辑工具区精简**：去掉「奇数页 / 偶数页」批量按钮及其代码，「所有页」改名为「**应用所有页**」，与「恢复默认」并列一行（恢复默认在左）；密封线分区的「所有页」同步改名为「应用所有页」。
- **方向调整区新增「应用全部页」**：与「重置角度」并列一行（重置角度在左），一键把当前页的方向角度复制到所有页面。
- **裁剪后调整区新增「应用所有页」**：与「应用到当前页」并列一行（应用所有页在右），一键把输出比例应用到所有页面。
- **「修改后文件预览」消除图下空白**：预览画布高度由固定 300px 改为**按内容自适应**（两栏并排时约 172px，三栏换行时约 300px），页数少时不再在图下方留一大片空地。
- **左栏「已导入文件」上移**：桌面端文件清单移到页面缩略图**上方**（原先沉在底部）；手机端仍是右侧竖条（用 CSS `order` 保持缩略图在左）；清单下方提示精简为「点击卡片跳转」，去掉「页面先后用导出前排序」的引导文字。
- **导出区排版**：标题「文件导出」与「成品页 210×297mm」改为**同行居中**；桌面端「导出为 PDF (A4)」移到最后一项。

- **密封区域位置不再受限，可手动滑动选区**：密封线从「只能贴左 / 贴右」改为**任意位置的自由区域** —— 新增「手动选区域」按钮，在画布上横向拖动即可框出要裁掉的范围（位置不限，可落在页面中间）；拖动斜纹区可整体平移，拖两侧虚线可单独改宽窄，「靠左 / 靠右」保留为一键吸附快捷键。状态徽标实时显示当前范围（如「已启用 · 28%~48%」）。
- **密封区域与分割线彻底解耦、可同时使用**：此前分割线会被强制钳制在密封区之外，且分栏只在「保留区域」内计算。现在**先挖掉密封区，再在剩下的每一块里按分割线分栏**，两者互不限制 —— 分割线可以落在任何位置，密封区在中间时页面自然分成左右两段分别分栏。批量应用跨奇偶时改为水平镜像（x0/x1 各自取 1-x），宽度不变。
- **「裁剪结果预览」改为「修改后文件预览」，并放大预览图**：预览区标题改名，画面内不再绘制「第 N 栏」「成品页 …mm」等文字（成品尺寸已移到「文件导出」标题下方的「成品页 210×297mm」小字）。预览高度 206px → 300px，并改为**按每行页数自适应换行** —— 自动选择让每张成品页最大的列数，多页时分行排布，不再因横向排开而被压成极小的一排。
- **手机端左面板横向重排 + 文件清单可折叠**：原先手机端左面板只有 120px 高，标题前的图标被挤成竖线「| |」、多份文件的卡片只显示一张、缩略图区几乎不可见。现改为横向两栏 —— **左侧放大展示页面缩略图（80px → 108px）**，**右侧是「已导入文件」竖条**（竖排标题，不占用横向空间），点击标题展开文件清单，收起时几乎不占地方；展开态以浮层覆盖，多份文件卡片一次看全。移除按钮从 18px 放大到 26px 并扩大可点区域，画布区高度从 50vh 提升到 58vh。
- **手机版「文件导出」区紧凑化**：手机屏幕下该区域原本固定占用 285px（844px 高屏幕的 1/3），且底部常驻，导致画布几乎无法查看。现压缩至 171px（360px 窄屏 156px），减少约 40%：改用两列网格，「导出前排序」与「清除记录」并排一行，下拉框与各按钮字号、内边距统一收敛，图标缩小；「导出为 PDF (A4)」仍独占整行并保持主操作的视觉权重。桌面端布局完全不变。
- **修复本地部署上传 PDF 报「无法加载 PDF 文件」（图片却正常）**：PDF 解析组件的源码已**直接写进主程序文件**，运行时从内存启用，不再向服务器单独请求它。因此只要页面能打开，PDF 就一定能用 —— 服务器并发不足、MIME 类型不对、路径被限制这三类问题都不再发生。同时新增服务器能力提醒横幅：检测到资源加载失败时，直接提示换用 `npm run serve`。
- **多文件导入与排序**：文件选择框支持一次选中多个 PDF / 图片，合并成一份连续文档；左面板显示已导入文件清单（可移除单个文件、继续追加）；「文件导出」区提供**导出前排序**面板，可逐页拖动微调最终顺序。排序与移除时，各页的分割线 / 密封线 / 旋转 / 擦除标记会跟随页面一起搬家，不会错位。
- **去除文件级排序，统一由「导出前排序」调整**：文件本身不再支持拖拽重排（左面板拖拽手柄与相关代码已移除），页面先后一律在导出前用页级排序面板调整 —— 同一文件的页、不同文件的页都能逐页移动，功能上完全覆盖文件级重排。
- **导出文件名统一格式**：导出的 PDF 一律命名为 `A3-A4-YYMMDDHHmmss.pdf`（例：`A3-A4-261030201950.pdf`），按本地时间生成，避免多份导出互相覆盖。
- **修复「追加文件」后清单少一项、页面显示错乱**：文件 id 计数器此前会在重新导入时被归零，导致追加的文件拿到与旧文件重复的 id，按 id 索引的页面映射随之错位。现改为全局单调递增，追加多份文件也不会撞 id。
- **新增 Docker 部署配置**：仓库 `deploy/` 目录提供两份现成的 compose 文件（nginx 版与 Node 版），飞牛 NAS / 群晖等可直接克隆后改一行路径使用；容器只托管已构建好的 `dist/`，无需在容器内构建。
- **新增零依赖本地服务器**：新增 `npm run serve`（`scripts/serve.js`，仅用 Node 内置模块），并发与 MIME 均已处理妥当，局域网部署可直接使用。同时明确不建议用 `python -m http.server`（HTTP/1.0 不支持 keep-alive，扛不住浏览器并发）。
- **批量应用改为按奇偶页**：编辑工具的「批量应用」由「同类页」拆成「奇数页 / 偶数页」并排一行、「所有页」独占一行；密封线分区新增同款按钮组，跨奇偶应用时自动镜像到另一侧，目标页分割线自动钳制回保留区域。
- **密封线独立分区**：从「编辑工具」移出，成为「擦除内容」之后的新分区；画布上用斜纹阴影标出导出时会被裁掉的区域，新增左右切换与状态徽标，「恢复默认」独占一整行。
- **编辑配置自动保存**：分割线、密封线、角度、缩放比例与擦除标记存于本机 localStorage，重开同一文件自动恢复，可一键清除；仅打开文件不产生记录，读取时逐字段校验，损坏数据自动退回默认值。
- **离线可用与首屏瘦身**：PDF 解析组件、图标与字体全部随应用本地打包，断网 / 内网可用；导出组件改为导出时按需加载，导出显示实时进度并逐页释放画布内存。
- **代码整理与提速**：旋转控件与分割线渲染解耦，微调滑块 50ms 节流，切页作废未执行任务，清理死代码与无引用样式（移除只写不读的 `state.isPdf`、从未被读取的 `state.scale`，并把仅模块内使用的 `remapPagesData` / `syncTotalPages` 收回为内部函数）。

### 2026-10-29 及更早

- **多栏分割与编辑套件上线**：分割线由单条重构为数组，支持一分为 N；新增方向校正、擦除内容、裁剪后调整、统一 A4 导出，右侧面板重排为「方向调整 → 编辑工具 → 擦除内容 → 密封线 → 裁剪后调整 → 文件导出」。
- **操作指南与界面打磨**：指南改为可展开的折叠控件，术语与按钮名与界面保持一致；修复窗口缩放、快速翻页时的画布重影与密封线左右对称性问题。
- **稳定性修复**：并发渲染用令牌丢弃过期结果，窗口缩放防抖；上传不支持的文件类型会中止而不是留下「半启用」界面；密封方向改由语义决定并钳制分割点，杜绝密封区外泄与反向切片。

---

<a id="english"></a>

## 📖 English

> [⬆ 返回中文说明](#chinese) · Live demo: **https://yaoyuandejuli.github.io/PaperSplit/**

**PaperSplit** — *A privacy-first A3 to A4 PDF splitter. 100% client-side processing.*

> Site tagline: **Split exam papers locally, fit them to A4 in one click** (shown under the logo and in the browser tab title).

Everything happens inside your browser: files are never uploaded, and the app keeps working offline. PaperSplit turns scanned exam papers or documents into standard A4 pages, removes the binding (seal) strip, erases stray marks, and exports a clean A4 PDF.

**Features**

- **Import** — drag in a PDF or an image (JPG / PNG).
- **Multi-column splitting** — cut one page into *N* columns: "Two Columns" / "Reset" / "Three Columns" sit in one row, "Add Split Line" and "Remove Split Line" in the next.
- **Orientation correction** — "Rotate Left" / "Reset" / "Rotate Right" sit in one row, then fine-tune with a ±15° slider flanked by "−" and "+" buttons that step 0.5° at a time (the matching button disables itself at the ±15° limit); the angle is shown live and every page is adjusted independently. "Apply to Current Page" and "Apply to All Pages" sit side by side below the slider.
- **Seal region panel** — the seal strip can sit *anywhere* on the page: odd pages default to the left, even pages to the right; drag the shaded strip to move it, drag either dashed edge to resize. The area that will be cropped is shaded on the canvas. "Remove Seal" and "Reset" sit in one row.
- **Left and right seals together** — "Left" and "Right" are independent toggles: click once to add a strip, click again to remove it, and **both sides can be active at the same time** (handy for double-sided binding).
- **Seal region and split lines work together** — the seal strip is removed first, then the remaining area is split into columns; neither one constrains the other.
- **Erase content** — box-select a rectangle or paint with a brush; "Apply" bakes the erasure into the page and it is really removed from the exported PDF.
- **Post-crop zoom** — enlarge, shrink or reset a column that came out too small; "Apply to Current Page" and "Apply to All Pages" sit side by side. The "Modified File Preview" next to it shows the resulting A4 pages live, wrapping into rows so every page stays as large as possible, and the canvas shrinks to fit so no empty space is left below.
- **Apply per section** — every panel (orientation, editing tools, seal, post-crop zoom) offers "Apply to Current Page" and "Apply to All Pages" side by side: the first confirms and stores the current page's setup, the second copies it to every page (seal regions are mirrored across odd/even pages to keep the odd-left / even-right symmetry).
- **A4 export** — standard 210 × 297 mm PDF via `jsPDF`, with equal-ratio (margins), stretch-to-fill and equal-ratio-cover fit modes; export progress is shown page by page.
- **Auto-save** — split lines, seal line, orientation, zoom ratio and erase marks are stored in your browser's `localStorage` and restored automatically when you reopen the same file.
- **Offline & responsive** — the PDF worker, icons and fonts all ship with the app; works on desktop and mobile. On phones the imported-file list moves to the **top as a horizontally scrollable strip** (add more files with "＋", remove one with "×"), a **compact preview stays pinned to the top of the screen** while you scroll through the tools, and the export panel is no longer glued to the bottom — it appears only when you reach the end of the page.
- **Weak-server friendly** — the PDF parsing component is inlined into the build, so it no longer needs a separate request; combined with a retrying fallback, it loads even on servers with the wrong MIME type or limited concurrency.

**Getting started**

```bash
git clone https://github.com/yaoyuandejuli/PaperSplit.git
cd PaperSplit && npm install
npm run dev      # source version, usually http://localhost:5173
npm run serve    # built version (npm run build first), http://localhost:8080
```

Or simply try the live demo: **https://yaoyuandejuli.github.io/PaperSplit/**

> **Note** — the repository's root `index.html` is the *source* version: `src/` uses bare module specifiers, so double-clicking it shows the UI but no button responds. Serve the `dist/` folder instead (`npm run serve`), or use the live demo.
>
> **Also avoid `python -m http.server`** for anything beyond a quick look: it speaks HTTP/1.0 without keep-alive, so the browser's parallel requests get dropped — which shows up as broken styling, dead buttons, or "cannot load PDF file".
