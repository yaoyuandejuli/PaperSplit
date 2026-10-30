<div align="center">
  <img src="public/favicon.png" alt="PaperSplit Logo" width="120" height="120">
  <h1>PaperSplit</h1>

  <p>
    <a href="https://yaoyuandejuli.github.io/PaperSplit/">
      <img alt="在线体验 Live Demo" src="https://img.shields.io/badge/%E5%9C%A8%E7%BA%BF%E4%BD%93%E9%AA%8C%20%7C%20Live%20Demo-6366f1?style=for-the-badge&logo=github&logoColor=white">
    </a>
    &nbsp;&nbsp;
    <a href="https://yaoyuandejuli.github.io/PaperSplit/"><b>https://yaoyuandejuli.github.io/PaperSplit/</b></a>
  </p>
  <p><sub>🚀 在线体验，无需安装，打开即用 &nbsp;·&nbsp; <i>Live demo — no install, runs in your browser</i></sub></p>
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
> # 方式①：本地静态托管 dist/（推荐给只想用的人）
> npx serve dist          # 或： python -m http.server -d dist
> ```
>
> > ⚠️ **请勿直接双击仓库根目录的 `index.html`**：那是**源码版**页面，`src/` 里使用的是裸模块标识符（`jspdf` / `pdfjs-dist` / `material-icons`），浏览器无法解析。
> > 结果是**界面能显示但所有按钮都没反应**（控制台报 CORS / 模块解析错误）——这不是版本问题，也不是坏了。
> > 正确做法：用上面方式①托管 `dist/`，或方式②跑 `npm run dev`。

**[English](#english) | [中文指南](#中文)**

<div id="english"></div>

## 📖 English

**PaperSplit** is a lightweight, privacy-focused web tool designed to split **A3 exam papers or documents into A4 format**. It runs entirely in your browser, ensuring your data remains private and secure.

### ✨ Key Features

*   **Smart Import**: Supports drag-and-drop for A3 PDFs or images (JPG/PNG).
*   **Multi-Column Splitting**: Split a page into **N columns**, not just two.
    *   **Two Columns / Three Columns**: One-click presets for the common layouts.
    *   **Add Split Line**: Inserts another cut line at the widest gap, so one page can become many.
    *   **Remove Split Line**: Enter "Remove Split Line" mode and click a cut line to delete it immediately, or double-click any cut line to remove it. "Reset Defaults" restores the page. 去除分割线模式下点击即删，也可双击删除，「恢复默认」可一键还原。
*   **Orientation Correction**: Rotate content **90° left / right**, fine-tune with a **±15° slider**, and reset back to 0°. Each page is adjusted independently. 方向可 90° 旋转 + 滑动微调，实时显示角度。
*   **Seal Line Adjustment** (its own panel, right after Erase Content):
    *   **Smart Detection**: Odd pages default to left, even pages default to right.
    *   **Left / Right switch**: move the seal area to either side at any time.
    *   **Visual preview**: the area that will be cropped on export is shaded on the canvas.
    *   Adjustable seal area that is automatically cropped during export.
    密封线调整（独立分区，紧随擦除内容之后）：奇偶页智能识别左右、可自由切换左右侧、画布上用斜纹阴影标出将被裁掉的区域，导出时自动裁切。
*   **Erase Content**: Remove unwanted marks by **drag-selecting a rectangle** or **painting with a brush**. "Apply" bakes the erasure into the page, and the erasure is really applied on export. 框选 / 涂抹两种方式擦除内容，擦除效果真实写入导出 PDF。
*   **Post-Crop Zoom**: If a cropped column comes out too small to read, **zoom in / out / reset** the slice and apply it to the current page — the ratio is honoured on export. 裁剪后调整显示大小，比例真实影响导出。
*   **Batch Application**:
    *   **Odd Pages / Even Pages / All Pages**: copy the current page's split settings to every odd page, every even page, or the whole document.
    *   **Seal line batch**: the seal-line panel has its own batch buttons — apply the seal to all odd pages, all even pages, or every page (cross-parity targets are mirrored automatically to keep the odd-left / even-right symmetry).
    *   **Reset Defaults**: Restore one page back to the default split with no seal line.
*   **HD Export**: Generates high-quality **standard A4 (210×297 mm)** PDF documents using `jsPDF`, with selectable fit modes (equal-ratio with margins, stretch-to-fill, or equal-ratio cover).
*   **Auto-Save of Edits**: Split lines, seal line, orientation, post-crop zoom and erase marks are **saved in your own browser** (localStorage, never uploaded). Reopen the same file and everything is restored automatically; use "Clear Saved Record" to opt out. 编辑配置自动保存在本机浏览器，重新打开同一文件即可恢复，可一键清除。
*   **Responsive Design**: Works perfectly on both PC and mobile devices.

### 🚀 Quick Start

#### 1. Install Dependencies
This project uses `npm` for dependency management.
```bash
npm install
```

#### 2. Start Development Server
```bash
npm run dev
```
Open the local URL shown in the terminal (usually `http://localhost:5173`).

#### 3. How to Use
1.  **Import**: Click "Select File" or drag your file into the workspace.
2.  **Adjust**:
    *   Move the **Red Line** to set the A4 split position.
    *   Click "**Remove Seal Line**" to add a cut-off area if needed (draggable).
    *   Use "**Two Columns** / **Three Columns**" or "**Add Split Line**" to cut into more columns.
    *   Rotate with "**Left 90° / Right 90°**" and fine-tune with the slider if the scan is skewed.
    *   Use "**Erase Content**" to box-select or paint away unwanted marks.
    *   Use "**Post-Crop Adjustment**" to zoom a too-small column, then "Apply to Current Page".
3.  **Batch**: Use the "**Odd Pages / Even Pages**" buttons (plus "**All Pages**" on its own row) to copy your settings to other pages — the same layout is available inside the Seal Line panel.
4.  **Export**: Click "Export as PDF (A4)" to download your processed file.

---

<div id="中文"></div>

## 🇨🇳 中文指南

**PaperSplit** (原 PDF Edit) 是一个基于 Web 的轻量级工具，专为将 **A3 格式的试卷或文档拆分为 A4 格式**而设计。它完全在浏览器端运行，确保数据隐私安全。

### ✨ 核心功能

*   **智能导入**：支持拖拽上传 PDF 文件或图片（JPG/PNG）。
*   **多栏分割**：一页可切成 **N 栏**，不再局限于一分为二。
    *   **两栏 / 三栏**：一键套用常见版式。
    *   **增加分割线**：在最大间隙处插入新的分割线，一分为多。
    *   **去除分割线**：点击分割线即直接删除。
*   **方向校正**：**左转 / 右转 90°** 快速摆正，再用 **±15° 滑块**微调，角度实时显示，每页独立生效。
*   **密封线调整（可选）**（独立分区，位于「擦除内容」之后）：
    *   **智能识别**：奇数页默认在左侧，偶数页默认在右侧。
    *   **左右自由切换**：可随时把密封区域换到另一侧。
    *   **可视化预览**：画布上用斜纹阴影标出导出时会被裁掉的区域。
    *   可拖动调整密封线范围，导出时自动裁切该区域。
*   **擦除内容（可选）**：支持 **框选矩形** 与 **涂抹笔刷** 两种方式擦除多余内容，点「应用」后画布直接显示擦除效果，**导出 PDF 时真实擦除**。
*   **裁剪后调整（可选）**：裁好的某栏太小看不清时，用 **放大 / 缩小 / 重置** 调整大小，点「应用到当前页」后比例在导出时真实生效。
*   **批量应用**：
    *   **奇数页 / 偶数页 / 所有页**：把当前页的分割设置一键复制到所有奇数页、所有偶数页或整个文档（奇数页与偶数页并排一行，「所有页」独占一行）。
    *   **密封线批量应用**：密封线分区同样提供「奇数页 / 偶数页 / 所有页」按钮，可统一设置密封区域；跨奇偶应用时会自动镜像到另一侧，保持「奇数页在左、偶数页在右」的对称关系。
    *   **恢复默认**：一键把当前页还原为默认分割并取消密封线。
*   **高清导出**：基于 `jsPDF` 生成高质量的**标准 A4（210×297mm）** PDF 文档，可选择等比留白 / 拉伸填满 / 等比填满三种排版方式。
*   **编辑自动保存**：分割线、密封线、方向角度、裁剪后调整比例与擦除标记**自动保存在本机浏览器**（localStorage，不上传任何数据）。重新打开同一文件自动恢复，点「清除本文件保存记录」可随时关闭。
*   **响应式设计**：完美适配 PC 和移动端操作，手机上也能轻松处理试卷。

### 🚀 快速开始

#### 1. 安装依赖
```bash
npm install
```

#### 2. 启动开发服务器
```bash
npm run dev
```
启动后，访问终端显示的本地地址（通常是 `http://localhost:5173`）。

#### 3. 使用流程
1.  **导入**：点击“选择文件”或直接拖拽文件到工作区。
2.  **调整**：
    *   移动红色**分割线**确定左右分页界限。
    *   若有密封线需要去除，点击“去除密封线”，调整灰色虚线区域。
    *   用“两栏 / 三栏”或“增加分割线”切成更多栏；用“去除分割线”删掉不要的线。
    *   扫描歪斜时用“左转 / 右转 90°”摆正，再用滑块微调角度。
    *   用“擦除内容”框选或涂抹掉多余的内容。
    *   裁剪后太小就用“裁剪后调整”放大，调好后点“应用到当前页”。
3.  **批量**：调整好一页后，点击「奇数页」「偶数页」把配置复制到同类页面，或点「所有页」复制到整份文档；密封线分区里也有同样的一组批量按钮。
4.  **导出**：点击底部的“导出为 PDF (A4)”，文件将自动下载。

---

## 🛠️ Tech Stack / 技术栈

*   **Core**: Native JavaScript (ES6 Modules)
*   **PDF Processing**: `pdfjs-dist` (Rendering), `jspdf` (Generation)
*   **Styling**: CSS3 (Flexbox/Grid), Material Icons, Google Fonts
*   **Build**: Vite

## 📂 Project Structure / 项目结构

```
/
├── index.html          # Entry HTML
├── style.css           # Global Styles
├── vite.config.js      # Vite Configuration
├── src/                # Source Code
│   ├── main.js         # Entry Point / Event Wiring
│   ├── state.js        # State Management
│   ├── dom.js          # DOM Elements
│   ├── file-handler.js # File Upload & Processing
│   ├── viewer.js       # Canvas Rendering & Rotation
│   ├── editor.js       # Split/Seal Line Logic
│   ├── exporter.js     # PDF Export Logic
│   ├── export-geometry.js # Slice Ranges & A4 Placement Geometry
│   ├── crop-adjust.js  # Post-Crop Zoom (output ratio)
│   ├── mask-editor.js  # Erase Content (rectangle + brush)
│   ├── storage.js      # 编辑配置本地自动保存 / 恢复 (localStorage)
│   ├── toast.js        # 轻量提示 (Toast)
│   └── utils.js        # Rotation / Erasure Drawing Helpers
├── deploy/
│   └── pages-workflow.yml # 可选：Actions 自动发布模板
├── scripts/
│   └── publish-pages.sh# 一键把 docs/ 发布到 gh-pages 分支
└── DEPLOY.md           # Deployment Guide
```

## 🚢 Deployment / 部署

### 🌐 在线地址（已启用）

**https://yaoyuandejuli.github.io/PaperSplit/**

仓库内已包含**可直接托管的构建产物**，无需本地构建即可部署：

```
├── dist/       # 构建产物（Vite 输出）
├── docs/       # 与 dist/ 相同的副本，供 GitHub Pages 直接使用
├── gh-pages    # 线上实际发布分支（内容 = docs/）
├── deploy/     # 可选的 Actions 自动部署工作流模板
└── scripts/    # 一键发布脚本
```

### 方式一：一键发布（推荐）

代码有改动后，在仓库根目录执行：

```bash
npm run build
rm -rf docs && cp -r dist docs     # 同步构建产物到 docs/
npm run publish:pages               # 把 docs/ 推到 gh-pages 分支，1-2 分钟生效
```

> `publish:pages` 会先检查 `docs/` 是否与 `dist/` 一致，避免发布过期内容。

### 方式二：GitHub Actions 自动发布（可选）

把 `deploy/pages-workflow.yml` 复制为 `.github/workflows/deploy.yml` 并推送，
之后每次改动 `docs/` 都会自动发布（需要令牌勾选 `workflow` 权限）。

### 方式三：任意静态服务器
```bash
npx serve dist          # 或
python -m http.server -d dist
```

### 方式四：本地开发 / 重新构建
```bash
npm install
npm run dev             # 开发服务器（热更新）
npm run build           # 构建到 dist/
```

> ⚠️ 请勿直接把仓库根目录当静态站点托管：`src/` 中的 `jspdf` / `pdfjs-dist` 是裸模块标识符，
> 浏览器无法解析，应用不会初始化。请始终使用 `dist/` 或 `docs/`。

## 📄 License



MIT License

## 📅 Changelog / 更新日志

### 2026-10-30 (Batch Apply by Page Parity / 按奇偶页批量应用)

- **「同类页」拆成两个明确选项**: the Editing Tools batch block now offers **奇数页** and **偶数页** side by side, with **所有页** on its own full-width row below — instead of one ambiguous「同类页」button that depended on the page you were on. 「批量应用」由「同类页」改为「奇数页」「偶数页」并排一行，「所有页」独占一行。
- **Seal line got its own batch block**: the 密封线调整 panel now has the same **奇数页 / 偶数页 + 所有页** layout, so the seal area can be set across the whole document without touching each page. 密封线分区新增同款「批量应用」按钮组。
- **Mirrored across parities**: applying the seal to pages of the opposite parity automatically flips it to the other side (same width), preserving the「odd left / even right」book symmetry. 跨奇偶应用时密封区域自动镜像到另一侧，保持书页左右对称。
- **Split lines stay inside the kept area**: pages that receive a seal line get their split lines clamped into the surviving region, so no column is ever cut in the cropped-away zone. 应用密封线的页面，分割线会自动钳制回保留区域。
- **Non-blocking feedback**: batch operations now report the result with a toast instead of an `alert` dialog. 批量操作改为轻提示反馈，不再弹出系统对话框。

### 2026-10-30 (Seal Line as Its Own Panel / 密封线独立分区)

- **Seal Line moved out of Editing Tools**: it now lives in its own **「密封线调整（可选）」** panel, placed right after **「擦除内容（可选）」** (and before「裁剪后调整」). 密封线从「编辑工具」中独立出来，成为「擦除内容（可选）」之后的新分区。
- **Editing Tools rebalanced**: with the seal-line button gone,「恢复默认」now occupies a **full row** on its own, so the panel no longer has an awkward gap. 编辑工具区去掉密封线按钮后，「恢复默认」独占一整行，补齐原先的空白。
- **Seal area is now visible on the canvas**: the region that will be cropped on export is marked with a **shaded hatch overlay**, so you can see exactly what gets removed. 画布上用斜纹阴影实时标出导出时会被裁掉的区域。
- **Left / Right switch added**: the seal area could previously only be moved, never flipped to the other side — now there are dedicated「左侧 / 右侧」buttons (only enabled while the seal line is on). 新增左右切换按钮，密封区域可自由换边。
- **Status readout**: a chip shows「未启用」/「已启用 · 左侧」/「已启用 · 右侧」. 状态徽标实时显示当前状态与所在侧。
- The operation guide was reordered to match the new panel order (擦除内容 now comes before 密封线). 操作指南顺序同步调整，与面板顺序一致。

### 2026-10-30 (Auto-Save of Edits / 编辑配置自动保存)

- **Edits are saved locally and restored automatically**: split lines, seal line, orientation angle, post-crop zoom ratio and erase marks are stored in the browser's `localStorage` under a **file fingerprint** (name + size + last-modified). Reopen the same file and everything comes back — no data ever leaves the machine. 编辑配置按「文件指纹」存于本机 localStorage，重新打开同一文件自动恢复，数据不出本机。
- **Guide step 8 added**: the operation guide now ends with「自动保存」, explaining what is stored and how to turn it off. 操作指南新增第 8 步「自动保存」。
- **Opt-out button**: 「清除本文件保存记录」in the File Export panel deletes the stored record and stops auto-saving for that file. 文件导出区新增「清除本文件保存记录」，清除后该文件不再自动保存。
- **Nothing is stored before you edit**: loading a file no longer writes a record by itself — the first render after load is explicitly excluded from auto-save. 仅打开文件不产生记录，载入后的首帧渲染不触发保存。
- **Robustness**: every field is validated on read (corrupt or hand-edited data falls back to defaults and never breaks the app); records carry a schema version and are ignored when it does not match; at most 10 files are kept and the oldest are pruned. 读取时逐字段校验，损坏数据自动退回默认值；带结构版本号；最多保留 10 个文件的记录并自动淘汰最旧的。
- **Saves are flushed on exit**: a save is triggered when the page is hidden or closed, so changes made in the last moment are not lost. 页面切到后台或关闭时立即落盘，不会丢失最后的改动。

### 2026-10-30 (Code Cleanup & Smoother Fine-Tuning / 代码整理与微调提速)

- **Rotation UI decoupled from split-line rendering**: `renderSplitLines()` no longer owns the angle readout / fine-tune slider — those moved into a dedicated `syncRotationUI()`. Adjusting the split layout no longer rewrites the angle controls, and rotating no longer rebuilds the split-line DOM. 旋转显示与滑块同步从分割线渲染中拆出为独立函数：调整分栏不再改写角度控件，旋转也不再重建分割线 DOM。
- **Fine-tune slider throttled**: dragging the ±15° slider previously re-rendered the whole PDF page on every `input` event (dozens of times per second). It is now throttled to one re-render per 50 ms with a guaranteed trailing update, and redundant re-renders are skipped when the angle is already correct. 微调滑块拖动由「每次 input 全页重渲染」改为 50ms 节流 + 尾随保证，角度未变时跳过渲染。
- **Stale task guard**: a pending throttled rotation is discarded if the user switches pages in the meantime, so it can never rotate the new page with the previous page's offset. 切页时自动作废未执行的节流任务，避免用上一页偏移误转新页。
- **Dead code removed**: dropped the unused `getMaskMode()`, and removed the needless `export` keyword from five functions that are only used inside their own module (`getEraseCount`, `getAppliedScale`, `removeSplitLineAt`, `updateSplitRemoveUI`). Also removed the unused `guideSection` id. 删除无用函数与多余导出，清理未使用的 HTML id。
- **Package metadata fixed**: `repository` / `bugs` / `homepage` still pointed at the upstream project — now point to this fork and the live site; dropped the meaningless `main` field. 包信息中的仓库与主页地址从上游项目改为本仓库与线上站点。
- **Publishing made safer**: `scripts/publish-pages.sh` now checks that `docs/` exists, warns when `docs/` and `dist/` are out of sync (prevents publishing stale builds), verifies git availability, and is wired up as `npm run publish:pages`. 发布脚本增加前置检查与产物一致性校验，避免发布过期内容。

### 2026-10-30 (Guide Copy Polish / 操作指南文案打磨)

- **Guide trimmed to 7 steps**: Removed the "去除分割线" step (the action itself still exists in Editing Tools) and renumbered the guide from 8 steps to 7. 删除指南中「去除分割线」介绍，步骤由 8 步精简为 7 步并重新编号。
- **Term unified**: The Erase Content panel and its guide step are both called **「擦除内容（可选）」** (was「去除内容」), matching the UI. 术语统一为「擦除内容（可选）」，面板与指南一致。
- **Accurate button names**: The seal-line step now references the real button **「去除密封线」** instead of the long-gone "添加"; it is titled「密封线调整（可选）」. 密封线步骤改为「密封线调整（可选）」，正文按钮名修正为实际存在的「去除密封线」（原“添加”按钮已不存在）。
- **Copy tweaks**: Step 2 "扫描歪斜时" → "文件斜歪时"; step 6 reworded to "裁剪后的文字过小，使用「放大/缩小/重置」调整大小。"; step 7 retitled「文件导出」with the new description "文件调整完成之后，点击「文件导出」导出标准 A4 的 PDF"; the crop preview title dropped its "(按待应用比例)" note. 指南文案逐项打磨：文件斜歪、裁剪后文字过小、文件导出，裁剪结果预览去掉括号内小字。

### 2026-10-30 (Offline Ready & Slimmer Load / 离线可用与首屏瘦身)

- **Fully offline capable**: The PDF.js worker is now bundled locally (`?url` import) instead of fetched from unpkg CDN, and the Material Icons + Outfit fonts ship with the app instead of Google Fonts — the tool now works with **no internet connection** (air-gapped / school intranet). PDF worker 与图标/正文字体全部本地化，断网、内网环境可正常使用。
- **~50% smaller first load**: `jspdf` (+ transitively `html2canvas`/`dompurify`, ~600 KB) is now **dynamically imported only when exporting**. Fixed the manual-chunk config that made Vite's preload helper land in the jspdf chunk and get statically referenced by the entry. First-load JS drops from ~1.2 MB to ~640 KB; jspdf/worker load on demand. jspdf 及其连带依赖改为导出时按需加载，首屏 JS 体积约减半。
- **Export progress**: The export button now shows live progress ("正在导出 x / y 页…") and `aria-busy`, instead of a static "生成中..."; per-page canvases are released after slicing to keep memory flat on long documents. 导出按钮显示实时页码进度，逐页释放画布内存。
- **Dead code & copy cleanup**: Removed the dormant split-undo stack (`removedSplitStack`/`undoSplitRemoval`) left over after the "撤销删除" button was dropped, unused CSS (`.link-btn`, `.helper-text`, `.control-card/.control-row/.application-group`), and the stale "清除待去除标记" tooltip on「恢复默认」. 清理撤销栈死代码、无引用样式与过时提示文案。

### 2026-10-29 (Guide Collapse & UI Polish / 操作指南折叠与界面微调)

- **Collapsible Operation Guide**: The "操作指南" is now an **accessible disclosure control** — collapsed by default (only the title + a "点击展开" hint are shown), expanded on click to reveal all 8 steps. Implemented as a native `<button>` with `aria-expanded` / `aria-controls`, a rotating chevron, and full keyboard (Enter/Space) + screen-reader support. 操作指南改为点击展开/收起：默认仅显示标题与提示，点击展开全部内容，可键盘操作、兼容读屏。
- **Upload wording**: Removed the "A3" label from the upload hints (empty state & guide step 1) — the tool accepts general PDF / image files. 上传提示去掉「A3」字样。
- **Post-Crop Adjustment marked optional**: Added "（可选）" to the "裁剪后调整" panel title and its guide step, and changed "裁好的每栏太小？" to "裁好的每栏太小，". 「裁剪后调整」增加（可选）标注，问号改逗号。
- **Simplified Editing Tools**: Removed the bottom "共 N 条" counter and the "撤销删除" button from the Editing Tools panel; split-line deletion still works (click to delete, "恢复默认" to restore). 去除编辑工具底部的分割线计数与「撤销删除」选项。

### 2026-10-29 (Multi-Column Splitting & Editing Suite / 多栏分割与编辑增强)

- **Multi-Column Splitting**: The single `splitLine` model was refactored into a **`splitLines` array**, so one page can be cut into **N columns**. Added "Two Columns / Three Columns" presets and an "Add Split Line" action. 单条分割线重构为分割线数组，支持一分为 N；新增两栏/三栏预设与增加分割线。
- **Remove Split Line**: Click a cut line in "Remove Split Line" mode to **delete it immediately**; an "Undo" action restores removed lines one by one. 去除分割线改为点击即删，支持逐条撤销还原。
- **Orientation Adjustment**: Added "Left 90° / Right 90°" buttons, a **±15° fine-tune slider** with live angle display, and a "Reset Angle" button — each page rotates independently. 新增方向旋转：左右转 90°、滑动微调、重置角度，每页独立。
- **Post-Crop Adjustment**: New "Post-Crop Adjustment" panel with **zoom in / out / reset** plus "Apply to Current Page" and an A4-bounded preview; the ratio is honoured by the exporter. 新增裁剪后调整（放大/缩小/重置/应用到当前页），比例真实影响导出。
- **Erase Content**: New panel with **rectangle select** and **brush painting**; "Apply" bakes the erasure into the canvas and the erased regions are genuinely removed from the exported PDF. 新增去除内容（框选 + 涂抹），应用后画布直接显示去除效果，导出时真实擦除。
- **Unified A4 Export**: Export is now always **standard A4 (210×297 mm)** with three fit modes (equal-ratio with margins / stretch-to-fill / equal-ratio cover). 导出统一为标准 A4。
- **UI Refresh**: Rebuilt the right-hand panel into *Orientation → Editing Tools → Erase Content → Post-Crop Adjustment → File Export*, with a persistent step-by-step guide, compact status chips instead of verbose helper text, a "Reset Defaults" action, and a one-tap "Batch Apply" block. 右侧面板重排为「方向调整 → 编辑工具 → 去除内容 → 裁剪后调整 → 文件导出」，保留操作指南，状态改为紧凑徽标。

### 2026-06-20 (Export Fit Modes / 导出尺寸适配)
- **Selectable Export Fit**: Added an "导出尺寸" selector with three modes — **Standard A4 (fit, with margins)** [default], **Standard A4 (stretch to fill)**, and **Original crop size (WYSIWYG)**. Dragging the split line off-center no longer forces non-A4 pages unless you choose WYSIWYG. 新增"导出尺寸"选择器：标准A4等比留白(默认)、标准A4拉伸填满、原始裁剪尺寸；切割线偏离中心也能稳定输出标准 A4。

### 2026-06-20 (Bug Fixes / 问题修复)
- **Render Race Fix**: `renderCurrentPage` now uses a render token to discard stale concurrent renders, and the window-resize handler is debounced (150ms) — no more duplicate canvases / overlapping guide lines when resizing or switching pages quickly. 修复窗口缩放、快速翻页时画布与辅助线重影的问题。
- **Unsupported File Handling**: File type is now validated *before* enabling controls; unknown formats show an alert and abort instead of leaving the UI half-enabled. `resetState` now also resets `isPdf`. 上传不支持的文件类型不再留下"半启用"状态。
- **Seal Line Symmetry**: Even-page default seal position corrected from `0.8` to `0.85`, symmetric with the odd-page `0.15`. 修正偶数页默认密封线位置，与奇数页对称。
- **Export Geometry**: Seal direction is now driven by `seal.type` (not its position relative to the split line), and the split point is clamped into the kept region — dragging a seal line across the split line can no longer leak the sealed area or produce inverted slices. 导出时密封方向由语义决定并钳制分割点，杜绝密封区外泄与反向切片。

### 2025-12-13 (Evening Update)
- **Bug Fix**: Fixed seal line drag jumping issue using delta-based calculation.
- **UX Improvement**: Auto-hide left thumbnail panel when no file is uploaded.
- **Config Adjustment**: Optimized default seal line position to 0.15/0.85 for better accuracy.

### 2025-12-13
- **Mobile Support**: Added touch event support for smooth split-line dragging on mobile devices.
- **UI Redesign**: Replaced split-line dots with an arrow handle (`↔`) for better visibility and usability.
- **Style Optimization**: Refactored `style.css` with cleaner structure and removed redundant code.
- **Branding**: Updated project icon and header logo.

