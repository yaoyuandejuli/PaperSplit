<div align="center">
  <img src="public/favicon.png" alt="PaperSplit Logo" width="120" height="120">
  <h1>PaperSplit</h1>
</div>

**[English](#english) | [中文指南](#中文)**

<div id="english"></div>

## 📖 English

**PaperSplit** is a lightweight, privacy-focused web tool designed to split **A3 exam papers or documents into A4 format**. It runs entirely in your browser, ensuring your data remains private and secure.

### ✨ Key Features

*   **Smart Import**: Supports drag-and-drop for A3 PDFs or images (JPG/PNG).
*   **Multi-Column Splitting**: Split a page into **N columns**, not just two.
    *   **Two Columns / Three Columns**: One-click presets for the common layouts.
    *   **Add Split Line**: Inserts another cut line at the widest gap, so one page can become many.
    *   **Remove Split Line**: Click a cut line to delete it immediately; "Undo" restores it.
*   **Orientation Correction**: Rotate content **90° left / right**, fine-tune with a **±15° slider**, and reset back to 0°. Each page is adjusted independently. 方向可 90° 旋转 + 滑动微调，实时显示角度。
*   **Seal Line Removal**:
    *   Dedicated "Remove Seal Line" mode.
    *   **Smart Detection**: Odd pages default to left, even pages default to right.
    *   Adjustable seal area that is automatically cropped during export.
*   **Erase Content**: Remove unwanted marks by **drag-selecting a rectangle** or **painting with a brush**. "Apply" bakes the erasure into the page, and the erasure is really applied on export. 框选 / 涂抹两种方式去除内容，去除效果真实写入导出 PDF。
*   **Post-Crop Zoom**: If a cropped column comes out too small to read, **zoom in / out / reset** the slice and apply it to the current page — the ratio is honoured on export. 裁剪后调整显示大小，比例真实影响导出。
*   **Batch Application**:
    *   **Apply to Same Type**: One-click apply settings to all Odd or all Even pages.
    *   **Apply to All**: Apply current configuration to every page.
    *   **Reset Defaults**: Restore one page back to the default split with no seal line.
*   **HD Export**: Generates high-quality **standard A4 (210×297 mm)** PDF documents using `jsPDF`, with selectable fit modes (equal-ratio with margins, stretch-to-fill, or equal-ratio cover).
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
3.  **Batch**: Use "Same Type" or "All Pages" buttons to apply your settings to other pages.
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
*   **密封线处理**：
    *   支持“去除密封线”模式。
    *   **智能识别**：奇数页默认在左侧，偶数页默认在右侧。
    *   可拖动调整密封线范围，导出时自动裁切该区域。
*   **去除内容**：支持 **框选矩形** 与 **涂抹笔刷** 两种方式擦除多余内容，点「应用」后画布直接显示去除效果，**导出 PDF 时真实擦除**。
*   **裁剪后调整（可选）**：裁好的某栏太小看不清时，用 **放大 / 缩小 / 重置** 调整大小，点「应用到当前页」后比例在导出时真实生效。
*   **批量应用**：
    *   **同类页**：一键应用当前配置到所有奇数页或所有偶数页。
    *   **所有页**：一键应用到文档所有页面。
    *   **恢复默认**：一键把当前页还原为默认分割并取消密封线。
*   **高清导出**：基于 `jsPDF` 生成高质量的**标准 A4（210×297mm）** PDF 文档，可选择等比留白 / 拉伸填满 / 等比填满三种排版方式。
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
    *   用“去除内容”框选或涂抹掉多余的内容。
    *   裁剪后太小就用“裁剪后调整”放大，调好后点“应用到当前页”。
3.  **批量**：调整好一页后，点击“同类页”或“所有页”将配置应用到其他页面。
4.  **导出**：点击底部的“导出为 PDF (A4)”，文件将自动下载。

---

## �️ Tech Stack / 技术栈

*   **Core**: Native JavaScript (ES6 Modules)
*   **PDF Processing**: `pdfjs-dist` (Rendering), `jspdf` (Generation)
*   **Styling**: CSS3 (Flexbox/Grid), Material Icons, Google Fonts
*   **Build**: Vite

## �📂 Project Structure / 项目结构

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
│   └── utils.js        # Rotation / Erasure Drawing Helpers
└── DEPLOY.md           # Deployment Guide
```

## 🚢 Deployment / 部署

仓库内已包含**可直接托管的构建产物**，无需本地构建即可部署：

```
├── dist/       # 构建产物（Vite 输出）
└── docs/       # 与 dist/ 相同的副本，供 GitHub Pages 直接使用
```

### 方式一：GitHub Pages（零配置）
仓库 **Settings → Pages → Source** 选择 **Deploy from a branch**，分支选 `master`，目录选 **`/docs`**，保存后即可访问。

### 方式二：任意静态服务器
```bash
npx serve dist          # 或
python -m http.server -d dist
```

### 方式三：本地开发 / 重新构建
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

