<div align="center">
  <img src="public/favicon.png" alt="PaperSplit" width="120" height="120">
  <h1>PaperSplit</h1>

  <p>
    <a href="https://yaoyuandejuli.github.io/PaperSplit/">
      <img alt="在线体验" src="https://img.shields.io/badge/%E5%9C%A8%E7%BA%BF%E4%BD%93%E9%AA%8C-6366f1?style=for-the-badge&logo=github&logoColor=white">
    </a>
    &nbsp;&nbsp;
    <a href="https://yaoyuandejuli.github.io/PaperSplit/"><b>https://yaoyuandejuli.github.io/PaperSplit/</b></a>
  </p>
  <p><sub>🚀 在线体验，打开即用 · 文件不上传，全部处理都在本机完成</sub></p>
</div>

> ### ⚡ 三种运行方式（选一种即可）
>
> | 方式 | 操作 | 说明 |
> |---|---|---|
> | **① 最省事** | 下载 ZIP → 把 **`dist/`** 目录交给任意静态服务器 | 免安装、免构建，产物已随仓库提供 |
> | **② 本地开发** | `git clone` → `npm install` → **`npm run dev`** | 改代码用这个 |
> | **③ 重新构建** | `npm install` → **`npm run build`** → 用 `dist/` | 产物输出到 `dist/` |
>
> ```bash
> # 方式②：一行启动
> git clone https://github.com/yaoyuandejuli/PaperSplit.git
> cd PaperSplit && npm install && npm run dev
> ```
>
> ```bash
> # 方式①：本地静态托管 dist/
> npx serve dist          # 或： python -m http.server -d dist
> ```
>
> > ⚠️ **请勿直接双击仓库根目录的 `index.html`**：那是**源码版**页面，`src/` 里用的是裸模块标识符（`jspdf` / `pdfjs-dist` / `material-icons`），浏览器无法解析。
> > 结果是**界面能显示但所有按钮都没反应**——这不是版本问题，也不是坏了。正确做法：托管 `dist/`，或跑 `npm run dev`。

## 📖 简介

**PaperSplit** 是一个纯浏览器端运行的轻量工具，专门把 **A3 试卷 / 文档拆分成 A4**，并顺手去掉装订密封线、擦掉多余标记。文件不上传、不依赖网络，所有处理都在本机完成。

### ✨ 核心功能

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

## 🚀 快速开始

```bash
git clone https://github.com/yaoyuandejuli/PaperSplit.git
cd PaperSplit
npm install
npm run dev      # 启动后访问终端显示的地址（通常 http://localhost:5173）
```

### 使用流程

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
├── dist/               # 构建产物（可直接托管）
├── docs/               # 与 dist/ 相同的副本，供 GitHub Pages 使用
├── deploy/             # 可选的 Actions 自动部署模板
└── scripts/            # 一键发布脚本
```

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
npx serve dist          # 或 python -m http.server -d dist
```

> 部分简易服务器（老版本 `python -m http.server`、部分内网部署工具）会把 `.js` 返回成 `application/octet-stream`，浏览器对 module 脚本做严格 MIME 校验。本项目已内置兼容处理（自动改用 Blob 方式加载 PDF worker），但仍**推荐用 `npx serve dist`** 启动。

### GitHub Actions 自动发布（可选）

把 `deploy/pages-workflow.yml` 复制为 `.github/workflows/deploy.yml` 并推送，之后每次改动 `docs/` 都会自动发布。

## 📄 许可

MIT License

## 📅 更新日志

### 2026-10-30

- **修复部分服务器下无法加载 PDF**：PDF worker 属于 ES module，服务器 MIME 类型不对会被浏览器拒绝加载。构建产物中的 worker 统一改为 `.js`，并在运行时探测 MIME，异常时自动改用 Blob 方式加载；报错提示同时补上了原因与解决办法。
- **批量应用改为按奇偶页**：编辑工具的「批量应用」由「同类页」拆成「奇数页 / 偶数页」并排一行、「所有页」独占一行；密封线分区新增同款按钮组，跨奇偶应用时自动镜像到另一侧，目标页分割线自动钳制回保留区域。
- **密封线独立分区**：从「编辑工具」移出，成为「擦除内容」之后的新分区；画布上用斜纹阴影标出导出时会被裁掉的区域，新增左右切换与状态徽标，「恢复默认」独占一整行。
- **编辑配置自动保存**：分割线、密封线、角度、缩放比例与擦除标记存于本机 localStorage，重开同一文件自动恢复，可一键清除；仅打开文件不产生记录，读取时逐字段校验，损坏数据自动退回默认值。
- **离线可用与首屏瘦身**：PDF worker、图标与字体全部本地打包，断网 / 内网可用；`jspdf` 改为导出时按需加载，首屏体积约减半；导出显示实时进度并逐页释放画布内存。
- **代码整理与提速**：旋转控件与分割线渲染解耦，微调滑块 50ms 节流，切页作废未执行任务，清理死代码与无引用样式。

### 2026-10-29 及更早

- **多栏分割与编辑套件上线**：分割线由单条重构为数组，支持一分为 N；新增方向校正、擦除内容、裁剪后调整、统一 A4 导出，右侧面板重排为「方向调整 → 编辑工具 → 擦除内容 → 密封线 → 裁剪后调整 → 文件导出」。
- **操作指南与界面打磨**：指南改为可展开的折叠控件，术语与按钮名与界面保持一致；修复窗口缩放、快速翻页时的画布重影与密封线左右对称性问题。
- **稳定性修复**：并发渲染用令牌丢弃过期结果，窗口缩放防抖；上传不支持的文件类型会中止而不是留下「半启用」界面；密封方向改由语义决定并钳制分割点，杜绝密封区外泄与反向切片。
