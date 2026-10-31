import * as pdfjsLib from 'pdfjs-dist';
// Worker 本地打包（不再依赖 unpkg CDN，断网 / 内网环境也可用）
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
// Worker 源码（构建时由 vite 插件直接写进主 chunk，运行时转成 Blob URL）。
// 静态导入是关键：打包器会把源码并入主 JS，浏览器无需再单独请求 worker 文件，
// 于是「服务器并发不足 / MIME 不对 / 路径被限制」三类问题全部消失。
import pdfWorkerSource from 'virtual:pdf-worker-inline';
import { state, resetState } from './state.js';
import { elements } from './dom.js';
import { renderThumbnails, renderCurrentPage, updatePageControls } from './viewer.js';
import { syncCropZoomUI, syncCropZoomFromPage } from './crop-adjust.js';
import { exitMaskMode, renderMasks } from './mask-editor.js';
import { getPageConfig, syncRotationUI } from './editor.js';
import { appendDocument, collectionFingerprint } from './documents.js';
import { renderFileList } from './file-list.js';
import { fileFingerprint, loadEditConfig } from './storage.js';
import { showToast } from './toast.js';

// 设置 PDF.js Worker（本地资源）
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

// 已解析好的 Blob worker 地址（整个会话只取一次，避免每次上传都重新解码 1MB）
let cachedWorkerUrl = null;

/**
 * 处理文件上传事件 (Change Event)
 * 支持一次选择多个 PDF 与图片，它们会被合并成一份连续文档
 */
export async function handleFileUpload(e) {
    const files = Array.from((e.target && e.target.files) || []);
    // 清空 input，允许连续两次选择同一个文件也能触发 change
    if (e.target && 'value' in e.target) e.target.value = '';
    if (!files.length) return;

    const mode = importMode;
    importMode = 'replace';
    await importFiles(files, mode);
}

/**
 * 下一次导入的模式：replace 替换全部 / append 追加到现有集合末尾
 * 由按钮在打开文件选择框前设置
 */
let importMode = 'replace';

export function setImportMode(mode) {
    importMode = mode === 'append' ? 'append' : 'replace';
}

/**
 * 导入一批文件
 * @param {File[]} files 文件列表
 * @param {'replace'|'append'} mode replace 替换现有集合；append 追加到末尾
 */
async function importFiles(files, mode) {
    // 只接受 PDF 与图片
    const accepted = files.filter(f => f.type === 'application/pdf' || (f.type && f.type.startsWith('image/')));
    if (!accepted.length) {
        alert('不支持的文件格式，请上传 PDF 或图片文件');
        return;
    }

    const isAppend = mode === 'append' && state.totalPages > 0;

    if (!isAppend) {
        // 全新导入：先清空旧集合与旧配置，再解析新文件
        // （resetState 不再重置 docSeq —— 文件 id 必须全局唯一，
        //   否则追加导入时新文件会与旧文件撞 id，页面映射就会错位）
        releaseDocuments();
        resetState();
        state.suppressSave = true;
    }

    // 解析每一个文件（失败的文件跳过，不影响其它文件）
    const docs = [];
    for (const file of accepted) {
        try {
            const doc = await parseFile(file);
            if (doc) docs.push(doc);
        } catch (error) {
            console.error(`解析文件失败：${file.name}`, error);
            showToast(`「${file.name}」载入失败，已跳过`, 'error');
        }
    }
    if (!docs.length) return;

    for (const doc of docs) {
        appendDocument(doc);
    }

    // 存储指纹按「导入先后」计算，与排序无关 —— 重新打开同样这批文件即可恢复配置
    state.fileFingerprint = collectionFingerprint(state.documents);
    // 每次重新载入文件都恢复自动保存（除非用户在本次会话中主动清除过）
    state.saveDisabled = false;
    // 仅用于本地存储记录里的展示名；导出的文件名统一由导出器按时间戳生成
    const firstName = state.documents[0].name.replace(/\.[^/.]+$/, '');
    state.fileName = state.documents.length === 1
        ? firstName
        : `${firstName} 等 ${state.documents.length} 个文件`;

    // 隐藏空状态、显示左侧面板
    // 注意：首次渲染后 emptyState 会被 canvasWrapper 清空，这里必须做空值保护
    if (elements.emptyState) elements.emptyState.style.display = 'none';
    const leftPanel = document.querySelector('.left-panel');
    if (leftPanel) leftPanel.style.display = 'flex';

    // 启用相关操作按钮
    elements.toggleSealLineBtn.disabled = false;
    elements.sealSelectBtn.disabled = false;
    elements.resetSealBtn.disabled = false;
    elements.sealLeftBtn.disabled = true;
    elements.sealRightBtn.disabled = true;
    elements.exportBtn.disabled = false;
    elements.clearSaveBtn.disabled = false;
    if (elements.openSortBtn) elements.openSortBtn.disabled = false;
    elements.addSplitBtn.disabled = false;
    elements.removeSplitBtn.disabled = false;
    elements.resetDefaultsBtn.disabled = false;
    elements.splitHalfBtn.disabled = false;
    elements.splitThirdBtn.disabled = false;
    elements.applySplitCurrentBtn.disabled = false;
    elements.applyToAllBtn.disabled = false;
    elements.applySealCurrentBtn.disabled = false;
    elements.sealApplyAllBtn.disabled = false;
    elements.rotateLeftBtn.disabled = false;
    elements.rotateRightBtn.disabled = false;
    elements.rotateFineSlider.disabled = false;
    elements.resetRotationBtn.disabled = false;
    elements.applyRotateCurrentBtn.disabled = false;
    elements.applyRotateAllBtn.disabled = false;
    elements.cropZoomSlider.disabled = false;
    elements.cropZoomInBtn.disabled = false;
    elements.cropZoomOutBtn.disabled = false;
    elements.cropZoomResetBtn.disabled = false;
    elements.applyCropZoomBtn.disabled = false;
    elements.applyCropZoomAllBtn.disabled = false;
    elements.maskToggleBtn.disabled = false;
    elements.maskBrushBtn.disabled = false;
    elements.maskBrushSlider.disabled = false;
    elements.maskUndoBtn.disabled = true;
    elements.clearMasksBtn.disabled = true;
    elements.maskApplyBtn.disabled = true;

    // 「裁剪后调整」面板初始为 100%
    syncCropZoomUI();

    // 新文件：退出框选模式并清空遮盖状态
    exitMaskMode();
    renderMasks();

    if (!isAppend) {
        // 首次导入：先确定 worker 地址（服务器 MIME 异常时自动改用 Blob 方式）
        pdfjsLib.GlobalWorkerOptions.workerSrc = await resolveWorkerUrl();
    }

    state.currentPage = 1;
    state.suppressSave = true;
    restoreSavedConfig();
    updatePageControls();
    renderFileList();
    await renderThumbnails();
    await renderCurrentPage();
    state.suppressSave = false;
}

/**
 * 解析单个文件，生成文档条目
 * @param {File} file 浏览器 File 对象
 * @returns {Promise<Object|null>} 文档条目
 */
async function parseFile(file) {
    const id = `doc${++state.docSeq}`;
    const fingerprint = fileFingerprint(file);

    if (file.type === 'application/pdf') {
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdfDoc = await loadingTask.promise;
        return {
            id,
            name: file.name,
            type: 'pdf',
            pdfDoc,
            pageCount: pdfDoc.numPages,
            fingerprint
        };
    }

    // 图片：作为单页文档，用对象 URL 承载（比 DataURL 省内存）
    const imageUrl = URL.createObjectURL(file);
    const img = new Image();
    try {
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = () => reject(new Error('图片解码失败'));
            img.src = imageUrl;
        });
    } catch (e) {
        try { URL.revokeObjectURL(imageUrl); } catch (err) { /* 忽略 */ }
        throw e;
    }

    return {
        id,
        name: file.name,
        type: 'image',
        imageUrl,
        width: img.width,
        height: img.height,
        pageCount: 1,
        fingerprint
    };
}

/** 释放所有图片的对象 URL（重新导入前调用） */
function releaseDocuments() {
    for (const doc of state.documents) {
        if (doc.type === 'image' && doc.imageUrl) {
            try { URL.revokeObjectURL(doc.imageUrl); } catch (e) { /* 忽略 */ }
        }
    }
}

/**
 * 解析可用的 PDF.js Worker 地址
 *
 * PDF.js 的 worker 是一个独立的 ES module 文件，浏览器必须单独向服务器请求它。
 * 这条链路在真实内网环境里高频失败：
 *   ① 服务器 MIME 不对（把 .js 返回成 application/octet-stream）→ 浏览器拒绝执行；
 *   ② 服务器并发能力弱（如老版本 python -m http.server、部分内网一键部署工具）
 *      在浏览器并发拉取多个资源时直接 reset 连接；
 *   ③ 服务器对 worker 路径做了限制 / 白名单 → 直接拒绝响应。
 * 三种情况都会表现为「无法加载 PDF 文件」。
 *
 * 解决思路（按优先级）：
 *   1. **内联源码**（首选）：构建时把 worker 源码静态写进主 chunk，
 *      运行时转成 Blob URL。浏览器随主 JS 一次拿到源码，**不再需要任何 worker 请求**
 *      → ①②③ 全部消失，且「图片能处理」必然意味着「PDF 也能处理」。
 *   2. **自行 fetch + 重试**：内联不可用时（开发模式 / 依赖未安装），
 *      由我们自己 fetch worker 源码。fetch 不校验 MIME（绕开 ①），
 *      且失败可退避重试（绕开 ②）。
 *   3. **原始地址**：前两步都失败时，交回 PDF.js 自行处理。
 */
async function resolveWorkerUrl() {
    if (cachedWorkerUrl) return cachedWorkerUrl;

    // 1. 内联源码（首选）：随主 chunk 一起到达，无需任何额外请求
    const inlineUrl = buildInlineWorkerUrl();
    if (inlineUrl) {
        cachedWorkerUrl = inlineUrl;
        return cachedWorkerUrl;
    }

    // 2. 开发模式：Vite 会以模块形式代理 worker，不能转 Blob，直接交给 PDF.js
    if (import.meta.env && import.meta.env.DEV) {
        return pdfWorkerUrl;
    }

    // 3. 自行 fetch + 退避重试
    const blobUrl = await buildBlobWorkerUrl();
    if (blobUrl) {
        cachedWorkerUrl = blobUrl;
        return cachedWorkerUrl;
    }

    console.warn('[PDF] 未能取得 worker 源码，改用原始地址加载');
    return pdfWorkerUrl;
}

/**
 * 用内联的 worker 源码生成 Blob URL
 *
 * 源码由 vite 插件在构建时**静态写入主 chunk**，因此它随主 JS 一次到达，
 * 不产生任何额外请求 —— 这是弱服务器环境下唯一可靠的方式。
 * @returns {string|null} Blob URL；没有内联源码时返回 null
 */
function buildInlineWorkerUrl() {
    if (!pdfWorkerSource) return null;
    try {
        return URL.createObjectURL(new Blob([pdfWorkerSource], { type: 'text/javascript' }));
    } catch (e) {
        console.warn('[PDF] 内联 worker 不可用：', e);
        return null;
    }
}

/**
 * 把打包好的 PDF worker 转成 Blob URL
 *
 * fetch 不校验 MIME，因此可以绕过「服务器把 .js 返回成 application/octet-stream」
 * 导致的 module 脚本加载失败；同时对网络错误做退避重试，应对并发不足的服务器。
 * @returns {Promise<string|null>} Blob URL；取不到时返回 null
 */
async function buildBlobWorkerUrl() {
    const delays = [0, 300, 900];

    for (let attempt = 0; attempt < delays.length; attempt++) {
        if (delays[attempt] > 0) {
            await new Promise(resolve => setTimeout(resolve, delays[attempt]));
        }
        try {
            const res = await fetch(pdfWorkerUrl);
            if (!res.ok) {
                console.warn(`[PDF] 获取 worker 失败：HTTP ${res.status}`);
                continue;
            }
            const source = await res.text();
            if (!source) continue;

            const blobUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
            console.info('[PDF] 已改用 Blob 方式加载 worker（兼容受限服务器）');
            return blobUrl;
        } catch (e) {
            // 连接被重置 / 超时等网络错误：退避后重试
            console.warn(`[PDF] 获取 worker 出错（第 ${attempt + 1} 次）：`, e && e.message);
        }
    }
    return null;
}

/**
 * 加载失败时给出可执行的排查提示
 *
 * 真实内网环境里最常见的两个原因：
 *   ① 服务器并发能力不足 / 连接被重置（老版本 python -m http.server、部分一键部署工具）；
 *   ② 服务器没有正确设置 MIME 类型（把 .js 返回成 application/octet-stream）。
 * 两者都会表现为「无法加载 PDF 文件」，但解法不同，因此分开提示。
 */
function showLoadFailure(error) {
    const msg = String((error && error.message) || '').toLowerCase();
    const isNetwork = /worker|fetch|network|failed to load|connection|module script|mime|import/i.test(msg);

    const lines = [
        '无法加载 PDF 文件。',
        '',
        '常见原因与解决办法：',
        '',
        '① 本地服务器并发不足 / 连接被重置',
        '   简易服务器（如老版本 python -m http.server）处理不了浏览器的并发请求，',
        '   导致 PDF 解析组件加载失败。',
        '   解决：改用能并发处理的静态服务器，例如：',
        '      npx serve dist',
        '      npx http-server dist -p 8080',
        '',
        '② 服务器没有正确设置 MIME 类型',
        '   把 .js 返回成 application/octet-stream 时，浏览器会拒绝执行 PDF 解析组件。',
        '   解决：确认服务器对该文件返回 application/javascript。',
        '',
        '若用源码方式运行，请确认已执行 npm install，并且是用 npm run dev 启动（不要直接双击 index.html）。'
    ];

    if (!isNetwork) {
        lines.splice(1, 0, '如果文件本身可以被正常打开，请先确认它不是加密或损坏的 PDF。', '');
    }

    alert(lines.join('\n'));
}

/**
 * 恢复该文件上次保存的编辑配置（分割线 / 密封线 / 旋转 / 裁剪比例 / 擦除标记）
 * 没有记录或数据不可用时静默跳过，一切照常按默认状态开始
 */
function restoreSavedConfig() {
    const saved = loadEditConfig(state.fileFingerprint, state.totalPages);
    if (!saved) return;

    state.pagesData = saved.pages;

    // 旋转基准重置为当前页角度（微调滑块相对此偏移），并同步角度显示
    state.rotationBase = getPageConfig(state.currentPage).rotation || 0;
    syncRotationUI();

    // 恢复后同步各项 UI：擦除标记、裁剪比例（待应用值对齐已应用值）
    renderMasks();
    syncCropZoomFromPage();

    const when = saved.at ? new Date(saved.at).toLocaleString('zh-CN', { hour12: false }) : '';
    showToast(`已恢复上次的编辑配置${when ? `（${when}）` : ''}`, 'success');
}
