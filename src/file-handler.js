import * as pdfjsLib from 'pdfjs-dist';
// Worker 本地打包（不再依赖 unpkg CDN，断网 / 内网环境也可用）
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { state, resetState } from './state.js';
import { elements } from './dom.js';
import { renderThumbnails, renderCurrentPage, updatePageControls } from './viewer.js';
import { syncCropZoomUI, syncCropZoomFromPage } from './crop-adjust.js';
import { exitMaskMode, renderMasks } from './mask-editor.js';
import { getPageConfig, syncRotationUI } from './editor.js';
import { fileFingerprint, loadEditConfig } from './storage.js';
import { showToast } from './toast.js';

// 设置 PDF.js Worker（本地资源）
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

// 已解析好的 Blob worker 地址（整个会话只取一次，避免每次上传都重新解码 1MB）
let cachedWorkerUrl = null;

/**
 * 处理文件上传事件 (Change Event)
 * 支持 PDF 和 图片格式
 */
export async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    resetState();
    state.fileName = file.name.replace(/\.[^/.]+$/, "");
    // 文件指纹：用于编辑配置的自动保存与恢复（仅存本机）
    state.fileFingerprint = fileFingerprint(file);
    // 每次重新载入文件都恢复自动保存（除非用户在本次会话中主动清除过）
    state.saveDisabled = false;

    if (file.type === 'application/pdf') {
        state.isPdf = true;
    } else if (file.type.startsWith('image/')) {
        state.isPdf = false;
    } else {
        alert('不支持的文件格式，请上传 PDF 或图片文件');
        return;
    }

    elements.thumbnailsPanel.innerHTML = '';
    elements.emptyState.style.display = 'none';

    // 显示缩略图面板（之前隐藏的）
    const leftPanel = document.querySelector('.left-panel');
    if (leftPanel) {
        leftPanel.style.display = 'flex';
    }

    // 启用相关按钮（已确认是受支持的文件类型）
    elements.toggleSealLineBtn.disabled = false;
    elements.sealLeftBtn.disabled = true;   // 需先启用密封线
    elements.sealRightBtn.disabled = true;
    elements.exportBtn.disabled = false;
    elements.clearSaveBtn.disabled = false;   // 可清除本文件的保存记录
    elements.addSplitBtn.disabled = false;
    elements.removeSplitBtn.disabled = false;   // 去除分割线（进入选择模式）
    elements.resetDefaultsBtn.disabled = false; // 恢复当前页默认
    elements.splitHalfBtn.disabled = false;
    elements.splitThirdBtn.disabled = false;
    elements.applyToOddBtn.disabled = false;
    elements.applyToEvenBtn.disabled = false;
    elements.applyToAllBtn.disabled = false;
    elements.sealApplyOddBtn.disabled = false;
    elements.sealApplyEvenBtn.disabled = false;
    elements.sealApplyAllBtn.disabled = false;
    elements.rotateLeftBtn.disabled = false;
    elements.rotateRightBtn.disabled = false;
    elements.rotateFineSlider.disabled = false;
    elements.resetRotationBtn.disabled = false;
    elements.cropZoomSlider.disabled = false;
    elements.cropZoomInBtn.disabled = false;
    elements.cropZoomOutBtn.disabled = false;
    elements.cropZoomResetBtn.disabled = false;
    elements.applyCropZoomBtn.disabled = false;
    elements.maskToggleBtn.disabled = false;
    elements.maskBrushBtn.disabled = false;
    elements.maskBrushSlider.disabled = false;
    elements.maskUndoBtn.disabled = true;   // 尚无擦除内容
    elements.clearMasksBtn.disabled = true; // 尚无擦除内容
    elements.maskApplyBtn.disabled = true; // 尚无待应用的标记

    // 「裁剪后调整」面板初始为 100%
    syncCropZoomUI();

    // 新文件：退出框选模式并清空遮盖状态
    exitMaskMode();
    renderMasks();

    if (state.isPdf) {
        // 先确定 worker 地址（服务器 MIME 异常时自动改用 Blob 方式）
        pdfjsLib.GlobalWorkerOptions.workerSrc = await resolveWorkerUrl();
        loadPdf(file);
    } else {
        loadImage(file);
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
 *   1. **内联源码**（首选）：构建时把 worker 源码以 base64 打进产物，
 *      运行时解码成 Blob URL。浏览器不再需要任何 worker 请求 → ①②③ 全部消失。
 *   2. **自行 fetch + 重试**：内联不可用时（开发模式 / 依赖未安装），
 *      由我们自己 fetch worker 源码。fetch 不校验 MIME（绕开 ①），
 *      且失败可退避重试（绕开 ②）。
 *   3. **原始地址**：前两步都失败时，交回 PDF.js 自行处理。
 */
async function resolveWorkerUrl() {
    if (cachedWorkerUrl) return cachedWorkerUrl;

    // 1. 内联源码（构建版首选）：动态导入，不影响首屏体积
    const inlineUrl = await buildInlineWorkerUrl();
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
 * 用内联的 base64 源码生成 Blob URL
 *
 * 内联源码由 vite 插件在构建时以 base64 形式写入一个独立 chunk，
 * 这里用动态导入按需加载 —— 用户上传 PDF 时才下载，不拖慢首屏。
 * @returns {Promise<string|null>} Blob URL；没有内联源码时返回 null
 */
async function buildInlineWorkerUrl() {
    try {
        const mod = await import('virtual:pdf-worker-inline');
        const b64 = mod && mod.default;
        if (!b64) return null;

        // base64 → 二进制字符串 → Uint8Array → Blob
        const binary = atob(b64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return URL.createObjectURL(new Blob([bytes], { type: 'text/javascript' }));
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
 * 加载并解析 PDF 文件
 * @param {File} file 原始文件对象（失败重试时需要重新读取二进制）
 */
async function loadPdf(file) {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        state.pdfDoc = await loadingTask.promise;
        state.totalPages = state.pdfDoc.numPages;
        state.currentPage = 1;

        // 载入与首帧渲染期间不触发自动保存（用户还没做任何编辑）
        state.suppressSave = true;
        restoreSavedConfig();

        updatePageControls();
        renderThumbnails();
        await renderCurrentPage();
        state.suppressSave = false;
    } catch (error) {
        console.error('Error loading PDF:', error);
        state.suppressSave = false;
        showLoadFailure(error);
    }
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

/**
 * 加载图片文件 (作为单页文档处理)
 * @param {File} file 图片文件对象
 */
function loadImage(file) {
    const reader = new FileReader();
    reader.onload = async (e) => {
        state.fileData = e.target.result;
        state.totalPages = 1;
        state.currentPage = 1;
        state.pdfDoc = null;

        // 载入与首帧渲染期间不触发自动保存
        state.suppressSave = true;

        updatePageControls();
        // 生成简单的图片缩略图
        elements.thumbnailsPanel.innerHTML = '';
        const thumb = document.createElement('div');
        thumb.className = 'thumbnail-item active';
        const img = document.createElement('img');
        img.src = state.fileData;
        img.style.width = '100%';
        thumb.appendChild(img);
        elements.thumbnailsPanel.appendChild(thumb);

        restoreSavedConfig();

        await renderCurrentPage();
        state.suppressSave = false;
    };
    reader.readAsDataURL(file);
}
