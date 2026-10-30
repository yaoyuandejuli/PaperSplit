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
 * 浏览器对 module 脚本做**严格 MIME 校验**：只要服务器把 worker 文件当成
 * application/octet-stream（部分简易静态服务器 / 老版本 Python http.server 会这样），
 * worker 就无法加载，表现为「无法加载 PDF 文件」。
 * 这里先用一个 HEAD 请求探测服务器给出的 Content-Type：
 *  - 正常（javascript / ecmascript）→ 直接用打包好的 worker，零额外开销；
 *  - 异常 → 把源码取回来转成 Blob URL（fetch 不校验 MIME，可绕过该限制）。
 */
async function resolveWorkerUrl() {
    try {
        const res = await fetch(pdfWorkerUrl, { method: 'HEAD' });
        const type = (res.headers.get('content-type') || '').toLowerCase();
        if (type && !/javascript|ecmascript/.test(type)) {
            const blobUrl = await buildBlobWorkerUrl();
            if (blobUrl) {
                console.info(`[PDF] 服务器 MIME 类型异常（${type}），已改用 Blob 方式加载 worker`);
                return blobUrl;
            }
        }
    } catch (e) {
        // HEAD 不被支持等情况：直接用原地址，交给 PDF.js 处理
        console.warn('[PDF] 探测 worker 的 MIME 失败：', e);
    }
    return pdfWorkerUrl;
}

/**
 * 把打包好的 PDF worker 转成 Blob URL
 * fetch 不校验 MIME，因此可以绕过「服务器不认识 .js / .mjs」导致的 module 脚本加载失败。
 * @returns {Promise<string|null>} Blob URL；取不到时返回 null
 */
async function buildBlobWorkerUrl() {
    try {
        const res = await fetch(pdfWorkerUrl);
        if (!res.ok) return null;
        const source = await res.text();
        if (!source) return null;
        return URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
    } catch (e) {
        console.warn('[PDF] 无法生成 Blob 版 worker：', e);
        return null;
    }
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
        alert(
            '无法加载 PDF 文件。\n\n' +
            '常见原因：本地部署的静态服务器没有正确设置 MIME 类型，' +
            '导致 PDF.js 的 worker 无法加载。\n' +
            '解决办法：改用 `npx serve .` 启动本地服务，' +
            '或确认服务器把 .js 文件返回为 application/javascript。'
        );
    }
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
