import { state } from './state.js';
import { elements } from './dom.js';
import { getPageConfig } from './editor.js';
import { showToast } from './toast.js';
import { requestResultPreview } from './result-preview.js';

/**
 * 「输出比例调整」模块
 *
 * 作用：调整【裁剪结果在成品页面上的大小】。
 *  - draft（待应用值）：实时预览用，改动不会影响导出
 *  - applied（已应用值）：写入当前页配置 config.outputScale，导出时真正生效
 *
 * 流程：调整比例 → 主画布自动切到「结果预览态」看效果 → 点「应用到当前页」→ 导出 PDF
 *
 * 说明：结果预览的画面由 result-preview.js 绘制在主画布上，
 * 本模块只负责比例的数值逻辑，画布形态切换由 canvas-mode.js 统一处理。
 */

export const MIN_SCALE = 0.5;   // 50%
export const MAX_SCALE = 2;     // 200%
export const STEP = 0.05;       // 5%

/** 当前页已应用的比例 */
function getAppliedScale() {
    const cfg = getPageConfig(state.currentPage);
    return typeof cfg.outputScale === 'number' && cfg.outputScale > 0 ? cfg.outputScale : 1;
}

/**
 * 设置待应用比例（draft）
 * @param {number} v 比例（0.5 ~ 2）
 * @param {boolean} refresh 是否刷新预览
 */
export function setCropZoomDraft(v, refresh = true) {
    let n = Number(v);
    if (!Number.isFinite(n)) return;
    n = Math.min(MAX_SCALE, Math.max(MIN_SCALE, n));
    state.outputScaleDraft = Math.round(n * 1000) / 1000;
    syncCropZoomUI();
    if (refresh) requestResultPreview();
}

/** 按固定步长增减待应用比例 */
export function stepCropZoom(delta) {
    setCropZoomDraft(state.outputScaleDraft + delta);
}

/** 重置待应用比例为 100% */
export function resetCropZoom() {
    setCropZoomDraft(1);
}

/**
 * 把当前待应用比例应用到当前页（写入配置，导出时生效）
 */
export function applyCropZoom() {
    const cfg = getPageConfig(state.currentPage);
    cfg.outputScale = state.outputScaleDraft;
    syncCropZoomUI();
    requestResultPreview();
    flashApplied();
    // 比例已写入配置 → 通知外部（预览刷新 + 自动保存）
    document.dispatchEvent(new CustomEvent('papersplit:config-changed'));
}

/**
 * 把当前待应用比例应用到所有页面（每页独立生效，导出时统一使用）
 */
export function applyCropZoomToAll() {
    const scale = state.outputScaleDraft;
    if (!confirm(`确定把输出比例（${Math.round(scale * 100)}%）应用到所有页面吗？`)) return;

    for (let i = 1; i <= state.totalPages; i++) {
        getPageConfig(i).outputScale = scale;
    }

    showToast(`输出比例已应用到所有页面（${Math.round(scale * 100)}%）`, 'success');
    syncCropZoomUI();
    requestResultPreview();
    document.dispatchEvent(new CustomEvent('papersplit:config-changed'));
}

/** 翻页 / 载入文件后：把待应用值同步为该页已应用值 */
export function syncCropZoomFromPage() {
    state.outputScaleDraft = getAppliedScale();
    syncCropZoomUI();
    requestResultPreview();
}

/** 同步「输出比例调整」面板 UI */
export function syncCropZoomUI() {
    const pct = Math.round(state.outputScaleDraft * 100);
    const appliedPct = Math.round(getAppliedScale() * 100);

    if (elements.cropZoomSlider) elements.cropZoomSlider.value = pct;
    if (elements.cropZoomVal) elements.cropZoomVal.textContent = pct;
    if (elements.cropZoomApplied) elements.cropZoomApplied.textContent = appliedPct + '%';

    if (elements.cropZoomState) {
        const dirty = pct !== appliedPct;
        elements.cropZoomState.textContent = dirty ? `待应用 ${pct}%` : '已应用';
        elements.cropZoomState.classList.toggle('pending', dirty);
    }
}

/** 应用后按钮的短暂反馈 */
function flashApplied() {
    const btn = elements.applyCropZoomBtn;
    if (!btn) return;
    const original = btn.innerHTML;
    btn.innerHTML = '<span class="material-icons">check_circle</span> 已应用';
    btn.classList.add('applied-state');
    setTimeout(() => {
        btn.innerHTML = original;
        btn.classList.remove('applied-state');
    }, 1400);
}
