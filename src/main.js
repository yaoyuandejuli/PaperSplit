import { elements } from './dom.js';
import { state } from './state.js';
import { handleFileUpload } from './file-handler.js';
import { changePage, renderCurrentPage, rotatePage, setPageRotation, resetRotation } from './viewer.js';
import { toggleSealLine, applySplitToType, applySplitToAll, addSplitLine, setSplitColumns, toggleRemoveSplitMode, undoSplitRemoval, exitRemoveSplitMode, resetToDefaults } from './editor.js';
import { toggleMaskMode, toggleBrushMode, removeAllErases, applyErases, undoErase, initMaskInteractions, exitMaskMode, isMaskMode } from './mask-editor.js';
import { exportPdf } from './exporter.js';
import {
    setCropZoomDraft, stepCropZoom, resetCropZoom, applyCropZoom,
    syncCropZoomUI, renderCropPreview, scheduleCropPreview, STEP
} from './crop-adjust.js';

/**
 * 初始化所有事件监听器
 */
function initEventListeners() {
    elements.uploadBtn.addEventListener('click', () => elements.fileInput.click());
    if (elements.changeFileBtn) {
        elements.changeFileBtn.addEventListener('click', () => elements.fileInput.click());
    }
    elements.fileInput.addEventListener('change', handleFileUpload);

    elements.prevPageBtn.addEventListener('click', () => changePage(state.currentPage - 1));
    elements.nextPageBtn.addEventListener('click', () => changePage(state.currentPage + 1));

    elements.toggleSealLineBtn.addEventListener('click', toggleSealLine);
    elements.addSplitBtn.addEventListener('click', addSplitLine);

    // 「去除分割线」：进入选择模式 → 点击分割线即直接删除 → 可「撤销删除」还原
    // 与「去除内容」的框选/涂抹模式互斥：开启前先退出擦除模式
    elements.removeSplitBtn.addEventListener('click', () => {
        if (!state.removeSplitMode) exitMaskMode();
        toggleRemoveSplitMode();
    });
    elements.undoSplitBtn.addEventListener('click', undoSplitRemoval);

    // 「恢复默认」：把当前页分割线恢复两栏、取消密封线、清除撤销记录
    elements.resetDefaultsBtn.addEventListener('click', resetToDefaults);

    // 分栏预设：两栏（一分为二）/ 三栏（一分为三）
    elements.splitHalfBtn.addEventListener('click', () => setSplitColumns(2));
    elements.splitThirdBtn.addEventListener('click', () => setSplitColumns(3));

    // 「去除内容」：框选 / 涂抹，导出时真正擦除该处内容
    // 与「去除分割线」模式互斥：开启前先退出去除分割线模式
    elements.maskToggleBtn.addEventListener('click', () => {
        if (!isMaskMode()) exitRemoveSplitMode();
        toggleMaskMode();
    });
    elements.maskBrushBtn.addEventListener('click', () => {
        if (!isMaskMode()) exitRemoveSplitMode();
        toggleBrushMode();
    });
    elements.clearMasksBtn.addEventListener('click', removeAllErases);
    elements.maskApplyBtn.addEventListener('click', applyErases);
    elements.maskUndoBtn.addEventListener('click', undoErase);
    elements.maskBrushSlider.addEventListener('input', () => {
        state.brushSize = Number(elements.maskBrushSlider.value) / 100;
        // 笔刷大小变化时通知外部重绘（涂抹光标尺寸随之变化）
        document.dispatchEvent(new CustomEvent('papersplit:config-changed'));
    });
    initMaskInteractions();
    elements.rotateLeftBtn.addEventListener('click', () => rotatePage(-90));
    elements.rotateRightBtn.addEventListener('click', () => rotatePage(90));
    elements.resetRotationBtn.addEventListener('click', resetRotation);

    // 「裁剪后调整」：调整裁剪结果在成品页面上的大小
    elements.cropZoomOutBtn.addEventListener('click', () => stepCropZoom(-STEP));
    elements.cropZoomInBtn.addEventListener('click', () => stepCropZoom(STEP));
    elements.cropZoomResetBtn.addEventListener('click', resetCropZoom);
    elements.cropZoomSlider.addEventListener('input', () => {
        setCropZoomDraft(Number(elements.cropZoomSlider.value) / 100);
    });
    elements.applyCropZoomBtn.addEventListener('click', applyCropZoom);

    // 分割线 / 密封线 / 方向变化后刷新「裁剪结果预览」
    document.addEventListener('papersplit:config-changed', scheduleCropPreview);
    // 「应用 / 去除」后需要重绘画布：让画布直接显示去除后的内容（或恢复原始画面）
    document.addEventListener('papersplit:page-repaint', () => {
        if (state.pdfDoc || state.fileData) renderCurrentPage();
    });
    // 导出模式变化后，预览需按新模式重绘
    elements.exportFitSelect.addEventListener('change', renderCropPreview);
    elements.rotateFineSlider.addEventListener('input', () => {
        const offset = Number(elements.rotateFineSlider.value);
        if (elements.rotateFineVal) {
            elements.rotateFineVal.textContent = (offset > 0 ? '+' : '') + offset;
        }
        // 微调 = 整转基准 + 滑块偏移
        setPageRotation(state.rotationBase + offset);
    });
    elements.applyToTypeBtn.addEventListener('click', () => applySplitToType());
    elements.applyToAllBtn.addEventListener('click', () => applySplitToAll());
    elements.exportBtn.addEventListener('click', exportPdf);

    window.addEventListener('resize', handleResize);

    // 拖拽事件支持
    const dropZone = elements.canvasContainer;

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });

    dropZone.addEventListener('dragenter', highlight, false);
    dropZone.addEventListener('dragover', highlight, false);
    dropZone.addEventListener('dragleave', unhighlight, false);
    dropZone.addEventListener('drop', handleDrop, false);
}

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

function highlight(e) {
    elements.dragOverlay.classList.remove('hidden');
}

function unhighlight(e) {
    if (e.target === elements.dragOverlay) {
        elements.dragOverlay.classList.add('hidden');
    }
}

function handleDrop(e) {
    unhighlight(e);
    elements.dragOverlay.classList.add('hidden');

    const dt = e.dataTransfer;
    const files = dt.files;

    if (files.length > 0) {
        handleFileUpload({ target: { files: files } });
    }
}

/**
 * 处理窗口调整事件，重新渲染当前页面以适应新尺寸
 * 使用防抖，避免拖动窗口时高频触发并发渲染
 */
let resizeTimer = null;
function handleResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        if (state.pdfDoc || state.fileData) {
            renderCurrentPage();
        }
    }, 150);
}

// 启动程序
initEventListeners();
syncCropZoomUI();
