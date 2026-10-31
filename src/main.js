// 本地字体：图标与正文字体随应用打包，离线可用、无 CDN 依赖
import 'material-icons/iconfont/filled.css';
import '@fontsource/outfit/400.css';
import '@fontsource/outfit/500.css';
import '@fontsource/outfit/600.css';
import '@fontsource/outfit/700.css';

import { elements } from './dom.js';
import { state } from './state.js';
import { handleFileUpload, setImportMode } from './file-handler.js';
import { toggleFileList } from './file-list.js';
import { openSortPanel, closeSortPanel, applySort, resetSort } from './page-sort.js';
import { changePage, renderCurrentPage, rotatePage, setPageRotation, resetRotation, applyRotationToCurrent, applyRotationToAll } from './viewer.js';
import { toggleSealLine, setSealSide, applySplitToCurrent, applySplitToAll, applySealToCurrent, applySealToAll, addSplitLine, setSplitColumns, toggleRemoveSplitMode, exitRemoveSplitMode, resetSplitLayout, resetSealAreas, getPageConfig, syncFineStepperUI } from './editor.js';
import { toggleMaskMode, toggleBrushMode, removeAllErases, applyErases, undoErase, initMaskInteractions, exitMaskMode, isMaskMode } from './mask-editor.js';
import { exportPdf } from './exporter.js';
import {
    setCropZoomDraft, stepCropZoom, resetCropZoom, applyCropZoom, applyCropZoomToAll,
    syncCropZoomUI, renderCropPreview, scheduleCropPreview, STEP
} from './crop-adjust.js';
import { saveEditConfig, scheduleSave, clearEditConfig } from './storage.js';
import { initMiniPreview, scheduleMiniPreview } from './mini-preview.js';
import { showToast } from './toast.js';

/**
 * 微调角度：节流调度
 * 拖动滑块时 input 事件非常密集（每秒可达数十次），而每次都会完整重渲染
 * PDF 页面（重新取页、绘制、擦除重绘），连续触发会造成明显卡顿。
 * 这里限制为最多每 50ms 重渲染一次，并保证最后一次一定生效（尾随执行）。
 */
const FINE_ROTATE_MIN_INTERVAL = 50;   // ms
let fineRotateLastRun = 0;
let fineRotateTimer = 0;

/** 把当前微调滑块的角度应用到页面（已是目标角度时跳过，避免重复渲染） */
function applyFineRotation() {
    const target = state.rotationBase + Number(elements.rotateFineSlider.value);
    const current = getPageConfig(state.currentPage).rotation || 0;
    // 比较两个角度是否等价（0 与 360 同义）
    const diff = Math.abs((((target - current) % 360) + 540) % 360 - 180);
    if (diff < 0.01) return;
    // 微调 = 整转基准 + 滑块偏移
    setPageRotation(target);
}

function scheduleFineRotation() {
    const page = state.currentPage;
    const wait = FINE_ROTATE_MIN_INTERVAL - (Date.now() - fineRotateLastRun);
    if (wait <= 0) {
        fineRotateLastRun = Date.now();
        applyFineRotation();
    } else if (!fineRotateTimer) {
        fineRotateTimer = setTimeout(() => {
            fineRotateTimer = 0;
            // 期间若已翻页，本次任务作废（否则会用上一页的偏移去转新页）
            if (state.currentPage !== page) return;
            fineRotateLastRun = Date.now();
            applyFineRotation();
        }, wait);
    }
}

/**
 * 「− / +」按钮：按滑块步长逐格微调当前页角度
 * @param {number} delta 步进方向（+1 增加 / -1 减少）
 */
function stepFineRotation(delta) {
    const slider = elements.rotateFineSlider;
    if (!slider || slider.disabled) return;

    const step = Number(slider.step) || 0.5;
    const min = Number(slider.min);
    const max = Number(slider.max);

    // 对齐到步长网格，避免浮点误差累积
    let value = Math.round((Number(slider.value) + delta * step) / step) * step;
    value = Math.max(min, Math.min(max, value));

    slider.value = String(value);
    if (elements.rotateFineVal) {
        elements.rotateFineVal.textContent = (value > 0 ? '+' : '') + value;
    }

    // 点击是离散操作，立即应用（不必等滑块拖动的节流窗口）
    if (fineRotateTimer) { clearTimeout(fineRotateTimer); fineRotateTimer = 0; }
    fineRotateLastRun = Date.now();
    applyFineRotation();

    syncFineStepperUI();
}

/**
 * 编辑配置自动保存
 * 任何配置变更（分割线 / 密封线 / 旋转 / 裁剪比例 / 擦除）后防抖写盘，
 * 数据只存在本机浏览器，刷新或重新打开同一文件时会自动恢复。
 */
function persistEditConfig() {
    if (state.suppressSave || state.saveDisabled) return;
    if (!state.fileFingerprint || !state.totalPages) return;
    scheduleSave(() => {
        saveEditConfig(state.fileFingerprint, state.fileName, state.pagesData, state.totalPages);
    });
}

/**
 * 立即落盘（不做防抖）
 * 页面切到后台或即将关闭时调用，避免防抖窗口内的最后一点改动丢失
 */
function persistEditConfigNow() {
    if (state.suppressSave || state.saveDisabled) return;
    if (!state.fileFingerprint || !state.totalPages) return;
    saveEditConfig(state.fileFingerprint, state.fileName, state.pagesData, state.totalPages);
}

/**
 * 操作指南：点击展开 / 收起（可访问的 disclosure 控件）
 * - 默认收起：内容带 hidden 属性，仅显示标题与「点击展开」提示
 * - 点击后展开：同步 aria-expanded，并更新提示文案与箭头方向
 * - 使用原生 button，天然支持键盘 Enter / Space 及屏幕阅读器
 */
function initGuideToggle() {
    const toggle = document.getElementById('guideToggle');
    const content = document.getElementById('guideContent');
    const hint = document.getElementById('guideHint');
    if (!toggle || !content) return;

    const setExpanded = (expanded) => {
        toggle.setAttribute('aria-expanded', String(expanded));
        content.hidden = !expanded;
        if (hint) hint.textContent = expanded ? '点击收起' : '点击展开';
    };

    toggle.addEventListener('click', () => {
        setExpanded(toggle.getAttribute('aria-expanded') !== 'true');
    });

    // 初始状态与 HTML 保持一致（收起）
    setExpanded(false);
}

/**
 * 初始化所有事件监听器
 */
function initEventListeners() {
    initGuideToggle();

    // 文件选择：支持多选
    //   「选择文件」「更换文件」→ 替换现有集合
    //   「+ 添加」→ 追加到末尾（多文件时才显示）
    elements.uploadBtn.addEventListener('click', () => {
        setImportMode('replace');
        elements.fileInput.click();
    });
    if (elements.changeFileBtn) {
        elements.changeFileBtn.addEventListener('click', () => {
            setImportMode('replace');
            elements.fileInput.click();
        });
    }
    if (elements.addFilesBtn) {
        elements.addFilesBtn.addEventListener('click', () => {
            setImportMode('append');
            elements.fileInput.click();
        });
    }
    // 手机端：点击「已导入文件」标题展开 / 收起文件清单
    if (elements.fileListToggle) {
        elements.fileListToggle.addEventListener('click', toggleFileList);
    }
    elements.fileInput.addEventListener('change', handleFileUpload);

    // 导出前手动排序
    if (elements.openSortBtn) {
        elements.openSortBtn.addEventListener('click', openSortPanel);
    }
    if (elements.sortPanelClose) {
        elements.sortPanelClose.addEventListener('click', closeSortPanel);
    }
    if (elements.sortPanelCancel) {
        elements.sortPanelCancel.addEventListener('click', closeSortPanel);
    }
    if (elements.sortPanelMask) {
        elements.sortPanelMask.addEventListener('click', closeSortPanel);
    }
    if (elements.sortPanelApply) {
        elements.sortPanelApply.addEventListener('click', applySort);
    }
    if (elements.sortPanelReset) {
        elements.sortPanelReset.addEventListener('click', resetSort);
    }
    // Esc 关闭排序面板
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && elements.sortPanel && !elements.sortPanel.hidden) {
            closeSortPanel();
        }
    });

    elements.prevPageBtn.addEventListener('click', () => changePage(state.currentPage - 1));
    elements.nextPageBtn.addEventListener('click', () => changePage(state.currentPage + 1));

    elements.toggleSealLineBtn.addEventListener('click', toggleSealLine);
    elements.sealLeftBtn.addEventListener('click', () => setSealSide('left'));
    elements.sealRightBtn.addEventListener('click', () => setSealSide('right'));
    elements.addSplitBtn.addEventListener('click', addSplitLine);

    // 「去除分割线」：进入选择模式 → 点击分割线即直接删除
    // 与「擦除内容」的框选/涂抹模式互斥：开启前先退出擦除模式
    elements.removeSplitBtn.addEventListener('click', () => {
        if (!state.removeSplitMode) exitMaskMode();
        toggleRemoveSplitMode();
    });

    // 「重置」：把当前页分割线恢复为默认（一条中线，一分为二）
    elements.resetDefaultsBtn.addEventListener('click', resetSplitLayout);

    // 密封线「重置」：清除当前页所有密封区域（不影响分割线）
    elements.resetSealBtn.addEventListener('click', resetSealAreas);

    // 分栏预设：两栏（一分为二）/ 三栏（一分为三）
    elements.splitHalfBtn.addEventListener('click', () => setSplitColumns(2));
    elements.splitThirdBtn.addEventListener('click', () => setSplitColumns(3));

    // 「擦除内容」：框选 / 涂抹，导出时真正擦除该处内容
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
    elements.applyRotateCurrentBtn.addEventListener('click', applyRotationToCurrent);
    elements.applyRotateAllBtn.addEventListener('click', applyRotationToAll);

    // 微调纠偏滑块两侧的「− / +」：逐 0.5° 增减当前页角度
    elements.rotateFineMinusBtn.addEventListener('click', () => stepFineRotation(-1));
    elements.rotateFinePlusBtn.addEventListener('click', () => stepFineRotation(1));

    // 「裁剪后调整」：调整裁剪结果在成品页面上的大小
    elements.cropZoomOutBtn.addEventListener('click', () => stepCropZoom(-STEP));
    elements.cropZoomInBtn.addEventListener('click', () => stepCropZoom(STEP));
    elements.cropZoomResetBtn.addEventListener('click', resetCropZoom);
    elements.cropZoomSlider.addEventListener('input', () => {
        setCropZoomDraft(Number(elements.cropZoomSlider.value) / 100);
    });
    elements.applyCropZoomBtn.addEventListener('click', applyCropZoom);
    elements.applyCropZoomAllBtn.addEventListener('click', applyCropZoomToAll);

    // 分割线 / 密封线 / 方向变化后刷新「修改后文件预览」
    document.addEventListener('papersplit:config-changed', scheduleCropPreview);
    // 手机端置顶迷你预览同步刷新（下滑调参数时顶部能看到当前效果）
    document.addEventListener('papersplit:config-changed', scheduleMiniPreview);
    // 编辑配置变更后自动落盘（仅存本机 localStorage），刷新后可自动恢复
    document.addEventListener('papersplit:config-changed', persistEditConfig);
    document.addEventListener('papersplit:page-repaint', persistEditConfig);
    // 「应用 / 擦除」后需要重绘画布：让画布直接显示擦除后的内容（或恢复原始画面）
    document.addEventListener('papersplit:page-repaint', () => {
        if (state.totalPages) renderCurrentPage();
    });
    // 导出模式变化后，预览需按新模式重绘
    elements.exportFitSelect.addEventListener('change', renderCropPreview);
    elements.rotateFineSlider.addEventListener('input', () => {
        const offset = Number(elements.rotateFineSlider.value);
        if (elements.rotateFineVal) {
            elements.rotateFineVal.textContent = (offset > 0 ? '+' : '') + offset;
        }
        // 滑到两端时同步「− / +」按钮的禁用状态
        syncFineStepperUI();
        scheduleFineRotation();
    });
    // 松手时立即应用最终角度（不必等节流窗口）
    elements.rotateFineSlider.addEventListener('change', () => {
        if (fineRotateTimer) { clearTimeout(fineRotateTimer); fineRotateTimer = 0; }
        fineRotateLastRun = Date.now();
        applyFineRotation();
    });
    // 编辑工具 · 应用：当前页 / 所有页
    elements.applySplitCurrentBtn.addEventListener('click', applySplitToCurrent);
    elements.applyToAllBtn.addEventListener('click', applySplitToAll);
    // 密封线 · 应用：当前页 / 所有页
    elements.applySealCurrentBtn.addEventListener('click', applySealToCurrent);
    elements.sealApplyAllBtn.addEventListener('click', applySealToAll);
    elements.exportBtn.addEventListener('click', exportPdf);
    // 清除本文件的保存记录（并停止该文件的自动保存）
    elements.clearSaveBtn.addEventListener('click', () => {
        if (!state.fileFingerprint) return;
        clearEditConfig(state.fileFingerprint);
        state.saveDisabled = true;
        showToast('已清除本文件的保存记录，之后不再自动保存', 'success');
    });

    window.addEventListener('resize', handleResize);

    // 页面切到后台或即将关闭时立即落盘，避免防抖窗口内的改动丢失
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') persistEditConfigNow();
    });
    window.addEventListener('beforeunload', persistEditConfigNow);

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
        // 拖拽上传 = 替换现有集合
        setImportMode('replace');
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
        if (state.totalPages) {
            renderCurrentPage();
        }
    }, 150);
}

// 启动程序
initEventListeners();
initMiniPreview();
syncCropZoomUI();
