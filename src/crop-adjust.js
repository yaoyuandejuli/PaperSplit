import { state } from './state.js';
import { getPageSource } from './documents.js';
import { elements } from './dom.js';
import { getPageConfig } from './editor.js';
import { rotateCanvas, buildEraseOverlay } from './utils.js';
import { showToast } from './toast.js';
import { getSliceRanges, computePlacement, A4_WIDTH, A4_HEIGHT } from './export-geometry.js';

/**
 * 「裁剪后调整」模块
 *
 * 作用：调整【裁剪结果在成品页面上的大小】。
 *  - draft（待应用值）：实时预览用，改动不会影响导出
 *  - applied（已应用值）：写入当前页配置 config.outputScale，导出时真正生效
 *
 * 流程：调整比例 → 看清预览 → 点「应用到当前页」→ 导出 PDF
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
    if (refresh) renderCropPreview();
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
    renderCropPreview();
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
    renderCropPreview();
    document.dispatchEvent(new CustomEvent('papersplit:config-changed'));
}

/** 翻页 / 载入文件后：把待应用值同步为该页已应用值 */
export function syncCropZoomFromPage() {
    state.outputScaleDraft = getAppliedScale();
    syncCropZoomUI();
    renderCropPreview();
}

/** 同步「裁剪后调整」面板 UI */
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

/* ------------------------------------------------------------------ */
/* 修改后文件预览                                                         */
/* ------------------------------------------------------------------ */

let previewTimer = null;

/** 延迟刷新预览（避免拖动分割线时高频重绘） */
export function scheduleCropPreview() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => renderCropPreview(), 280);
}

/**
 * 渲染「修改后文件预览」：
 * 按当前导出模式 + 待应用比例，画出当前页每一栏在成品页面上的实际效果
 */
export async function renderCropPreview() {
    const cv = elements.cropPreview;
    if (!cv) return;

    const ctx = cv.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const cssW = Math.max(200, cv.clientWidth || 280);
    // 预览区最大高度（实际高度按内容自适应，不留多余空白）
    const MAX_H = 300;

    cv.width = Math.round(cssW * dpr);
    cv.height = Math.round(MAX_H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, MAX_H);

    if (!state.totalPages) return;

    let work;
    try {
        work = await renderPageContentCanvas();
    } catch (e) {
        console.error('预览渲染失败:', e);
        return;
    }
    if (!work) return;

    const cfg = getPageConfig(state.currentPage);
    const mode = elements.exportFitSelect ? elements.exportFitSelect.value : 'a4-fit';
    const draft = state.outputScaleDraft;

    // 「涂抹擦除」：生成白色擦除层，预览与导出保持一致
    // 只处理【已应用】的笔迹，未应用的属于草稿标记
    const appliedStrokes = (cfg.strokes || []).filter(s => s.applied);
    const eraseOverlay = buildEraseOverlay(
        appliedStrokes, work.width, work.height, { fillStyle: '#ffffff' }
    );

    const ranges = getSliceRanges(cfg)
        .filter(r => (r[1] - r[0]) > 0.01);
    if (!ranges.length) return;

    // 计算每一栏在成品页上的版面（成品页恒为标准 A4 210×297mm）
    const papers = ranges.map(r => {
        const widthRatio = r[1] - r[0];
        const sliceAspect = (work.width * widthRatio) / work.height;
        return { r, widthRatio, sliceAspect, pl: computePlacement(mode, sliceAspect, draft) };
    });

    // 布局：成品页按「每行 N 页」自适应换行，尽量填满预览框、让每页画得更大
    // 画面内不再绘制任何说明文字（栏序 / 成品尺寸），把空间全部留给内容本身
    const pad = 12;
    const gap = 10;
    const availW = cssW - pad * 2;
    const contentMaxH = MAX_H - pad * 2;
    const n = papers.length;

    // 成品页恒为标准 A4 竖版，宽高比固定
    const ASPECT = A4_WIDTH / A4_HEIGHT;

    // 枚举「每行放几页」，取每页画得最大的那一种（宽度与高度共同约束）
    let cols = 1;
    let paperH = 0;
    let paperW = 0;
    for (let c = 1; c <= n; c++) {
        const r = Math.ceil(n / c);
        const wLimit = (availW - gap * (c - 1)) / c;
        const hLimit = (contentMaxH - gap * (r - 1)) / r;
        const h = Math.min(wLimit / ASPECT, hLimit);
        if (h > paperH + 0.5) {
            paperH = h;
            paperW = h * ASPECT;
            cols = c;
        }
    }
    const rows = Math.ceil(n / cols);

    // 画布高度按实际内容裁掉多余空白（页数少时不再留一大片空地）
    const needH = pad * 2 + rows * paperH + (rows - 1) * gap;
    const cssH = Math.max(90, Math.min(MAX_H, Math.ceil(needH)));
    if (cv.height !== Math.round(cssH * dpr)) {
        cv.height = Math.round(cssH * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    papers.forEach((p, idx) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        const inRow = Math.min(cols, n - row * cols);
        // 每一行独立居中，最后一行页数不足时也保持居中
        const rowW = inRow * paperW + gap * (inRow - 1);
        const x = pad + Math.max(0, (availW - rowW) / 2) + col * (paperW + gap);
        const y = pad + row * (paperH + gap);

        const ppm = paperW / p.pl.pageWidth; // 毫米 -> 预览像素

        // 纸张：投影让白纸从底色中“浮起”，边界更醒目
        ctx.save();
        ctx.shadowColor = 'rgba(15, 23, 42, 0.28)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 4;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x, y, paperW, paperH);
        ctx.restore();

        // 内容（裁剪结果）绘制到纸张上，超出部分被纸张裁切 —— 与导出效果一致
        const cx = x + p.pl.drawX * ppm;
        const cy = y + p.pl.drawY * ppm;
        const cw = p.pl.drawW * ppm;
        const ch = p.pl.drawH * ppm;

        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, paperW, paperH);
        ctx.clip();

        const sx = work.width * p.r[0];
        const sw = work.width * p.widthRatio;
        ctx.drawImage(work, sx, 0, sw, work.height, cx, cy, cw, ch);

        // 「擦除内容」遮盖：与导出一致，用白色覆盖该区域（只覆盖已应用的）
        const masks = (cfg.masks || []).filter(m => m.applied);
        if (masks.length) {
            ctx.fillStyle = '#ffffff';
            for (const m of masks) {
                // 遮盖为整页比例坐标，先与本栏的源区域求交集，再映射到目标绘制区域
                const mx = m.x * work.width;
                const my = m.y * work.height;
                const mw = m.w * work.width;
                const mh = m.h * work.height;

                const ix0 = Math.max(mx, sx);
                const ix1 = Math.min(mx + mw, sx + sw);
                const iy0 = Math.max(my, 0);
                const iy1 = Math.min(my + mh, work.height);
                if (ix1 <= ix0 || iy1 <= iy0) continue;

                const tx = cx + (ix0 - sx) / sw * cw;
                const ty = cy + iy0 / work.height * ch;
                const tw = (ix1 - ix0) / sw * cw;
                const th = (iy1 - iy0) / work.height * ch;
                ctx.fillRect(tx, ty, tw, th);
            }
        }

        // 「涂抹擦除」：叠加白色笔迹层，笔迹经过处内容被真正擦除
        if (eraseOverlay) {
            ctx.drawImage(eraseOverlay, sx, 0, sw, work.height, cx, cy, cw, ch);
        }
        ctx.restore();

        // 被纸张裁切到的那几条边用红色虚线高亮（提示此处内容超出 A4 被裁掉）
        const eps = 0.5;
        const clippedLeft = cx < x - eps;
        const clippedTop = cy < y - eps;
        const clippedRight = cx + cw > x + paperW + eps;
        const clippedBottom = cy + ch > y + paperH + eps;
        if (clippedLeft || clippedTop || clippedRight || clippedBottom) {
            ctx.save();
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 3]);
            ctx.beginPath();
            if (clippedLeft) { ctx.moveTo(x, y); ctx.lineTo(x, y + paperH); }
            if (clippedTop) { ctx.moveTo(x, y); ctx.lineTo(x + paperW, y); }
            if (clippedRight) { ctx.moveTo(x + paperW, y); ctx.lineTo(x + paperW, y + paperH); }
            if (clippedBottom) { ctx.moveTo(x, y + paperH); ctx.lineTo(x + paperW, y + paperH); }
            ctx.stroke();
            ctx.restore();
        }

        // 纸张边框：加深加粗，四角加主色角标，进一步强化 A4 边界
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x + 0.75, y + 0.75, paperW - 1.5, paperH - 1.5);

        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 2.5;
        const corner = Math.max(3, Math.min(14, paperW * 0.2, paperH * 0.2));
        ctx.beginPath();
        ctx.moveTo(x + 0.75, y + corner); ctx.lineTo(x + 0.75, y + 0.75); ctx.lineTo(x + corner, y + 0.75);
        ctx.moveTo(x + paperW - corner, y + 0.75); ctx.lineTo(x + paperW - 0.75, y + 0.75); ctx.lineTo(x + paperW - 0.75, y + corner);
        ctx.moveTo(x + paperW - 0.75, y + paperH - corner); ctx.lineTo(x + paperW - 0.75, y + paperH - 0.75); ctx.lineTo(x + paperW - corner, y + paperH - 0.75);
        ctx.moveTo(x + corner, y + paperH - 0.75); ctx.lineTo(x + 0.75, y + paperH - 0.75); ctx.lineTo(x + 0.75, y + paperH - corner);
        ctx.stroke();

        // 右上角 A4 角标：明确每张纸都是标准 A4（尺寸随纸张缩放，避免小页面时溢出）
        const badgeW = Math.max(15, Math.min(26, paperW * 0.26));
        const badgeH = Math.max(9, Math.min(14, badgeW * 0.55));
        const bx = x + paperW - badgeW - 4;
        const by = y + 4;
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 1;
        if (typeof ctx.roundRect === 'function') {
            ctx.beginPath();
            ctx.roundRect(bx, by, badgeW, badgeH, 3);
            ctx.fill();
            ctx.stroke();
        } else {
            ctx.fillRect(bx, by, badgeW, badgeH);
            ctx.strokeRect(bx + 0.5, by + 0.5, badgeW - 1, badgeH - 1);
        }
        ctx.fillStyle = '#4f46e5';
        ctx.font = `bold ${Math.max(7, Math.min(10, badgeH * 0.72))}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('A4', bx + badgeW / 2, by + badgeH / 2 + 0.5);
        ctx.restore();
    });

    ctx.textAlign = 'left';
}

/**
 * 渲染当前页内容画布（已应用方向旋转），用于预览
 */
async function renderPageContentCanvas() {
    const cfg = getPageConfig(state.currentPage);
    const rotation = cfg.rotation || 0;
    const targetWidth = 900;

    const source = getPageSource(state.currentPage);
    if (!source) return null;

    let src;
    if (source.isPdf) {
        const page = await source.doc.pdfDoc.getPage(source.localPage);
        const base = page.getViewport({ scale: 1 });
        const scale = Math.min(2, targetWidth / base.width);
        const viewport = page.getViewport({ scale });
        src = document.createElement('canvas');
        src.width = viewport.width;
        src.height = viewport.height;
        await page.render({ canvasContext: src.getContext('2d'), viewport }).promise;
    } else {
        const img = new Image();
        img.src = source.doc.imageUrl;
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
        });
        const scale = Math.min(2, targetWidth / img.width);
        src = document.createElement('canvas');
        src.width = Math.round(img.width * scale);
        src.height = Math.round(img.height * scale);
        src.getContext('2d').drawImage(img, 0, 0, src.width, src.height);
    }

    return rotateCanvas(src, rotation);
}
