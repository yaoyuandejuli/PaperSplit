import { state } from './state.js';
import { elements } from './dom.js';
import { showToast } from './toast.js';
import { normalizeSeal, SEAL_MIN_W, SEAL_MAX_W } from './export-geometry.js';

/** 新建密封区域时的默认宽度（15%） */
const SEAL_DEFAULT_W = 0.15;

/**
 * 获取或初始化当前页面的配置
 * 结构: {
 *   splitLines: number[],                   // 分割线位置比例 (0-1)，多条 => 分栏
 *   sealRange: null | { x0, x1 },           // 密封区域（自由范围，可落在页面任意位置）
 *   rotation: 0 | 90 | 180 | 270,           // 内容方向（每页独立）
 *   outputScale: 1,                        // 裁剪后调整比例（成品页上的大小，导出时生效）
 *   masks: Array<{id,x,y,w,h,applied}>     // 框选擦除区域（比例坐标，导出时覆盖为白色）
 *   strokes: Array<{id,points,width,applied}> // 涂抹擦除笔迹（比例坐标，导出时擦除）
 *   eraseOps: Array<{type,id|ids}>         // 擦除操作栈（支持撤销「标记」与「应用」两类操作）
 * }
 * 注：splitLines / sealRange / masks / strokes 均定义在「旋转后的显示坐标系」中。
 * applied 表示该标记已被「应用」到画布（画布上直接显示擦除后的内容）。
 * @param {number} pageIndex 页面索引 (1-based)
 * @returns {Object} 页面配置对象
 */
export function getPageConfig(pageIndex) {
    if (!state.pagesData[pageIndex]) {
        state.pagesData[pageIndex] = {
            splitLines: [0.5],
            sealRange: null,
            rotation: 0,
            outputScale: 1,
            masks: [],
            strokes: [],
            eraseOps: []
        };
    }
    const cfg = state.pagesData[pageIndex];

    // 兼容旧存档：{ x, type } 形态的密封线转换为自由区域 { x0, x1 }
    if (cfg.sealLine !== undefined) {
        cfg.sealRange = normalizeSeal(cfg.sealLine);
        delete cfg.sealLine;
    }
    // 兼容旧数据（无 masks / strokes / eraseOps 字段）
    if (!Array.isArray(cfg.masks)) cfg.masks = [];
    if (!Array.isArray(cfg.strokes)) cfg.strokes = [];
    if (!Array.isArray(cfg.eraseOps)) cfg.eraseOps = [];
    // 兼容旧数据（标记没有 applied 字段）
    for (const m of cfg.masks) if (typeof m.applied !== 'boolean') m.applied = false;
    for (const s of cfg.strokes) if (typeof s.applied !== 'boolean') s.applied = false;
    return cfg;
}

/**
 * 删除分割线后安置键盘焦点，避免焦点丢失导致键盘用户"无处可去"
 * 优先下一条分割线 → 「去除分割线」按钮 → 「恢复默认」按钮
 */
function focusAfterSplitGone() {
    const next = elements.canvasWrapper && elements.canvasWrapper.querySelector('.split-line.split');
    if (next) { next.focus(); return; }
    if (elements.removeSplitBtn && !elements.removeSplitBtn.disabled) { elements.removeSplitBtn.focus(); return; }
    if (elements.resetDefaultsBtn) elements.resetDefaultsBtn.focus();
}

/**
 * 渲染「密封区域」遮罩
 * 把导出时会被裁掉的那一块用斜纹阴影标出来，让用户直观看到密封线的影响范围。
 * 区域可落在页面任意位置（左 / 中 / 右），拖动遮罩本体可整体移动。
 * @param {Object} config 当前页配置
 */
function renderSealZone(config) {
    const wrapper = elements.canvasWrapper;
    if (!wrapper) return;

    let zone = wrapper.querySelector('.seal-zone');
    const seal = normalizeSeal(config.sealRange);

    if (!seal) {
        if (zone) zone.remove();
        return;
    }

    if (!zone) {
        zone = document.createElement('div');
        zone.className = 'seal-zone';
        zone.appendChild(Object.assign(document.createElement('span'), {
            className: 'seal-zone-tag',
            textContent: '密封区'
        }));
        wrapper.appendChild(zone);
        bindSealZoneDrag(zone);
    }

    zone.style.left = `${seal.x0 * 100}%`;
    zone.style.width = `${(seal.x1 - seal.x0) * 100}%`;
    zone.title = `密封区域 ${(seal.x0 * 100).toFixed(0)}% ~ ${(seal.x1 * 100).toFixed(0)}%：拖动可整体移动，拖两侧虚线可调整范围`;
}

/**
 * 拖动遮罩本体 = 整体平移密封区域（宽度保持不变）
 * @param {HTMLElement} zone 遮罩元素
 */
function bindSealZoneDrag(zone) {
    let dragging = false;
    let startX = 0;
    let startLeft = 0;

    const onDown = (clientX) => {
        dragging = true;
        startX = clientX;
        startLeft = parseFloat(zone.style.left) || 0;
        zone.classList.add('dragging-zone');
    };

    const onMove = (clientX) => {
        if (!dragging) return;
        const cfg = getPageConfig(state.currentPage);
        const seal = normalizeSeal(cfg.sealRange);
        if (!seal) return;

        const rect = elements.canvasWrapper.getBoundingClientRect();
        if (!rect.width) return;

        const w = (seal.x1 - seal.x0) * 100;
        const left = Math.min(Math.max(startLeft + ((clientX - startX) / rect.width) * 100, 0), 100 - w);
        cfg.sealRange = { x0: left / 100, x1: left / 100 + w / 100 };
        syncSealVisuals(cfg);
    };

    const onUp = () => {
        if (!dragging) return;
        dragging = false;
        zone.classList.remove('dragging-zone');
        document.dispatchEvent(new CustomEvent('papersplit:config-changed'));
    };

    const mouseMove = (e) => { if (dragging) { e.preventDefault(); onMove(e.clientX); } };
    const touchMove = (e) => {
        if (!dragging || e.touches.length !== 1) return;
        e.preventDefault();
        onMove(e.touches[0].clientX);
    };

    zone.addEventListener('mousedown', (e) => {
        if (e.button !== 0 || state.removeSplitMode || state.sealSelectMode) return;
        e.preventDefault();
        e.stopPropagation();
        onDown(e.clientX);
        document.addEventListener('mousemove', mouseMove);
        document.addEventListener('mouseup', onUp, { once: true });
    });

    zone.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1 || state.removeSplitMode || state.sealSelectMode) return;
        e.stopPropagation();
        onDown(e.touches[0].clientX);
        document.addEventListener('touchmove', touchMove, { passive: false });
        document.addEventListener('touchend', onUp, { once: true });
    }, { passive: false });
}

/**
 * 不重建 DOM，只同步密封相关的视觉（遮罩 + 两条边界虚线 + 状态徽标）
 * 拖动过程中高频调用，避免整页重绘导致的闪烁与焦点丢失。
 * @param {Object} config 当前页配置
 */
function syncSealVisuals(config) {
    renderSealZone(config);

    const seal = normalizeSeal(config.sealRange);
    const edges = elements.canvasWrapper
        ? elements.canvasWrapper.querySelectorAll('.split-line.seal')
        : [];
    if (seal && edges.length >= 2) {
        edges[0].style.left = `${seal.x0 * 100}%`;
        edges[1].style.left = `${seal.x1 * 100}%`;
        edges[0].setAttribute('aria-valuenow', String(Math.round(seal.x0 * 100)));
        edges[1].setAttribute('aria-valuenow', String(Math.round(seal.x1 * 100)));
    }
    updateSealUI(config);
}

/**
 * 更新密封线状态徽标与贴边按钮
 * @param {Object} config 当前页配置
 */
function updateSealUI(config) {
    const seal = normalizeSeal(config.sealRange);
    const chip = elements.sealStatus;
    if (chip) {
        if (seal) {
            const pct = (v) => `${Math.round(v * 100)}%`;
            chip.textContent = `已启用 · ${pct(seal.x0)}~${pct(seal.x1)}`;
            chip.classList.add('seal-on');
        } else {
            chip.textContent = '未启用';
            chip.classList.remove('seal-on');
        }
    }

    // 贴左 / 贴右按钮：仅在启用后可点，并高亮当前所贴的一侧
    const enabled = !!seal;
    const atLeft = enabled && seal.x0 <= 0.001;
    const atRight = enabled && seal.x1 >= 0.999;

    if (elements.sealLeftBtn) {
        elements.sealLeftBtn.disabled = !enabled;
        elements.sealLeftBtn.classList.toggle('active-state', atLeft);
    }
    if (elements.sealRightBtn) {
        elements.sealRightBtn.disabled = !enabled;
        elements.sealRightBtn.classList.toggle('active-state', atRight);
    }
    if (elements.sealSelectBtn) {
        elements.sealSelectBtn.classList.toggle('active-state', state.sealSelectMode);
    }
}

/**
 * 启用「批量应用」按钮
 * 编辑工具（奇数页 / 偶数页 / 所有页）与密封线分区（奇数页 / 偶数页 / 所有页）共用一套逻辑。
 */
function enableBatchButtons() {
    const buttons = [
        elements.applyToOddBtn,
        elements.applyToEvenBtn,
        elements.applyToAllBtn,
        elements.sealApplyOddBtn,
        elements.sealApplyEvenBtn,
        elements.sealApplyAllBtn
    ];
    for (const btn of buttons) {
        if (btn) btn.disabled = false;
    }
}

/**
 * 渲染当前页的所有辅助线 (切割线 + 密封线)
 */
export function renderSplitLines() {
    // 清除现有的线
    elements.canvasWrapper.querySelectorAll('.split-line').forEach(e => e.remove());

    const config = getPageConfig(state.currentPage);

    // 1. 渲染所有分割线 (支持多条，支持分栏)
    config.splitLines.forEach((x, idx) => {
        createLineElement(x, 'split', idx, (newIter) => {
            config.splitLines[idx] = newIter;
        });
    });

    // 2. 渲染密封区域的两条边界（左边界 / 右边界），各自可拖动调整
    const seal = normalizeSeal(config.sealRange);
    if (seal) {
        // 边界拖动时互相约束：左边界不能越过右边界，反之亦然（至少保留最小宽度）
        createLineElement(seal.x0, 'seal', 0, (v) => {
            const cur = normalizeSeal(config.sealRange);
            if (!cur) return;
            const x0 = Math.min(Math.max(v, 0), cur.x1 - SEAL_MIN_W);
            config.sealRange = { x0, x1: cur.x1 };
            syncSealVisuals(config);
        }, (pct) => {
            const cur = normalizeSeal(config.sealRange);
            return cur ? Math.min(Math.max(pct, 0), (cur.x1 - SEAL_MIN_W) * 100) : pct;
        });

        createLineElement(seal.x1, 'seal', 1, (v) => {
            const cur = normalizeSeal(config.sealRange);
            if (!cur) return;
            const x1 = Math.min(Math.max(v, cur.x0 + SEAL_MIN_W), 1);
            config.sealRange = { x0: cur.x0, x1 };
            syncSealVisuals(config);
        }, (pct) => {
            const cur = normalizeSeal(config.sealRange);
            return cur ? Math.min(Math.max(pct, (cur.x0 + SEAL_MIN_W) * 100), 100) : pct;
        });

        // 更新按钮状态：显示取消
        elements.toggleSealLineBtn.innerHTML = '<span class="material-icons">close</span> 取消密封线';
        elements.toggleSealLineBtn.classList.add('active-state');
    } else {
        // 更新按钮状态：显示添加
        elements.toggleSealLineBtn.innerHTML = '<span class="material-icons">format_shapes</span> 去除密封线';
        elements.toggleSealLineBtn.classList.remove('active-state');
    }

    // 遮罩与状态显示
    renderSealZone(config);
    updateSealUI(config);
    // 框选模式状态随页面渲染同步（换文件时 state 被重置，这里一并清掉残留样式）
    updateSealSelectUI();

    // 启用相关操作按钮
    elements.toggleSealLineBtn.disabled = false;
    if (elements.sealSelectBtn) elements.sealSelectBtn.disabled = false;
    enableBatchButtons();

    // 分栏预设按钮高亮：两栏(1条分割线) / 三栏(2条分割线)
    if (elements.splitHalfBtn) {
        elements.splitHalfBtn.classList.toggle('active-state', config.splitLines.length === 1);
    }
    if (elements.splitThirdBtn) {
        elements.splitThirdBtn.classList.toggle('active-state', config.splitLines.length === 2);
    }

    // 同步「去除分割线」相关按钮与提示
    updateSplitRemoveUI();

    // 通知外部：分割/密封/方向已变更，「修改后文件预览」需要重绘
    document.dispatchEvent(new CustomEvent('papersplit:config-changed'));
}

/**
 * 同步「方向调整」的界面显示
 *  - 角度读数：当前页的绝对角度
 *  - 微调滑块：相对「整转基准 rotationBase」的偏移（±15°）
 *
 * 与分割线渲染解耦：调整分割不会改变角度，无需重写这两处；
 * 反之旋转也不必重建分割线 DOM。
 */
export function syncRotationUI() {
    const config = getPageConfig(state.currentPage);

    if (elements.rotateAngle) {
        elements.rotateAngle.textContent = `${config.rotation || 0}°`;
    }

    if (elements.rotateFineSlider) {
        // 计算相对基准的偏移并归一到 [-180,180]，再裁剪进微调域 ±15°
        let off = (((config.rotation || 0) - state.rotationBase + 540) % 360) - 180;
        off = Math.max(-15, Math.min(15, off));
        elements.rotateFineSlider.value = off;
        if (elements.rotateFineVal) {
            elements.rotateFineVal.textContent = (off > 0 ? '+' : '') + off;
        }
    }
}

/**
 * 创建辅助线 DOM 元素并绑定拖拽事件
 * @param {number} initialX 初始位置比例 (0-1)
 * @param {string} type 线条类型 ('split' | 'seal')
 * @param {number} index 分割线索引（仅 split 使用，用于双击删除 / 点击删除）
 * @param {Function} onUpdate 更新位置回调
 * @param {Function} [clampFn] 自定义范围钳制（输入/输出均为百分比）；不传则仅限制在 0-100%
 */
function createLineElement(initialX, type, index, onUpdate, clampFn) {
    const lineEl = document.createElement('div');
    lineEl.className = `split-line ${type}`;
    lineEl.style.left = `${initialX * 100}%`;

    // 键盘可操作：可聚焦，语义化为一维滑块（位置 0-100%）
    lineEl.tabIndex = 0;
    lineEl.setAttribute('role', 'slider');
    lineEl.setAttribute('aria-orientation', 'horizontal');
    lineEl.setAttribute('aria-valuemin', '0');
    lineEl.setAttribute('aria-valuemax', '100');
    lineEl.setAttribute('aria-valuenow', String(Math.round(initialX * 100)));
    lineEl.setAttribute('aria-valuetext', `位置 ${Math.round(initialX * 100)}%`);
    lineEl.setAttribute('aria-label', type === 'split'
        ? `分割线 ${index + 1}：左右方向键微调位置，Delete 键删除`
        : `密封区域${index === 0 ? '左' : '右'}边界：左右方向键微调位置`);
    lineEl.setAttribute('aria-valuetext',
        `位置 ${Math.round(initialX * 100)}%${type === 'seal' ? (index === 0 ? '（左边界）' : '（右边界）') : ''}`);

    if (type === 'split') {
        lineEl.title = state.removeSplitMode
            ? '点击直接删除该分割线（键盘：Enter 或 Delete 删除，方向键移动）'
            : '拖动调整位置，双击删除（键盘：Delete 删除，方向键移动）';
    } else {
        lineEl.title = `拖动调整密封区域的${index === 0 ? '左' : '右'}边界（也可直接拖动斜纹区域整体移动）`;
    }

    // 拖拽状态
    let isDragging = false;
    let startX = 0;
    let startLeft = 0; // 记录初始百分比

    // 「去除分割线」模式下的按压状态（区分「点击标记」与「拖动调整」）
    let pressIndex = -1;
    let pressClientX = 0;
    let pressClientY = 0;
    let pressMoved = false;

    /** 把位置钳制进合法范围：默认 0-100%，密封区域边界由 clampFn 进一步约束 */
    const clampPercent = (pct) => {
        const v = Math.max(0, Math.min(100, pct));
        return clampFn ? clampFn(v) : v;
    };

    /** 同步无障碍属性（读屏可播报当前位置） */
    const syncAria = (v) => {
        lineEl.setAttribute('aria-valuenow', String(Math.round(v)));
        lineEl.setAttribute('aria-valuetext', `位置 ${v.toFixed(0)}%`);
    };

    /**
     * 原地更新位置（不重建 DOM，保持键盘焦点不丢失）
     * @param {number} pct 目标百分比
     */
    const setPercent = (pct) => {
        const v = clampPercent(pct);
        lineEl.style.left = `${v}%`;
        syncAria(v);
        onUpdate(v / 100);
        // 位置变化后刷新「修改后文件预览」
        document.dispatchEvent(new CustomEvent('papersplit:config-changed'));
    };

    const onDragStart = (clientX) => {
        isDragging = true;
        startX = clientX;
        // 获取当前 style.left 的百分比数值 (去除 %)
        startLeft = parseFloat(lineEl.style.left);
        lineEl.classList.add('dragging');
    };

    const onDragMove = (clientX) => {
        if (!isDragging) return;

        const rect = elements.canvasWrapper.getBoundingClientRect();
        const deltaX = clientX - startX;
        const deltaPercent = (deltaX / rect.width) * 100;

        let newPercent = clampPercent(startLeft + deltaPercent);

        lineEl.style.left = `${newPercent}%`;
        syncAria(newPercent);
        onUpdate(newPercent / 100);
    };

    const onDragEnd = () => {
        isDragging = false;
        lineEl.classList.remove('dragging');
    };

    // Mouse Events
    const onMouseDown = (e) => {
        e.preventDefault(); // 防止选中文本
        // 「去除分割线」模式：按下仅记录，抬起时判定为「点击标记」
        if (type === 'split' && state.removeSplitMode) {
            pressIndex = index;
            pressClientX = e.clientX;
            pressClientY = e.clientY;
            pressMoved = false;
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
            return;
        }
        onDragStart(e.clientX);
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    const onMouseMove = (e) => {
        if (pressIndex >= 0) {
            if (Math.abs(e.clientX - pressClientX) > 3 || Math.abs(e.clientY - pressClientY) > 3) {
                pressMoved = true;
            }
            return;
        }
        if (!isDragging) return;
        e.preventDefault();
        onDragMove(e.clientX);
    };

    const onMouseUp = () => {
        // 「去除分割线」模式：未明显移动 => 视为点击标记
        if (pressIndex >= 0) {
            const idx = pressIndex;
            pressIndex = -1;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            if (!pressMoved) removeSplitLineAt(idx);
            return;
        }
        onDragEnd();
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    };

    // Touch Events (Mobile)
    const onTouchStart = (e) => {
        if (e.touches.length !== 1) return;
        e.preventDefault(); // 防止页面滚动
        if (type === 'split' && state.removeSplitMode) {
            pressIndex = index;
            pressClientX = e.touches[0].clientX;
            pressClientY = e.touches[0].clientY;
            pressMoved = false;
            document.addEventListener('touchmove', onTouchMove, { passive: false });
            document.addEventListener('touchend', onTouchEnd);
            return;
        }
        onDragStart(e.touches[0].clientX);
        document.addEventListener('touchmove', onTouchMove, { passive: false });
        document.addEventListener('touchend', onTouchEnd);
    };

    const onTouchMove = (e) => {
        if (pressIndex >= 0) {
            if (e.touches.length !== 1) return;
            const t = e.touches[0];
            if (Math.abs(t.clientX - pressClientX) > 3 || Math.abs(t.clientY - pressClientY) > 3) {
                pressMoved = true;
            }
            return;
        }
        if (!isDragging) return;
        e.preventDefault();
        onDragMove(e.touches[0].clientX);
    };

    const onTouchEnd = () => {
        if (pressIndex >= 0) {
            const idx = pressIndex;
            pressIndex = -1;
            document.removeEventListener('touchmove', onTouchMove);
            document.removeEventListener('touchend', onTouchEnd);
            if (!pressMoved) removeSplitLineAt(idx);
            return;
        }
        onDragEnd();
        document.removeEventListener('touchmove', onTouchMove);
        document.removeEventListener('touchend', onTouchEnd);
    };

    lineEl.addEventListener('mousedown', onMouseDown);
    lineEl.addEventListener('touchstart', onTouchStart, { passive: false });

    // 双击删除分割线（0 条即整页不切）；「去除分割线」模式下不响应，避免误删
    if (type === 'split') {
        lineEl.addEventListener('dblclick', () => {
            if (state.removeSplitMode) return;
            const cfg = getPageConfig(state.currentPage);
            cfg.splitLines.splice(index, 1);
            renderSplitLines();
        });
    }

    /* 键盘操作：方向键微调位置（Shift 加速），Delete 删除，
       「去除分割线」模式下 Enter/Space 也能删除（与鼠标点击一致） */
    if (type === 'split') {
        lineEl.addEventListener('keydown', (e) => {
            const cur = parseFloat(lineEl.style.left) || 0;
            const step = e.shiftKey ? 5 : 1;
            let handled = true;

            switch (e.key) {
                case 'ArrowLeft':
                    setPercent(cur - step);
                    break;
                case 'ArrowRight':
                    setPercent(cur + step);
                    break;
                case 'Home':
                    setPercent(0);
                    break;
                case 'End':
                    setPercent(100);
                    break;
                case 'Delete':
                case 'Backspace':
                    removeSplitLineAt(index);
                    focusAfterSplitGone();
                    break;
                case 'Enter':
                case ' ':
                    if (state.removeSplitMode) {
                        removeSplitLineAt(index);
                        focusAfterSplitGone();
                    } else {
                        handled = false;
                    }
                    break;
                default:
                    handled = false;
            }
            if (handled) e.preventDefault();
        });
    } else {
        // 密封线：仅支持方向键移动位置
        lineEl.addEventListener('keydown', (e) => {
            const cur = parseFloat(lineEl.style.left) || 0;
            const step = e.shiftKey ? 5 : 1;
            let handled = true;
            if (e.key === 'ArrowLeft') setPercent(cur - step);
            else if (e.key === 'ArrowRight') setPercent(cur + step);
            else if (e.key === 'Home') setPercent(0);
            else if (e.key === 'End') setPercent(100);
            else handled = false;
            if (handled) e.preventDefault();
        });
    }

    elements.canvasWrapper.appendChild(lineEl);
}

/**
 * 新增一条分割线：插在当前最大间隙的中点
 * 分割线与密封区域彼此独立，位置不受密封区域限制
 */
export function addSplitLine() {
    const config = getPageConfig(state.currentPage);

    const lo = 0, hi = 1;

    // 在 [lo, hi] 内所有相邻点之间找最大间隙，取其中点
    const pts = [lo, ...config.splitLines.filter(x => x > lo && x < hi), hi].sort((a, b) => a - b);
    let maxGap = 0, gapMid = (lo + hi) / 2;
    for (let i = 0; i < pts.length - 1; i++) {
        const gap = pts[i + 1] - pts[i];
        if (gap > maxGap) { maxGap = gap; gapMid = (pts[i] + pts[i + 1]) / 2; }
    }

    config.splitLines.push(gapMid);
    config.splitLines.sort((a, b) => a - b);
    renderSplitLines();
}

/* ------------------------------------------------------------------ */
/* 去除分割线（点击即删）                                               */
/* ------------------------------------------------------------------ */

/**
 * 切换「去除分割线」模式
 * 开启后：点击画布上的分割线即直接删除
 */
export function toggleRemoveSplitMode() {
    state.removeSplitMode = !state.removeSplitMode;
    renderSplitLines();
    updateSplitRemoveUI();
}

/** 退出去除分割线模式 */
export function exitRemoveSplitMode() {
    if (!state.removeSplitMode) return;
    state.removeSplitMode = false;
    renderSplitLines();
    updateSplitRemoveUI();
}

/**
 * 删除某条分割线（「去除分割线」模式下点击即删）
 * @param {number} index 分割线在 config.splitLines 中的索引
 */
function removeSplitLineAt(index) {
    const config = getPageConfig(state.currentPage);
    if (typeof config.splitLines[index] !== 'number') return;

    config.splitLines.splice(index, 1);

    // 已无分割线时自动退出选择模式（避免按钮被禁用后无法退出）
    if (!config.splitLines.length) {
        state.removeSplitMode = false;
    }

    renderSplitLines();
    updateSplitRemoveUI();
    flashSplitRemoved();
}

/** 同步「去除分割线」相关的按钮与提示文案 */
function updateSplitRemoveUI() {
    const config = state.pagesData[state.currentPage];
    const total = (config && Array.isArray(config.splitLines)) ? config.splitLines.length : 0;

    // 画布进入「待选择」状态
    const wrapper = elements.canvasWrapper;
    if (wrapper) {
        wrapper.classList.toggle('remove-split-mode', state.removeSplitMode);
    }

    const btn = elements.removeSplitBtn;
    if (btn) {
        const active = state.removeSplitMode;
        btn.classList.toggle('active-state', active);
        btn.innerHTML = active
            ? '<span class="material-icons">check_circle</span> 选择中'
            : '<span class="material-icons">remove_circle_outline</span> 去除分割线';
        // 无分割线时禁用（但在选择模式中仍需可点，以便退出）
        btn.disabled = total === 0 && !active;
    }
}

/** 删除分割线后的短暂反馈 */
let flashTimer = null;
function flashSplitRemoved() {
    const btn = elements.removeSplitBtn;
    if (!btn) return;
    clearTimeout(flashTimer);
    btn.innerHTML = '<span class="material-icons">check_circle</span> 已删除';
    btn.classList.add('applied-state');
    flashTimer = setTimeout(() => {
        btn.classList.remove('applied-state');
        updateSplitRemoveUI();
    }, 1200);
}

/**
 * 分栏预设：把当前页均分为 N 栏
 *  - n = 2 => 「两栏」，文档一分为二
 *  - n = 3 => 「三栏」，文档一分为三
 * 分栏按整页均分：密封区域是独立挖掉的一块，不参与分栏计算（导出时才剔除）。
 *
 * @param {number} n 栏数（2 或 3）
 */
export function setSplitColumns(n) {
    const count = Math.max(1, Math.round(Number(n) || 2));
    const config = getPageConfig(state.currentPage);

    // 整页均分 [0, 1]
    const lo = 0, hi = 1;

    // 在保留区域内均分，切割线落在各分界处
    const step = (hi - lo) / count;
    const lines = [];
    for (let i = 1; i < count; i++) {
        lines.push(lo + step * i);
    }

    config.splitLines = lines;
    renderSplitLines();
}

/**
 * 把密封区域贴到某一侧（保持当前宽度，只挪位置）
 * 这只是「快捷吸附」，区域本身不受边缘限制，仍可再拖到页面中间。
 * @param {'left'|'right'} side 目标一侧
 */
export function setSealSide(side) {
    const config = getPageConfig(state.currentPage);
    const cur = normalizeSeal(config.sealRange);
    const w = cur ? (cur.x1 - cur.x0) : SEAL_DEFAULT_W;

    config.sealRange = side === 'left'
        ? { x0: 0, x1: Math.min(w, SEAL_MAX_W) }
        : { x0: Math.max(1 - Math.min(w, SEAL_MAX_W), 0), x1: 1 };

    renderSplitLines();
}

/**
 * 切换密封线状态（启用 / 取消）
 * 首次启用时给出贴合书页习惯的默认区域：奇数页靠左、偶数页靠右，各占 15%
 */
export function toggleSealLine() {
    const config = getPageConfig(state.currentPage);

    if (normalizeSeal(config.sealRange)) {
        config.sealRange = null;
        // 区域已取消，同时退出框选模式
        exitSealSelectMode();
    } else {
        const isOdd = state.currentPage % 2 !== 0;
        config.sealRange = isOdd
            ? { x0: 0, x1: SEAL_DEFAULT_W }
            : { x0: 1 - SEAL_DEFAULT_W, x1: 1 };
    }

    renderSplitLines();
}

/* ------------------------------------------------------------------ */
/* 密封区域 · 手动框选（在画布上横向拖出范围）                          */
/* ------------------------------------------------------------------ */

/** 框选进行中的临时高亮框 */
let marqueeEl = null;

/** 「已设置」反馈的定时器（非空表示正在闪烁，此时不覆盖按钮文案） */
let sealFlashTimer = null;

/** 切换「手动框选密封区域」模式 */
export function toggleSealSelectMode() {
    state.sealSelectMode = !state.sealSelectMode;
    updateSealSelectUI();
}

/** 退出「手动框选密封区域」模式 */
export function exitSealSelectMode() {
    if (!state.sealSelectMode) return;
    state.sealSelectMode = false;
    updateSealSelectUI();
}

/**
 * 同步框选模式的按钮与画布状态
 */
function updateSealSelectUI() {
    const wrapper = elements.canvasWrapper;
    if (wrapper) {
        wrapper.classList.toggle('seal-select-mode', state.sealSelectMode);
    }
    // 退出模式时清掉可能残留的选框
    if (!state.sealSelectMode && marqueeEl) {
        marqueeEl.remove();
        marqueeEl = null;
    }
    const btn = elements.sealSelectBtn;
    if (btn) {
        btn.classList.toggle('active-state', state.sealSelectMode);
        // 「已设置」反馈闪烁期间不改文案，避免被中途覆盖
        if (!sealFlashTimer) {
            btn.innerHTML = state.sealSelectMode
                ? '<span class="material-icons">check_circle</span> 拖动中…'
                : '<span class="material-icons">photo_size_select_large</span> 手动选区域';
        }
    }
}

/** 把一次框选结果写入配置 */
function commitSealRange(a, b) {
    const config = getPageConfig(state.currentPage);
    const x0 = Math.min(a, b);
    const x1 = Math.max(a, b);
    const w = Math.min(x1 - x0, SEAL_MAX_W);
    if (w < SEAL_MIN_W) {
        showToast('区域太窄，请再拖宽一些', 'warn');
        return false;
    }
    const start = Math.min(Math.max(x0, 0), 1 - w);
    config.sealRange = { x0: start, x1: start + w };
    return true;
}

/** 框选完成后的短暂反馈 */
function flashSealSet() {
    const btn = elements.sealSelectBtn;
    if (!btn) return;
    clearTimeout(sealFlashTimer);
    btn.innerHTML = '<span class="material-icons">check_circle</span> 已设置';
    btn.classList.add('applied-state');
    sealFlashTimer = setTimeout(() => {
        sealFlashTimer = null;   // 先置空：之后 updateSealSelectUI 才能恢复按钮文案
        btn.classList.remove('applied-state');
        updateSealSelectUI();
    }, 1200);
}

/**
 * 绑定画布框选交互（只绑定一次）
 * 与「去除分割线」「擦除内容」一样是模式化操作：仅在本模式开启时响应。
 */
export function initSealInteractions() {
    const wrapper = elements.canvasWrapper;
    if (!wrapper || initSealInteractions.bound) return;
    initSealInteractions.bound = true;

    let dragging = false;
    let anchorRatio = 0;

    /** 画布横坐标 -> 页面比例（0-1） */
    const ratioOf = (clientX) => {
        const rect = wrapper.getBoundingClientRect();
        if (!rect.width) return 0;
        return Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    };

    const ensureMarquee = () => {
        if (marqueeEl && marqueeEl.isConnected) return marqueeEl;
        marqueeEl = document.createElement('div');
        marqueeEl.className = 'seal-marquee';
        wrapper.appendChild(marqueeEl);
        return marqueeEl;
    };

    const paintMarquee = (a, b) => {
        const el = ensureMarquee();
        const lo = Math.min(a, b), hi = Math.max(a, b);
        el.style.left = `${lo * 100}%`;
        el.style.width = `${(hi - lo) * 100}%`;
    };

    const clearMarquee = () => {
        if (marqueeEl) marqueeEl.remove();
        marqueeEl = null;
    };

    /** 是否可以在画布上开始框选 */
    const canStart = (target) => !(
        state.removeSplitMode ||
        (target && target.closest && target.closest('.split-line'))
    );

    const onDown = (clientX, target) => {
        if (!state.sealSelectMode || !canStart(target)) return;
        dragging = true;
        anchorRatio = ratioOf(clientX);
        paintMarquee(anchorRatio, anchorRatio);
    };

    const onMove = (clientX) => {
        if (!dragging) return;
        paintMarquee(anchorRatio, ratioOf(clientX));
    };

    // 记录最后一次移动的位置，用于抬起时确定终点
    let lastRatio = 0;

    wrapper.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        if (!state.sealSelectMode) return;
        e.preventDefault();
        lastRatio = ratioOf(e.clientX);
        onDown(e.clientX, e.target);
        const move = (ev) => { if (dragging) { lastRatio = ratioOf(ev.clientX); onMove(ev.clientX); } };
        const up = () => {
            document.removeEventListener('mousemove', move);
            document.removeEventListener('mouseup', up);
            finish(lastRatio);
        };
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', up);
    });

    wrapper.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1 || !state.sealSelectMode) return;
        lastRatio = ratioOf(e.touches[0].clientX);
        onDown(e.touches[0].clientX, e.target);
        const move = (ev) => {
            if (!dragging || ev.touches.length !== 1) return;
            ev.preventDefault();
            lastRatio = ratioOf(ev.touches[0].clientX);
            onMove(ev.touches[0].clientX);
        };
        const up = () => {
            document.removeEventListener('touchmove', move);
            document.removeEventListener('touchend', up);
            finish(lastRatio);
        };
        document.addEventListener('touchmove', move, { passive: false });
        document.addEventListener('touchend', up);
    }, { passive: false });

    function finish(endRatio) {
        if (!dragging) { clearMarquee(); return; }
        dragging = false;
        clearMarquee();
        if (commitSealRange(anchorRatio, endRatio)) {
            exitSealSelectMode();
            renderSplitLines();
            flashSealSet();
        }
    }
}

/**
 * 恢复当前页的默认编辑状态
 *  - 分割线恢复为默认「两栏」（一条 0.5 分割线）
 *  - 取消密封线
 * 注意：不影响方向角度与裁剪比例（它们各自有独立的重置按钮）
 */
export function resetToDefaults() {
    const config = getPageConfig(state.currentPage);

    config.splitLines = [0.5];
    config.sealRange = null;

    // 退出「去除分割线」与「密封区域框选」模式，避免残留选中态
    state.removeSplitMode = false;
    state.sealSelectMode = false;

    renderSplitLines();
    updateSplitRemoveUI();
    updateSealSelectUI();
}

/**
 * 批量应用：把当前页的编辑配置复制到满足条件的页面
 * @param {(page:number)=>boolean} match 页码筛选器
 * @param {string} scopeName 目标范围名称（用于提示文案）
 */
function applyConfigToPages(match, scopeName) {
    const currentConfig = getPageConfig(state.currentPage);

    if (!confirm(`确定将当前页的分割设置应用到${scopeName}吗？`)) return;

    for (let i = 1; i <= state.totalPages; i++) {
        if (match(i)) {
            // 深拷贝配置，避免各页共享同一个对象
            state.pagesData[i] = JSON.parse(JSON.stringify(currentConfig));
        }
    }

    showToast(`已应用到${scopeName}`, 'success');
    requestRepaint();
}

/** 批量应用分割设置到所有奇数页 */
export function applySplitToOdd() {
    applyConfigToPages(page => page % 2 !== 0, '所有奇数页');
}

/** 批量应用分割设置到所有偶数页 */
export function applySplitToEven() {
    applyConfigToPages(page => page % 2 === 0, '所有偶数页');
}

/** 批量应用分割设置到所有页面 */
export function applySplitToAll() {
    applyConfigToPages(() => true, `所有 ${state.totalPages} 页`);
}

/**
 * 批量应用密封线：把当前页的密封设置复制到指定页面
 *
 * 规则（与「奇数页在左、偶数页在右」的书页对称保持一致）：
 *  - 目标页与当前页奇偶相同 → 原样复制区域；
 *  - 目标页与当前页奇偶不同 → 水平镜像（x0/x1 各自取 1-x），宽度不变；
 *  - 当前页未启用密封区域 → 使用目标奇偶的默认位置（奇数页靠左 / 偶数页靠右，各 15%）。
 *
 * 只改动密封区域，不动分割线（两者彼此独立，可同时使用）；
 * 也不影响擦除标记、方向角度与裁剪比例。
 * @param {(page:number)=>boolean} match 页码筛选器
 * @param {string} scopeName 目标范围名称（用于提示文案）
 */
function applySealToPages(match, scopeName) {
    const currentConfig = getPageConfig(state.currentPage);
    const currentSeal = normalizeSeal(currentConfig.sealRange);
    const currentIsOdd = state.currentPage % 2 !== 0;

    if (!confirm(`确定把密封区域应用到${scopeName}吗？`)) return;

    let affected = 0;

    for (let i = 1; i <= state.totalPages; i++) {
        if (!match(i)) continue;

        const targetIsOdd = i % 2 !== 0;
        let seal;

        if (currentSeal) {
            if (targetIsOdd === currentIsOdd) {
                // 同奇偶：原样复制
                seal = { x0: currentSeal.x0, x1: currentSeal.x1 };
            } else {
                // 跨奇偶：水平镜像，宽度不变
                seal = { x0: 1 - currentSeal.x1, x1: 1 - currentSeal.x0 };
            }
        } else {
            // 当前页未启用密封区域：按目标奇偶取默认位置
            seal = targetIsOdd
                ? { x0: 0, x1: SEAL_DEFAULT_W }
                : { x0: 1 - SEAL_DEFAULT_W, x1: 1 };
        }

        const config = getPageConfig(i);
        config.sealRange = normalizeSeal(seal);

        affected++;
    }

    showToast(`密封线已应用到${scopeName}（${affected} 页）`, 'success');
    requestRepaint();
}

/** 批量应用密封线到所有奇数页 */
export function applySealToOdd() {
    applySealToPages(page => page % 2 !== 0, '所有奇数页');
}

/** 批量应用密封线到所有偶数页 */
export function applySealToEven() {
    applySealToPages(page => page % 2 === 0, '所有偶数页');
}

/** 批量应用密封线到所有页面 */
export function applySealToAll() {
    applySealToPages(() => true, `所有 ${state.totalPages} 页`);
}

/** 请求重新绘制页面画布（配置批量应用后，可能包含已应用的擦除区域） */
function requestRepaint() {
    document.dispatchEvent(new CustomEvent('papersplit:page-repaint'));
}
