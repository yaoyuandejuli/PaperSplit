/**
 * 结果预览渲染（Result Preview）
 *
 * 作用：在主画布的「结果预览态」下，画出当前页每一栏在成品 A4 上的实际效果。
 * 这块内容原先放在右侧面板底部（独立模块），现已上移到主画布，
 * 与「原图编辑态」共用同一个 A3 比例容器，两态互斥显示。
 *
 * 与导出共用 export-geometry.js 的几何计算：
 *  - 分割线把页面切成若干栏，每一栏对应一张 A4 成品页
 *  - 上下密封带裁掉顶部 / 底部
 *  - 擦除内容（框选 + 涂抹）与导出保持一致
 *  - 输出比例（待应用值）实时决定内容在 A4 上的大小
 *
 * 性能要点：
 *  - 页面内容画布（已旋转的原图）按「页码 + 角度」缓存，
 *    拖动输出比例滑块时只重绘版面、不重复渲染 PDF 页面 → 跟手不卡顿
 *  - 每次渲染带令牌号，过期的异步结果直接丢弃，避免闪旧图
 */

import { state } from './state.js';
import { elements } from './dom.js';
import { getPageSource } from './documents.js';
import { getPageConfig } from './editor.js';
import { rotateCanvas, buildEraseOverlay } from './utils.js';
import { getSliceRanges, getVerticalRange, computePlacement, A4_WIDTH, A4_HEIGHT } from './export-geometry.js';
import { getPageRaster, getPageSize } from './page-raster.js';

/** A4 竖版宽高比（宽 / 高） */
const ASPECT = A4_WIDTH / A4_HEIGHT;

/** 画布内边距与成品页之间的间距（CSS 像素） */
const PAD = 12;
const GAP = 10;

/** 页面内容渲染宽度（像素）：越大越清晰，也越慢 */
const RENDER_WIDTH = 1200;

/* ------------------------------------------------------------------ */
/* 页面内容画布缓存                                                     */
/* ------------------------------------------------------------------ */

/** { key, canvas } —— key = `页码|旋转角` */
let workCache = { key: '', canvas: null };

/**
 * 擦除层缓存
 *
 * 擦除层是一张与页面画布等大的透明画布，而它是**纯几何产物**：
 * 只由「本页已应用的笔迹」决定，与缩放比例、导出模式、滑块位置都无关。
 *
 * 原实现每次渲染预览都重新 buildEraseOverlay —— 也就是每帧都要
 * 新建一张全尺寸画布并把所有笔迹重画一遍。拖动输出比例滑块时
 * 每秒能触发数十次预览重绘，这部分开销纯属浪费。
 *
 * 缓存键用「页码 + 笔迹内容指纹」，笔迹一变就自动失效重建。
 */
let eraseCache = { key: '', canvas: null };

/**
 * 计算笔迹集合的指纹（用于缓存失效判断）
 * @param {Array} strokes 已应用的笔迹
 * @returns {string} 指纹字符串
 */
function strokeFingerprint(strokes) {
    if (!strokes || !strokes.length) return '';
    let s = '';
    for (const st of strokes) {
        s += st.id + ':' + (st.applied ? 1 : 0) + ':' + st.points.length + ':' + st.width + ';';
    }
    return s;
}

/**
 * 取本页的白色擦除层（带缓存）
 *
 * @param {Array} appliedStrokes 已应用的笔迹
 * @param {number} width  画布宽
 * @param {number} height 画布高
 * @returns {HTMLCanvasElement|null}
 */
function getEraseOverlay(appliedStrokes, width, height) {
    const key = `${state.currentPage}|${width}x${height}|${strokeFingerprint(appliedStrokes)}`;
    if (eraseCache.key === key && eraseCache.canvas) return eraseCache.canvas;

    const canvas = buildEraseOverlay(appliedStrokes, width, height, { fillStyle: '#ffffff' });
    eraseCache = { key, canvas };
    return canvas;
}

/**
 * 取当前页的页面内容画布（已应用方向旋转），带缓存
 * @returns {Promise<HTMLCanvasElement|null>}
 */
async function getWorkCanvas() {
    const cfg = getPageConfig(state.currentPage);
    const rotation = cfg.rotation || 0;
    const key = `${state.currentPage}|${rotation}`;

    if (workCache.key === key && workCache.canvas) return workCache.canvas;

    const canvas = await renderPageContentCanvas(RENDER_WIDTH);
    if (!canvas) return null;

    workCache = { key, canvas };
    return canvas;
}

/**
 * 渲染当前页内容画布（已应用方向旋转）
 *
 * 走共享的位图缓存：预览与主画布共用同一份「未旋转」页面位图，
 * 旋转时只做一次画布变换，不再重复渲染 PDF。
 *
 * @param {number} [targetWidth=1200] 渲染宽度（像素），越大越清晰
 */
export async function renderPageContentCanvas(targetWidth = RENDER_WIDTH) {
    const cfg = getPageConfig(state.currentPage);
    const rotation = cfg.rotation || 0;

    const source = getPageSource(state.currentPage);
    if (!source) return null;

    // 预览按固定宽度渲染（最多放大 2 倍），
    // 这样每一栏在 A4 上的成像尺寸与导出结果一致。
    // 预览是固定倍率，不做档位量化 —— 它的分辨率直接决定预览清晰度。
    const size = await getPageSize(source);
    if (!size || !(size.w > 0)) return null;
    const scale = Math.min(2, targetWidth / size.w);

    const raster = await getPageRaster(source, scale, false);
    if (!raster) return null;

    return rotateCanvas(raster.canvas, rotation);
}

/**
 * 清空页面内容缓存（重新导入文件后调用，避免用到旧页面的画面）
 */
export function clearResultPreviewCache() {
    workCache = { key: '', canvas: null };
    eraseCache = { key: '', canvas: null };
    previewReady = false;
    markPreviewReady();
}

/**
 * 标记「结果预览已绘制完成」
 * CSS 依据这个属性决定是否真的换画面 —— 未完成时保持原图可见，绝不闪白
 */
function markPreviewReady() {
    const content = elements.a3Content;
    if (content) content.dataset.previewReady = previewReady ? '1' : '0';
}



/* ------------------------------------------------------------------ */
/* 结果预览绘制                                                         */
/* ------------------------------------------------------------------ */

/** 渲染令牌：过期的异步渲染直接丢弃，防止闪旧图 */
let renderToken = 0;

/** 延迟刷新计时器（分割线拖动等高频场景） */
let previewTimer = null;

/** rAF 句柄（滑块拖动时按帧合并渲染） */
let rafId = 0;

/** 等待本次渲染完成的回调 */
let renderWaiters = [];

/** 预览层是否已经成功绘制过一次（未绘制前保持透明，避免闪白） */
let previewReady = false;

/**
 * 请求重绘结果预览（按帧合并，滑块拖动时也不卡）
 * @returns {Promise<void>} 本次绘制完成时兑现
 */
export function requestResultPreview() {
    return new Promise((resolve) => {
        renderWaiters.push(resolve);
        if (rafId) return;
        rafId = requestAnimationFrame(() => {
            rafId = 0;
            renderResultPreview().then(() => {
                const waiters = renderWaiters;
                renderWaiters = [];
                waiters.forEach(fn => fn());
            });
        });
    });
}

/**
 * 延迟刷新结果预览（避免拖动分割线时高频重绘）
 *
 * 处于「原图编辑态」时预览层是不可见的（opacity=0），
 * 这时重绘纯属浪费 —— 切到预览态时 canvas-mode.js 会主动补一次重绘。
 */
export function scheduleResultPreview() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => {
        previewTimer = null;
        if (state.canvasMode !== 'preview') return;
        requestResultPreview();
    }, 240);
}

/**
 * 渲染「结果预览」：
 * 按当前导出模式 + 待应用比例，画出当前页每一栏在成品 A4 上的实际效果
 */
export async function renderResultPreview() {
    const cv = elements.resultPreview;
    if (!cv) return;

    const myToken = ++renderToken;
    if (!state.totalPages) return;

    const work = await getWorkCanvas();
    if (!work) return;
    // 期间若已有更新的渲染在排队，本次结果作废（避免闪旧图）
    if (myToken !== renderToken) return;

    const ctx = cv.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const cssW = Math.round(cv.clientWidth || 0);
    const cssH = Math.round(cv.clientHeight || 0);
    // 容器还没有实际尺寸（文件未载入 / 元素隐藏）→ 跳过本次绘制
    if (!cssW || !cssH) return;

    cv.width = Math.round(cssW * dpr);
    cv.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    const cfg = getPageConfig(state.currentPage);
    const mode = elements.exportFitSelect ? elements.exportFitSelect.value : 'a4-fit';
    const draft = state.outputScaleDraft;

    // 「涂抹擦除」：生成白色擦除层，预览与导出保持一致
    // 只处理【已应用】的笔迹，未应用的属于草稿标记
    // 擦除层走缓存 —— 它只由笔迹决定，与缩放/模式/滑块无关，
    // 每帧重建一张全尺寸画布纯属浪费。
    const appliedStrokes = (cfg.strokes || []).filter(s => s.applied);
    const eraseOverlay = getEraseOverlay(appliedStrokes, work.width, work.height);

    const ranges = getSliceRanges(cfg)
        .filter(r => (r[1] - r[0]) > 0.01);
    if (!ranges.length) return;

    // 纵向保留区间：上下密封带（靠上 / 靠下）裁掉顶部 / 底部
    const [vStart, vEnd] = getVerticalRange(cfg);
    const vRatio = Math.max(0.0001, vEnd - vStart);
    const srcY = work.height * vStart;
    const srcH = work.height * vRatio;

    // 计算每一栏在成品页上的版面（成品页恒为标准 A4 竖版 210×297mm）
    const papers = ranges.map(r => {
        const widthRatio = r[1] - r[0];
        const sliceAspect = (work.width * widthRatio) / srcH;
        return { r, widthRatio, sliceAspect, pl: computePlacement(mode, sliceAspect, draft) };
    });

    // 布局：成品页按「每行 N 页」自适应换行，尽量填满画布、让每页画得更大
    const availW = cssW - PAD * 2;
    const availH = cssH - PAD * 2;
    const n = papers.length;

    // 枚举「每行放几页」，取每页画得最大的那一种（宽度与高度共同约束）
    let cols = 1;
    let paperH = 0;
    let paperW = 0;
    for (let c = 1; c <= n; c++) {
        const r = Math.ceil(n / c);
        const wLimit = (availW - GAP * (c - 1)) / c;
        const hLimit = (availH - GAP * (r - 1)) / r;
        const h = Math.min(wLimit / ASPECT, hLimit);
        if (h > paperH + 0.5) {
            paperH = h;
            paperW = h * ASPECT;
            cols = c;
        }
    }
    const rows = Math.ceil(n / cols);

    // 整块内容在画布内垂直居中
    const blockH = rows * paperH + GAP * (rows - 1);
    const originY = PAD + Math.max(0, (availH - blockH) / 2);

    papers.forEach((p, idx) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        const inRow = Math.min(cols, n - row * cols);
        // 每一行独立居中，最后一行页数不足时也保持居中
        const rowW = inRow * paperW + GAP * (inRow - 1);
        const x = PAD + Math.max(0, (availW - rowW) / 2) + col * (paperW + GAP);
        const y = originY + row * (paperH + GAP);

        const ppm = paperW / p.pl.pageWidth; // 毫米 -> 预览像素

        // 纸张：投影让白纸从底色中"浮起"，边界更醒目
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
        ctx.drawImage(work, sx, srcY, sw, srcH, cx, cy, cw, ch);

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
                const iy0 = Math.max(my, srcY);
                const iy1 = Math.min(my + mh, srcY + srcH);
                if (ix1 <= ix0 || iy1 <= iy0) continue;

                const tx = cx + (ix0 - sx) / sw * cw;
                const ty = cy + (iy0 - srcY) / srcH * ch;
                const tw = (ix1 - ix0) / sw * cw;
                const th = (iy1 - iy0) / srcH * ch;
                ctx.fillRect(tx, ty, tw, th);
            }
        }

        // 「涂抹擦除」：叠加白色笔迹层，笔迹经过处内容被真正擦除
        if (eraseOverlay) {
            ctx.drawImage(eraseOverlay, sx, srcY, sw, srcH, cx, cy, cw, ch);
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

    // 首次绘制成功后才让预览层显形（避免切过去是一片空白）
    if (!previewReady) {
        previewReady = true;
        markPreviewReady();
    }
}
