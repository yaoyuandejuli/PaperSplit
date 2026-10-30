import { state } from './state.js';
import { elements } from './dom.js';
import { getPageConfig } from './editor.js';
import { drawEraseStroke } from './utils.js';

/**
 * 「擦除内容」模块
 *
 * 两种擦除方式：
 *  1) 框选擦除：拖拽出矩形区域，导出时把该区域覆盖为白色
 *  2) 涂抹擦除：按住鼠标/手指涂抹，笔迹经过的内容在导出时被擦除（覆盖为白色）
 *
 * 两阶段工作流：
 *  - 标记阶段：框选 / 涂抹产生的标记以红色半透明显示在画布上（尚未真正擦除）
 *  - 应用阶段：点「应用」→ 标记被真正擦除，画布上【直接显示擦除后的内容】（该处变白）
 *  - 「擦除」按钮：清除全部标记与已应用的擦除，恢复原始画面
 *
 * 导出 PDF 每页为位图（JPEG），因此擦除后的内容无法被提取或还原。
 *
 * 数据结构（均位于「旋转后的显示坐标系」，与分割线/密封线同一坐标系）：
 *  - config.masks   = [{ id, x, y, w, h, applied }]        框选区域，比例坐标
 *  - config.strokes = [{ id, points: [[x,y],...], width, applied }] 涂抹笔迹，比例坐标
 *    - points 为归一化坐标 (0~1)，width 为笔刷直径占页面宽度的比例
 *  - config.eraseOps = [{ type: 'mark'|'apply', id | ids }] 操作栈（供「撤销」回退）
 */

export const MODE_OFF = 'off';     // 未开启
export const MODE_RECT = 'rect';   // 框选模式
export const MODE_BRUSH = 'brush'; // 涂抹模式

let maskMode = MODE_OFF;   // 当前模式
let drag = null;           // 当前拖拽 / 涂抹状态
let interactionsBound = false;
let eraseIdSeq = 0;        // 擦除项序号（用于「撤销」定位最近一次操作）
let brushCursorEl = null;  // 涂抹模式的圆形光标

/** 编辑器中的「标记」配色（红色半透明），导出时统一为白色 */
const MARK_STYLE = {
    fillStyle: 'rgba(239, 68, 68, 0.32)',
    lineStyle: 'rgba(220, 38, 38, 0.85)'
};

/* ------------------------------------------------------------------ */
/* 模式与状态                                                          */
/* ------------------------------------------------------------------ */

/** 是否处于擦除模式（框选或涂抹） */
export function isMaskMode() {
    return maskMode !== MODE_OFF;
}

/** 切换框选模式 */
export function toggleMaskMode() {
    maskMode = (maskMode === MODE_RECT) ? MODE_OFF : MODE_RECT;
    afterModeChange();
}

/** 切换涂抹模式 */
export function toggleBrushMode() {
    maskMode = (maskMode === MODE_BRUSH) ? MODE_OFF : MODE_BRUSH;
    afterModeChange();
}

/** 退出擦除模式 */
export function exitMaskMode() {
    if (maskMode === MODE_OFF) return;
    maskMode = MODE_OFF;
    afterModeChange();
}

/** 模式切换后的统一收尾 */
function afterModeChange() {
    updateMaskUI();
    renderMasks();
    updateBrushCursor(null);
}

/** 生成一个全局递增的擦除项序号 */
function nextEraseId() {
    eraseIdSeq += 1;
    return eraseIdSeq;
}

/* ------------------------------------------------------------------ */
/* 数据操作                                                            */
/* ------------------------------------------------------------------ */

/**
 * 清空当前页所有擦除内容（框选 + 涂抹），并恢复已应用的擦除（还原原始画面）
 * 对应界面上的「擦除」按钮
 */
export function removeAllErases() {
    const cfg = getPageConfig(state.currentPage);
    cfg.masks = [];
    cfg.strokes = [];
    cfg.eraseOps = [];
    renderMasks();
    dispatchConfigChanged();
    requestRepaint();
}

/**
 * 应用当前所有「待应用」的标记：把标记真正擦除，画布上直接显示擦除后的内容
 * 导出时这些区域同样被擦除（标记即擦除意图）
 */
export function applyErases() {
    const cfg = getPageConfig(state.currentPage);

    const pendingMasks = cfg.masks.filter(m => !m.applied);
    const pendingStrokes = cfg.strokes.filter(s => !s.applied);
    if (!pendingMasks.length && !pendingStrokes.length) return;

    const ids = [];
    for (const m of pendingMasks) {
        m.applied = true;
        ids.push(m.id);
    }
    for (const s of pendingStrokes) {
        s.applied = true;
        ids.push(s.id);
    }
    cfg.eraseOps.push({ type: 'apply', ids });

    renderMasks();
    dispatchConfigChanged();
    requestRepaint();
    flashApplied();
}

/** 应用后按钮的短暂反馈 */
function flashApplied() {
    const btn = elements.maskApplyBtn;
    if (!btn) return;
    const original = btn.innerHTML;
    btn.innerHTML = '<span class="material-icons">check_circle</span> 已应用';
    btn.classList.add('applied-state');
    setTimeout(() => {
        btn.innerHTML = original;
        btn.classList.remove('applied-state');
    }, 1400);
}

/** 请求重新绘制页面画布（用于把擦除效果真正画到画布上 / 还原） */
function requestRepaint() {
    document.dispatchEvent(new CustomEvent('papersplit:page-repaint'));
}

/**
 * 撤销上一次擦除操作（标记或「应用」，按操作先后顺序回退）
 */
export function undoErase() {
    const cfg = getPageConfig(state.currentPage);

    const op = cfg.eraseOps.pop();

    if (op) {
        if (op.type === 'mark') {
            // 回退：删除该标记
            const arr = op.kind === 'rect' ? cfg.masks : cfg.strokes;
            const i = arr.findIndex(x => x.id === op.id);
            if (i >= 0) arr.splice(i, 1);
        } else if (op.type === 'apply') {
            // 回退：把已应用的标记退回「待应用」（画布恢复红色标记）
            for (const id of op.ids) {
                const m = cfg.masks.find(x => x.id === id);
                if (m) m.applied = false;
                const s = cfg.strokes.find(x => x.id === id);
                if (s) s.applied = false;
            }
        }
    } else {
        // 兼容无操作栈的旧数据：按 id 回退最近一次标记
        let target = null;
        for (const m of cfg.masks) {
            if (!target || (m.id || 0) > (target.item.id || 0)) target = { kind: 'rect', item: m };
        }
        for (const s of cfg.strokes) {
            if (!target || (s.id || 0) > (target.item.id || 0)) target = { kind: 'stroke', item: s };
        }
        if (!target) return;

        const arr = target.kind === 'rect' ? cfg.masks : cfg.strokes;
        const idx = arr.indexOf(target.item);
        if (idx >= 0) arr.splice(idx, 1);
    }

    renderMasks();
    dispatchConfigChanged();
    requestRepaint();
}

/** 当前页擦除内容的统计 { rects, strokes, total, applied, pending } */
function getEraseCount() {
    const cfg = state.pagesData[state.currentPage];
    const masks = (cfg && Array.isArray(cfg.masks)) ? cfg.masks : [];
    const strokes = (cfg && Array.isArray(cfg.strokes)) ? cfg.strokes : [];
    let applied = 0;
    for (const m of masks) if (m.applied) applied++;
    for (const s of strokes) if (s.applied) applied++;
    const total = masks.length + strokes.length;
    return {
        rects: masks.length,
        strokes: strokes.length,
        total,
        applied,
        pending: total - applied
    };
}

/* ------------------------------------------------------------------ */
/* 渲染                                                                */
/* ------------------------------------------------------------------ */

/**
 * 渲染当前页的擦除标记（覆盖在画布之上）
 *  - 待应用（applied=false）：红色半透明标记，可拖动 / 删除
 *  - 已应用（applied=true） ：已真正擦除到画布上，此处仅保留浅色轮廓提示位置
 */
export function renderMasks() {
    const wrapper = elements.canvasWrapper;
    if (!wrapper) return;

    // 清理旧的矩形框
    wrapper.querySelectorAll('.mask-rect').forEach(e => e.remove());

    const cfg = state.pagesData[state.currentPage];
    const masks = (cfg && Array.isArray(cfg.masks)) ? cfg.masks : [];
    const strokes = (cfg && Array.isArray(cfg.strokes)) ? cfg.strokes : [];

    masks.forEach((m, idx) => {
        const el = document.createElement('div');
        el.className = m.applied ? 'mask-rect applied' : 'mask-rect';
        el.dataset.maskIndex = String(idx);
        el.title = m.applied ? '已应用擦除（如需修改请先撤销）' : '拖动可移动位置，点击可删除';
        el.style.left = `${m.x * 100}%`;
        el.style.top = `${m.y * 100}%`;
        el.style.width = `${m.w * 100}%`;
        el.style.height = `${m.h * 100}%`;
        wrapper.appendChild(el);
    });

    renderStrokeOverlay(strokes);
    updateMaskUI();
}

/**
 * 把「已应用」的擦除区域真正画到页面画布上（白色覆盖），
 * 使画布直接显示擦除后的内容（所见即所得，与导出一致）。
 *
 * @param {HTMLCanvasElement} pageCanvas 页面画布（已旋转）
 */
export function renderAppliedErasures(pageCanvas) {
    if (!pageCanvas) return;

    const cfg = state.pagesData[state.currentPage];
    if (!cfg) return;

    const masks = (Array.isArray(cfg.masks)) ? cfg.masks : [];
    const strokes = (Array.isArray(cfg.strokes)) ? cfg.strokes : [];

    const appliedMasks = masks.filter(m => m.applied);
    const appliedStrokes = strokes.filter(s => s.applied);
    if (!appliedMasks.length && !appliedStrokes.length) return;

    const ctx = pageCanvas.getContext('2d');
    const W = pageCanvas.width;
    const H = pageCanvas.height;

    // 框选区域：白色覆盖
    ctx.save();
    ctx.fillStyle = '#ffffff';
    for (const m of appliedMasks) {
        ctx.fillRect(m.x * W, m.y * H, m.w * W, m.h * H);
    }
    ctx.restore();

    // 涂抹笔迹：白色描边覆盖
    for (const s of appliedStrokes) {
        drawEraseStroke(ctx, s, W, H, { fillStyle: '#ffffff' });
    }
}

/**
 * 渲染涂抹笔迹图层（与页面画布同尺寸的透明画布）
 */
function renderStrokeOverlay(strokes) {
    const wrapper = elements.canvasWrapper;
    if (!wrapper) return;

    const pageCanvas = wrapper.querySelector('.page-canvas');
    const W = pageCanvas ? pageCanvas.width : Math.round(wrapper.clientWidth);
    const H = pageCanvas ? pageCanvas.height : Math.round(wrapper.clientHeight);

    let overlay = wrapper.querySelector('.mask-overlay-canvas');
    if (!overlay) {
        overlay = document.createElement('canvas');
        overlay.className = 'mask-overlay-canvas';
        wrapper.appendChild(overlay);
    }
    overlay.width = Math.max(1, W);
    overlay.height = Math.max(1, H);
    overlay.style.width = `${overlay.width}px`;
    overlay.style.height = `${overlay.height}px`;

    const ctx = overlay.getContext('2d');
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    // 已完成的笔迹：待应用=红色标记；已应用=极淡轮廓（内容已被真正擦除）
    for (const s of strokes) {
        if (s.applied) {
            drawEraseStroke(ctx, s, overlay.width, overlay.height, {
                fillStyle: 'rgba(148, 163, 184, 0.10)',
                lineStyle: 'rgba(100, 116, 139, 0.45)'
            });
        } else {
            drawEraseStroke(ctx, s, overlay.width, overlay.height, MARK_STYLE);
        }
    }
    // 正在涂抹的笔迹（实时预览）
    if (drag && drag.type === 'brush' && drag.stroke) {
        drawEraseStroke(ctx, drag.stroke, overlay.width, overlay.height, MARK_STYLE);
    }
}

/** 同步按钮与提示文案 */
function updateMaskUI() {
    const rectBtn = elements.maskToggleBtn;
    if (rectBtn) {
        const active = maskMode === MODE_RECT;
        rectBtn.classList.toggle('active-state', active);
        rectBtn.innerHTML = active
            ? '<span class="material-icons">check_circle</span> 框选中'
            : '<span class="material-icons">crop_square</span> 框选擦除';
    }

    const brushBtn = elements.maskBrushBtn;
    if (brushBtn) {
        const active = maskMode === MODE_BRUSH;
        brushBtn.classList.toggle('active-state', active);
        brushBtn.innerHTML = active
            ? '<span class="material-icons">check_circle</span> 涂抹中'
            : '<span class="material-icons">brush</span> 涂抹擦除';
    }

    const wrapper = elements.canvasWrapper;
    if (wrapper) {
        wrapper.classList.toggle('masking-mode', maskMode !== MODE_OFF);
        wrapper.classList.toggle('brushing-mode', maskMode === MODE_BRUSH);
    }

    const { rects, strokes, total, applied, pending } = getEraseCount();

    // 「应用」：有待应用的标记时才可点
    if (elements.maskApplyBtn) elements.maskApplyBtn.disabled = pending === 0;
    // 「擦除」：有任何标记（含已应用）时才可点
    if (elements.clearMasksBtn) elements.clearMasksBtn.disabled = total === 0;
    if (elements.maskUndoBtn) elements.maskUndoBtn.disabled = total === 0;

    if (elements.maskCount) {
        if (!total) {
            elements.maskCount.textContent = '尚未擦除';
        } else {
            const parts = [];
            if (rects) parts.push(`框选 ${rects} 处`);
            if (strokes) parts.push(`涂抹 ${strokes} 处`);
            let text = parts.join(' · ');
            if (applied) text += `（已应用 ${applied} 处）`;
            elements.maskCount.textContent = text;
        }
    }

    // 笔刷大小显示
    const pct = Math.round(state.brushSize * 100);
    if (elements.maskBrushVal) elements.maskBrushVal.textContent = pct;
    if (elements.maskBrushSlider && Number(elements.maskBrushSlider.value) !== pct) {
        elements.maskBrushSlider.value = pct;
    }
}

/** 通知外部：配置已变更，「裁剪结果预览」需重绘 */
function dispatchConfigChanged() {
    document.dispatchEvent(new CustomEvent('papersplit:config-changed'));
}

/* ------------------------------------------------------------------ */
/* 交互：框选新建 / 拖动 / 点击删除 / 涂抹绘制                          */
/* ------------------------------------------------------------------ */

/** 初始化画布上的交互（只绑定一次） */
export function initMaskInteractions() {
    if (interactionsBound) return;
    const wrapper = elements.canvasWrapper;
    if (!wrapper) return;
    interactionsBound = true;

    wrapper.addEventListener('mousedown', onPointerDown);
    wrapper.addEventListener('touchstart', onTouchStart, { passive: false });

    document.addEventListener('mousemove', onPointerMove);
    document.addEventListener('mouseup', onPointerUp);
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd);
    document.addEventListener('mouseleave', () => updateBrushCursor(null));
}

function onPointerDown(e) {
    if (e.button !== 0) return;
    if (maskMode === MODE_BRUSH) {
        startBrush(e.clientX, e.clientY);
    } else if (maskMode === MODE_RECT) {
        startRect(e.clientX, e.clientY, e.target);
    }
}

function onTouchStart(e) {
    if (e.touches.length !== 1) return;
    if (maskMode === MODE_BRUSH) {
        startBrush(e.touches[0].clientX, e.touches[0].clientY);
    } else if (maskMode === MODE_RECT) {
        startRect(e.touches[0].clientX, e.touches[0].clientY, e.target);
    }
}

/** 把屏幕坐标换算为页面比例坐标 */
function toPageRatio(clientX, clientY) {
    const rect = elements.canvasWrapper.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
        x: clamp01((clientX - rect.left) / rect.width),
        y: clamp01((clientY - rect.top) / rect.height)
    };
}

/**
 * 开始一次框选拖拽
 */
function startRect(clientX, clientY, target) {
    if (!state.totalPages) return; // 未载入文件

    const p = toPageRatio(clientX, clientY);
    if (!p) return;

    const maskEl = target && target.closest ? target.closest('.mask-rect') : null;

    if (maskEl) {
        // 命中已有遮盖：拖动=移动，单击=删除
        const idx = Number(maskEl.dataset.maskIndex);
        const cfg = getPageConfig(state.currentPage);
        const m = cfg.masks[idx];
        if (!m) return;
        // 已应用的标记不可再编辑，需先「撤销」
        if (m.applied) return;
        drag = {
            type: 'move', idx,
            startClientX: clientX, startClientY: clientY,
            orig: { ...m },
            moved: false,
            el: maskEl
        };
    } else {
        // 空白处：新建遮盖
        const draft = document.createElement('div');
        draft.className = 'mask-rect mask-draft';
        elements.canvasWrapper.appendChild(draft);
        drag = {
            type: 'create',
            startX: p.x, startY: p.y, curX: p.x, curY: p.y,
            el: draft
        };
    }

    document.body.classList.add('mask-dragging', 'mask-rect-dragging');
}

/**
 * 开始一次涂抹
 */
function startBrush(clientX, clientY) {
    if (!state.totalPages) return;

    const p = toPageRatio(clientX, clientY);
    if (!p) return;

    drag = {
        type: 'brush',
        stroke: {
            id: nextEraseId(),
            points: [[p.x, p.y]],
            width: state.brushSize
        }
    };

    document.body.classList.add('mask-dragging');
    renderStrokeOverlay(getStrokes());
}

function onPointerMove(e) {
    updateBrushCursor(e.clientX, e.clientY);
    if (!drag) return;
    e.preventDefault();
    if (drag.type === 'brush') addBrushPoint(e.clientX, e.clientY);
    else updateRectDrag(e.clientX, e.clientY);
}

function onTouchMove(e) {
    updateBrushCursor(e.touches.length ? e.touches[0].clientX : null, e.touches.length ? e.touches[0].clientY : null);
    if (!drag) return;
    if (e.touches.length !== 1) return;
    e.preventDefault();
    if (drag.type === 'brush') addBrushPoint(e.touches[0].clientX, e.touches[0].clientY);
    else updateRectDrag(e.touches[0].clientX, e.touches[0].clientY);
}

function onPointerUp() {
    finishDrag();
}

function onTouchEnd() {
    finishDrag();
}

/** 当前页已保存的笔迹列表 */
function getStrokes() {
    const cfg = state.pagesData[state.currentPage];
    return (cfg && Array.isArray(cfg.strokes)) ? cfg.strokes : [];
}

/** 追加一个涂抹点（做最小距离去抖，避免点过多） */
function addBrushPoint(clientX, clientY) {
    const p = toPageRatio(clientX, clientY);
    if (!p || !drag || drag.type !== 'brush') return;

    const pts = drag.stroke.points;
    const last = pts[pts.length - 1];
    const dx = p.x - last[0];
    const dy = p.y - last[1];
    const minDist = 0.0025;
    if (dx * dx + dy * dy < minDist * minDist) return;

    pts.push([p.x, p.y]);
    renderStrokeOverlay(getStrokes());
}

/** 更新拖拽中的框选几何 */
function updateRectDrag(clientX, clientY) {
    const rect = elements.canvasWrapper.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    if (drag.type === 'create') {
        const px = clamp01((clientX - rect.left) / rect.width);
        const py = clamp01((clientY - rect.top) / rect.height);
        drag.curX = px;
        drag.curY = py;

        const x = Math.min(drag.startX, px);
        const y = Math.min(drag.startY, py);
        const w = Math.abs(px - drag.startX);
        const h = Math.abs(py - drag.startY);
        setBox(drag.el, x, y, w, h);
    } else if (drag.type === 'move') {
        if (Math.abs(clientX - drag.startClientX) > 3 || Math.abs(clientY - drag.startClientY) > 3) {
            drag.moved = true;
        }
        const cfg = getPageConfig(state.currentPage);
        const m = cfg.masks[drag.idx];
        if (!m) return;

        const dx = (clientX - drag.startClientX) / rect.width;
        const dy = (clientY - drag.startClientY) / rect.height;
        const nx = clamp(drag.orig.x + dx, 0, 1 - drag.orig.w);
        const ny = clamp(drag.orig.y + dy, 0, 1 - drag.orig.h);

        m.x = nx;
        m.y = ny;
        setBox(drag.el, nx, ny, drag.orig.w, drag.orig.h);
    }
}

/** 结束拖拽：框选则固化，移动则（未移动时）删除，涂抹则提交笔迹 */
function finishDrag() {
    document.body.classList.remove('mask-dragging', 'mask-rect-dragging');
    if (!drag) return;

    const d = drag;
    drag = null;

    if (d.type === 'create') {
        d.el.remove();
        const cfg = getPageConfig(state.currentPage);
        const x = Math.min(d.startX, d.curX);
        const y = Math.min(d.startY, d.curY);
        const w = Math.abs(d.curX - d.startX);
        const h = Math.abs(d.curY - d.startY);
        // 忽略过小的框（误触）
        if (w > 0.005 && h > 0.005) {
            const id = nextEraseId();
            cfg.masks.push({ id, x, y, w, h, applied: false });
            cfg.eraseOps.push({ type: 'mark', kind: 'rect', id });
        }
    } else if (d.type === 'move') {
        if (!d.moved) {
            // 单击（未拖动）=> 删除该遮盖
            const cfg = getPageConfig(state.currentPage);
            const removed = cfg.masks[d.idx];
            cfg.masks.splice(d.idx, 1);
            if (removed) {
                const oi = cfg.eraseOps.findIndex(o => o.type === 'mark' && o.id === removed.id);
                if (oi >= 0) cfg.eraseOps.splice(oi, 1);
            }
        }
    } else if (d.type === 'brush') {
        const cfg = getPageConfig(state.currentPage);
        const pts = d.stroke.points;
        // 单击（无位移）也视为一个点状擦除
        if (pts.length >= 1) {
            d.stroke.applied = false;
            cfg.strokes.push(d.stroke);
            cfg.eraseOps.push({ type: 'mark', kind: 'stroke', id: d.stroke.id });
        }
    }

    renderMasks();
    dispatchConfigChanged();
}

/* ------------------------------------------------------------------ */
/* 涂抹光标                                                            */
/* ------------------------------------------------------------------ */

/**
 * 更新涂抹光标（跟随鼠标的圆形指示器，直径 = 笔刷大小）
 * @param {number|null} clientX
 */
function updateBrushCursor(clientX, clientY) {
    const wrapper = elements.canvasWrapper;
    if (!wrapper) return;

    if (maskMode !== MODE_BRUSH || clientX == null) {
        if (brushCursorEl) brushCursorEl.style.display = 'none';
        return;
    }

    if (!brushCursorEl || !brushCursorEl.isConnected) {
        brushCursorEl = document.createElement('div');
        brushCursorEl.className = 'brush-cursor';
        wrapper.appendChild(brushCursorEl);
    }

    const rect = wrapper.getBoundingClientRect();
    const inside = clientX >= rect.left && clientX <= rect.right
        && clientY >= rect.top && clientY <= rect.bottom;
    if (!inside) {
        brushCursorEl.style.display = 'none';
        return;
    }

    const size = state.brushSize * rect.width;
    brushCursorEl.style.width = `${size}px`;
    brushCursorEl.style.height = `${size}px`;
    brushCursorEl.style.left = `${clientX - rect.left}px`;
    brushCursorEl.style.top = `${clientY - rect.top}px`;
    brushCursorEl.style.display = 'block';
}

/* ------------------------------------------------------------------ */
/* 工具                                                                */
/* ------------------------------------------------------------------ */

function setBox(el, x, y, w, h) {
    el.style.left = `${x * 100}%`;
    el.style.top = `${y * 100}%`;
    el.style.width = `${w * 100}%`;
    el.style.height = `${h * 100}%`;
}

function clamp01(v) {
    return Math.max(0, Math.min(1, v));
}

function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(v, hi));
}
