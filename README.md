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

<a id="preview"></a>

## 🖼️ 界面预览

![PaperSplit 工作界面](screenshots/preview.png)

<a id="features"></a>

## ✨ 核心功能

- **智能导入**：拖拽上传 PDF 或图片（JPG / PNG）。
- **多栏分割**：一页可切成 **N 栏**；「两栏 / 三栏」一键预设，「增加分割线」继续细分，「去除分割线」点击即删。
- **方向校正**：左转 / 右转 90° 摆正，再用 ±15° 滑块微调，角度实时显示，每页独立生效。
- **密封线调整**（独立分区）：奇数页默认在左、偶数页默认在右，可随时左右切换；画布上用斜纹阴影标出**导出时会被裁掉**的区域。
- **擦除内容**：框选矩形或涂抹笔刷擦除多余内容，点「应用」后画布直接显示擦除效果，导出 PDF 时真实擦除。
- **裁剪后调整**：某栏太小看不清时，放大 / 缩小 / 重置，点「应用到当前页」后比例在导出时真实生效。
- **批量应用**：「奇数页 / 偶数页」并排一行、「所有页」独占一行，一键把当前页的设置复制到同类页面；密封线分区也有同样的一组按钮，跨奇偶应用时自动镜像到另一侧，保持书页左右对称。
- **高清导出**：基于 `jsPDF` 生成标准 **A4（210×297mm）** PDF，可选等比留白 / 拉伸填满 / 等比填满三种排版方式。
- **编辑自动保存**：分割线、密封线、角度、缩放比例与擦除标记自动存在本机浏览器（localStorage），重开同一文件自动恢复，可一键清除。
- **离线可用 & 响应式**：PDF worker、图标与字体全部本地打包，断网 / 内网照常使用；PC 与手机都能操作。

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
3. **批量**：调好一页后，点「奇数页」「偶数页」复制到同类页面，或点「所有页」复制到整份文档。
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
├── deploy/             # 可选的 Actions 自动部署模板
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

### 任意静态服务器

```bash
npm run serve            # 项目自带（零依赖，Node 内置模块，并发与 MIME 都已处理好）
npx serve dist           # 或 npx http-server dist -p 8080
```

> ⚠️ **不要用 `python -m http.server` 部署**：它是 HTTP/1.0、不支持 keep-alive，浏览器并发拉取资源时连接会被直接断开，页面会出现样式错乱、按钮失效或「无法加载 PDF 文件」。
> 另外部分简易服务器会把 `.js` 返回成 `application/octet-stream`，浏览器对 module 脚本做严格 MIME 校验，同样会导致加载失败。本项目对这两类问题都做了内置兼容，但**仍建议使用能并发处理请求的服务器**。

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

### 2026-10-30

- **修复本地部署上传 PDF 报「无法加载 PDF 文件」（图片却正常）**：PDF 解析组件的源码已**直接写进主程序文件**，运行时从内存启用，不再向服务器单独请求它。因此只要页面能打开，PDF 就一定能用 —— 服务器并发不足、MIME 类型不对、路径被限制这三类问题都不再发生。同时新增服务器能力提醒横幅：检测到资源加载失败时，直接提示换用 `npm run serve`。
- **新增零依赖本地服务器**：新增 `npm run serve`（`scripts/serve.js`，仅用 Node 内置模块），并发与 MIME 均已处理妥当，局域网部署可直接使用。同时明确不建议用 `python -m http.server`（HTTP/1.0 不支持 keep-alive，扛不住浏览器并发）。
- **批量应用改为按奇偶页**：编辑工具的「批量应用」由「同类页」拆成「奇数页 / 偶数页」并排一行、「所有页」独占一行；密封线分区新增同款按钮组，跨奇偶应用时自动镜像到另一侧，目标页分割线自动钳制回保留区域。
- **密封线独立分区**：从「编辑工具」移出，成为「擦除内容」之后的新分区；画布上用斜纹阴影标出导出时会被裁掉的区域，新增左右切换与状态徽标，「恢复默认」独占一整行。
- **编辑配置自动保存**：分割线、密封线、角度、缩放比例与擦除标记存于本机 localStorage，重开同一文件自动恢复，可一键清除；仅打开文件不产生记录，读取时逐字段校验，损坏数据自动退回默认值。
- **离线可用与首屏瘦身**：PDF 解析组件、图标与字体全部随应用本地打包，断网 / 内网可用；导出组件改为导出时按需加载，导出显示实时进度并逐页释放画布内存。
- **代码整理与提速**：旋转控件与分割线渲染解耦，微调滑块 50ms 节流，切页作废未执行任务，清理死代码与无引用样式。

### 2026-10-29 及更早

- **多栏分割与编辑套件上线**：分割线由单条重构为数组，支持一分为 N；新增方向校正、擦除内容、裁剪后调整、统一 A4 导出，右侧面板重排为「方向调整 → 编辑工具 → 擦除内容 → 密封线 → 裁剪后调整 → 文件导出」。
- **操作指南与界面打磨**：指南改为可展开的折叠控件，术语与按钮名与界面保持一致；修复窗口缩放、快速翻页时的画布重影与密封线左右对称性问题。
- **稳定性修复**：并发渲染用令牌丢弃过期结果，窗口缩放防抖；上传不支持的文件类型会中止而不是留下「半启用」界面；密封方向改由语义决定并钳制分割点，杜绝密封区外泄与反向切片。

---

<a id="english"></a>

## 📖 English

> [⬆ 返回中文说明](#chinese) · Live demo: **https://yaoyuandejuli.github.io/PaperSplit/**

**PaperSplit** — *A privacy-first A3 to A4 PDF splitter. 100% client-side processing.*

Everything happens inside your browser: files are never uploaded, and the app keeps working offline. PaperSplit turns scanned exam papers or documents into standard A4 pages, removes the binding (seal) strip, erases stray marks, and exports a clean A4 PDF.

**Features**

- **Import** — drag in a PDF or an image (JPG / PNG).
- **Multi-column splitting** — cut one page into *N* columns: "Two Columns" / "Three Columns" presets, "Add Split Line" for even more, "Remove Split Line" by clicking a line (double-click removes it too).
- **Orientation correction** — rotate 90° left / right, then fine-tune with a ±15° slider; the angle is shown live and every page is adjusted independently.
- **Seal line panel** — odd pages default to the left, even pages to the right, and the seal can be flipped to either side at any time. The area that will be cropped is shaded on the canvas, and split lines are kept inside the surviving region.
- **Erase content** — box-select a rectangle or paint with a brush; "Apply" bakes the erasure into the page and it is really removed from the exported PDF.
- **Post-crop zoom** — enlarge, shrink or reset a column that came out too small; the ratio is applied on export.
- **Batch apply** — copy the current page's setup to all odd pages, all even pages, or every page. The seal-line panel has the same buttons, and applying across parities mirrors the seal to keep the odd-left / even-right symmetry.
- **A4 export** — standard 210 × 297 mm PDF via `jsPDF`, with equal-ratio (margins), stretch-to-fill and equal-ratio-cover fit modes; export progress is shown page by page.
- **Auto-save** — split lines, seal line, orientation, zoom ratio and erase marks are stored in your browser's `localStorage` and restored automatically when you reopen the same file.
- **Offline & responsive** — the PDF worker, icons and fonts all ship with the app; works on desktop and mobile.
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
