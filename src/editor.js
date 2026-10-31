import { state } from './state.js';
import { elements } from './dom.js';
import { showToast } from './toast.js';
import { normalizeSeal, getSealRanges, getSealBands, SEAL_MIN_W, SEAL_MAX_W } from './export-geometry.js';

/** 新建密封区域时的默认宽度（占页宽 / 页高的比例） */
const SEAL_DEFAULT_W = 0.15;

/**
 * 获取或初始化当前页面的配置
 * 结构: {
 *   splitLines: number[],                   // 分割线位置比例 (0-1)，多条 => 分栏
 *   sealRanges: Array<{x0,x1}>,             // 左右密封带（一页可有多个）
 *   sealBands:  Array<{y0,y1}>,             // 上下密封带（一页可有多个）
 *   rotation: 0 | 90 | 180 | 270,           // 内容方向（每页独立）
 *   outputScale: 1,                        // 裁剪后调整比例（成品页上的大小，导出时生效）
 *   masks: Array<{id,x,y,w,h,applied}>     // 框选擦除区域（比例坐标，导出时覆盖为白色）
 *   strokes: Array<{id,points,width,applied}> // 涂抹擦除笔迹（比例坐标，导出时擦除）
 *   eraseOps: Array<{type,id|ids}>         // 擦除操作栈（支持撤销「标记」与「应用」两类操作）
 * }
 * 注：splitLines / sealRanges / sealBands / masks / strokes 均定义在「旋转后的显示坐标系」中。
 * applied 表示该标记已被「应用」到画布（画布上直接显示擦除后的内容）。
 * applied 表示该标记已被「应用」到画布（画布上直接显示擦除后的内容）。
 * @param {number} pageIndex 页面索引 (1-based)
 * @returns {Object} 页面配置对象
 */
export function getPageConfig(pageIndex) {
    if (!state.pagesData[pageIndex]) {
        state.pagesData[pageIndex] = {
            splitLines: [0.5],
            sealRanges: [],
            rotation: 0,
            outputScale: 1,
            masks: [],
            strokes: [],
            eraseOps: []
        };
    }
    const cfg = state.pagesData[pageIndex];

    // 兼容旧存档：{ x, type } 或单个 { x0, x1 } 形态 → 统一转为数组
    if (cfg.sealLine !== undefined || cfg.sealRange !== undefined) {
        const legacy = cfg.sealRange !== undefined ? cfg.sealRange : cfg.sealLine;
        const list = Array.isArray(legacy) ? legacy : (legacy ? [legacy] : []);
        cfg.sealRanges = list.map(s => normalizeSeal(s)).filter(Boolean);
        delete cfg.sealLine;
        delete cfg.sealRange;
    }
    if (!Array.isArray(cfg.sealRanges)) {
        cfg.sealRanges = cfg.sealRanges ? [normalizeSeal(cfg.sealRanges)].filter(Boolean) : [];
    }
    // 兼容旧数据（无上下密封带）
    if (!Array.isArray(cfg.sealBands)) cfg.sealBands = [];
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
 * 优先下一条分割线 → 「去除分割线」按钮 → 「重置」按钮
 */
function focusAfterSplitGone() {
    const next = elements.canvasWrapper && elements.canvasWrapper.querySelector('.split-line.split');
    if (next) { next.focus(); return; }
    if (elements.removeSplitBtn && !elements.removeSplitBtn.disabled) { elements.removeSplitBtn.focus(); return; }
    if (elements.resetDefaultsBtn) elements.resetDefaultsBtn.focus();
}

/**
 * 统一列出本页的全部密封带
 *
 * 左右（x 轴，竖向密封带）在前、上下（y 轴，横向密封带）在后，各自按位置升序。
 * 每个条目都带上「所属列表 + 列表内下标」，方便拖动时精确写回配置。
 *
 * @param {Object} config 当前页配置
 * @returns {Array<{axis:'x'|'y', start:number, end:number, list:'x'|'y', index:number}>}
 */
function collectSeals(config) {
    const out = [];
    getSealRanges(config).forEach((s, i) => {
        out.push({ axis: 'x', start: s.x0, end: s.x1, list: 'x', index: i });
    });
    getSealBands(config).forEach((s, i) => {
        out.push({ axis: 'y', start: s.y0, end: s.y1, list: 'y', index: i });
    });
    return out;
}

/**
 * 渲染「密封区域」遮罩（一页可有多个区域，四个方向都支持）
 * 把导出时会被裁掉的那一块用斜纹阴影标出来，让用户直观看到密封线的影响范围。
 * 区域可落在页面任意位置（左 / 右 / 上 / 下），拖动遮罩本体可整体移动。
 * @param {Object} config 当前页配置
 */
function renderSealZones(config) {
    const wrapper = elements.canvasWrapper;
    if (!wrapper) return;

    // 区域数量可能变化 —— 整体重建，保证每个遮罩与配置一一对应
    wrapper.querySelectorAll('.seal-zone').forEach(z => z.remove());

    collectSeals(config).forEach((item) => {
        const zone = document.createElement('div');
        zone.className = item.axis === 'y' ? 'seal-zone seal-zone-h' : 'seal-zone';
        zone.dataset.sealAxis = item.axis;
        zone.dataset.sealList = item.list;
        zone.dataset.sealIndex = String(item.index);
        zone.appendChild(Object.assign(document.createElement('span'), {
            className: 'seal-zone-tag',
            textContent: '密封区'
        }));
        wrapper.appendChild(zone);
        bindSealZoneDrag(zone);
        applySealZoneStyle(zone, item);
    });
}

/**
 * 把一个密封区域的位置写进遮罩元素
 * @param {HTMLElement} zone 遮罩元素
 * @param {Object} item 密封带描述 { axis, start, end }
 */
function applySealZoneStyle(zone, item) {
    const isY = item.axis === 'y';
    const pct = v => `${v * 100}%`;

    if (isY) {
        // 上下：横向密封带（顶部 / 底部）
        zone.style.left = '0%';
        zone.style.right = '0%';
        zone.style.top = pct(item.start);
        zone.style.height = pct(item.end - item.start);
        zone.title = `密封区域 纵向 ${pct(item.start)} ~ ${pct(item.end)}：拖动可整体移动，拖两侧虚线可调整范围`;
    } else {
        // 左右：竖向密封带（左侧 / 右侧）
        zone.style.top = '0%';
        zone.style.bottom = '0%';
        zone.style.left = pct(item.start);
        zone.style.width = pct(item.end - item.start);
        zone.title = `密封区域 横向 ${pct(item.start)} ~ ${pct(item.end)}：拖动可整体移动，拖两侧虚线可调整范围`;
    }
}

/**
 * 拖动遮罩本体 = 整体平移密封区域（宽度保持不变）
 *
 * 拖动过程中只改本地草稿并直接更新 DOM，松手时才写回配置 ——
 * 这样即使移动后与其它区域重叠，也不会出现「下标错位、改错区域」的问题。
 *
 * @param {HTMLElement} zone 遮罩元素
 */
function bindSealZoneDrag(zone) {
    const isY = zone.dataset.sealAxis === 'y';

    let dragging = false;
    let startPos = 0;
    let startStart = 0;
    let draft = null;   // { start, end } 拖动中的临时位置
    let edgeA = null;  // 两条边界线元素
    let edgeB = null;

    /** 读取当前密封带（x 轴取 x0/x1，y 轴取 y0/y1） */
    const readSeal = () => {
        const cfg = getPageConfig(state.currentPage);
        const list = isY ? getSealBands(cfg) : getSealRanges(cfg);
        const s = list[Number(zone.dataset.sealIndex)];
        if (!s) return null;
        return { start: isY ? s.y0 : s.x0, end: isY ? s.y1 : s.x1 };
    };

    /** 找到该密封带的两条边界虚线 */
    const findEdges = () => {
        const idx = zone.dataset.sealIndex;
        const axisAttr = isY ? '[data-seal-axis="y"]' : '';
        const sel = `.split-line.seal${axisAttr}[data-seal-index="${idx}"]`;
        return {
            a: elements.canvasWrapper ? elements.canvasWrapper.querySelector(`${sel}[data-seal-edge="0"]`) : null,
            b: elements.canvasWrapper ? elements.canvasWrapper.querySelector(`${sel}[data-seal-edge="1"]`) : null
        };
    };

    const onDown = (clientX, clientY) => {
        const cur = readSeal();
        if (!cur) return;

        dragging = true;
        startPos = isY ? clientY : clientX;
        startStart = cur.start;
        draft = { ...cur };

        const edges = findEdges();
        edgeA = edges.a;
        edgeB = edges.b;

        zone.classList.add('dragging-zone');
    };

    const onMove = (clientX, clientY) => {
        if (!dragging || !draft) return;
        const rect = elements.canvasWrapper.getBoundingClientRect();
        const size = isY ? rect.height : rect.width;
        if (!size) return;

        const w = (draft.end - draft.start) * 100;
        const delta = ((isY ? clientY : clientX) - startPos) / size * 100;
        const left = Math.min(Math.max(startStart * 100 + delta, 0), 100 - w);
        draft = { start: left / 100, end: left / 100 + w / 100 };

        // 直接更新 DOM，避免中途重排导致索引漂移
        if (isY) {
            zone.style.top = `${draft.start * 100}%`;
        } else {
            zone.style.left = `${draft.start * 100}%`;
        }
        if (edgeA) {
            if (isY) edgeA.style.top = `${draft.start * 100}%`;
            else edgeA.style.left = `${draft.start * 100}%`;
        }
        if (edgeB) {
            if (isY) edgeB.style.top = `${draft.end * 100}%`;
            else edgeB.style.left = `${draft.end * 100}%`;
        }
    };

    const onUp = () => {
        if (!dragging) return;
        dragging = false;
        zone.classList.remove('dragging-zone');
        if (draft) {
            const cfg = getPageConfig(state.currentPage);
            const idx = Number(zone.dataset.sealIndex);
            if (isY) {
                const bands = getSealBands(cfg);
                if (bands[idx]) {
                    // 保留 edge（方向归属），手动调整才能继续定位到它
                    cfg.sealBands[idx] = { y0: draft.start, y1: draft.end };
                    cfg.sealBands = getSealBands(cfg);
                }
            } else {
                const seals = getSealRanges(cfg);
                if (seals[idx]) {
                    cfg.sealRanges[idx] = { x0: draft.start, x1: draft.end };
                    cfg.sealRanges = getSealRanges(cfg);
                }
            }
        }
        draft = null;
        renderSplitLines();
        document.dispatchEvent(new CustomEvent('papersplit:config-changed'));
    };

    const mouseMove = (e) => { if (dragging) { e.preventDefault(); onMove(e.clientX, e.clientY); } };
    const touchMove = (e) => {
        if (!dragging || e.touches.length !== 1) return;
        e.preventDefault();
        onMove(e.touches[0].clientX, e.touches[0].clientY);
    };

    zone.addEventListener('mousedown', (e) => {
        if (e.button !== 0 || state.removeSplitMode) return;
        e.preventDefault();
        e.stopPropagation();
        onDown(e.clientX, e.clientY);
        document.addEventListener('mousemove', mouseMove);
        document.addEventListener('mouseup', onUp, { once: true });
    });

    zone.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1 || state.removeSplitMode) return;
        e.stopPropagation();
        onDown(e.touches[0].clientX, e.touches[0].clientY);
        document.addEventListener('touchmove', touchMove, { passive: false });
        document.addEventListener('touchend', onUp, { once: true });
    }, { passive: false });
}

/**
 * 不重建 DOM，只同步密封相关的视觉（遮罩位置 + 各边界虚线 + 状态徽标）
 * 拖动过程中高频调用，避免整页重绘导致的闪烁与焦点丢失。
 * @param {Object} config 当前页配置
 */
function syncSealVisuals(config) {
    const seals = getSealRanges(config);
    const bands = getSealBands(config);

    // 遮罩：按 data-seal-index / data-seal-axis 对位更新位置
    const zones = elements.canvasWrapper
        ? elements.canvasWrapper.querySelectorAll('.seal-zone')
        : [];
    zones.forEach((zone) => {
        const isY = zone.dataset.sealAxis === 'y';
        const idx = Number(zone.dataset.sealIndex);
        const item = isY
            ? (bands[idx] ? { axis: 'y', start: bands[idx].y0, end: bands[idx].y1 } : null)
            : (seals[idx] ? { axis: 'x', start: seals[idx].x0, end: seals[idx].x1 } : null);
        if (item) applySealZoneStyle(zone, item);
    });

    // 边界虚线：同样按 data-seal-index / data-seal-edge 对位更新
    seals.forEach((seal, i) => {
        const left = elements.canvasWrapper
            ? elements.canvasWrapper.querySelector(`.split-line.seal[data-seal-index="${i}"][data-seal-edge="0"]`)
            : null;
        const right = elements.canvasWrapper
            ? elements.canvasWrapper.querySelector(`.split-line.seal[data-seal-index="${i}"][data-seal-edge="1"]`)
            : null;
        if (left) {
            left.style.left = `${seal.x0 * 100}%`;
            left.setAttribute('aria-valuenow', String(Math.round(seal.x0 * 100)));
        }
        if (right) {
            right.style.left = `${seal.x1 * 100}%`;
            right.setAttribute('aria-valuenow', String(Math.round(seal.x1 * 100)));
        }
    });

    // 上下密封带的边界虚线（水平虚线）
    bands.forEach((band, i) => {
        const top = elements.canvasWrapper
            ? elements.canvasWrapper.querySelector(`.split-line.seal[data-seal-axis="y"][data-seal-index="${i}"][data-seal-edge="0"]`)
            : null;
        const bottom = elements.canvasWrapper
            ? elements.canvasWrapper.querySelector(`.split-line.seal[data-seal-axis="y"][data-seal-index="${i}"][data-seal-edge="1"]`)
            : null;
        if (top) {
            top.style.top = `${band.y0 * 100}%`;
            top.setAttribute('aria-valuenow', String(Math.round(band.y0 * 100)));
        }
        if (bottom) {
            bottom.style.top = `${band.y1 * 100}%`;
            bottom.setAttribute('aria-valuenow', String(Math.round(band.y1 * 100)));
        }
    });

    updateSealUI(config);
}

/**
 * 更新密封线状态徽标与四个方向按钮（靠左 / 靠右 / 靠上 / 靠下）
 * @param {Object} config 当前页配置
 */
function updateSealUI(config) {
    const seals = getSealRanges(config);
    const bands = getSealBands(config);
    const total = seals.length + bands.length;

    const chip = elements.sealStatus;
    if (chip) {
        if (total) {
            const pct = (v) => `${Math.round(v * 100)}%`;
            // 详情：左右用横向比例，上下用纵向比例，一并列出
            const detail = [
                ...seals.map(s => `横 ${pct(s.x0)}~${pct(s.x1)}`),
                ...bands.map(b => `纵 ${pct(b.y0)}~${pct(b.y1)}`)
            ].join(' / ');
            chip.textContent = `已启用 · ${total} 处`;
            chip.title = `密封区域：${detail}`;
            chip.classList.add('seal-on');
        } else {
            chip.textContent = '未启用';
            chip.title = '';
            chip.classList.remove('seal-on');
        }
    }

    // 四个方向：可独立开关，多个方向可同时点亮
    const atLeft = seals.some(s => s.x0 <= 0.001);
    const atRight = seals.some(s => s.x1 >= 0.999);
    const atTop = bands.some(b => b.y0 <= 0.001);
    const atBottom = bands.some(b => b.y1 >= 0.999);

    const toggle = (btn, active) => {
        if (!btn) return;
        btn.disabled = false;
        btn.classList.toggle('active-state', active);
    };

    toggle(elements.sealLeftBtn, atLeft);
    toggle(elements.sealRightBtn, atRight);
    toggle(elements.sealTopBtn, atTop);
    toggle(elements.sealBottomBtn, atBottom);

}

/**
 * 启用「应用」类按钮
 * 编辑工具（当前页 / 所有页）与密封线分区（当前页 / 所有页）共用一套逻辑。
 */
function enableApplyButtons() {
    const buttons = [
        elements.applySplitCurrentBtn,
        elements.applyToAllBtn,
        elements.applySealCurrentBtn,
        elements.sealApplyAllBtn,
        elements.resetDefaultsBtn,
        elements.resetSealBtn
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

    // 2. 渲染密封区域的边界（一页可有多个区域，每个区域两条边界）
    const seals = getSealRanges(config);
    seals.forEach((seal, i) => {
        // 左边界：不能越过右边界（至少保留最小宽度）
        createLineElement(seal.x0, 'seal', i, (v) => {
            const cur = getSealRanges(config)[i];
            if (!cur) return;
            const x0 = Math.min(Math.max(v, 0), cur.x1 - SEAL_MIN_W);
            config.sealRanges[i] = { x0, x1: cur.x1 };
            syncSealVisuals(config);
        }, (pct) => {
            const cur = getSealRanges(config)[i];
            return cur ? Math.min(Math.max(pct, 0), (cur.x1 - SEAL_MIN_W) * 100) : pct;
        }, { sealIndex: i, sealEdge: 0 });

        // 右边界：不能越过左边界
        createLineElement(seal.x1, 'seal', i, (v) => {
            const cur = getSealRanges(config)[i];
            if (!cur) return;
            const x1 = Math.min(Math.max(v, cur.x0 + SEAL_MIN_W), 1);
            config.sealRanges[i] = { x0: cur.x0, x1 };
            syncSealVisuals(config);
        }, (pct) => {
            const cur = getSealRanges(config)[i];
            return cur ? Math.min(Math.max(pct, (cur.x0 + SEAL_MIN_W) * 100), 100) : pct;
        }, { sealIndex: i, sealEdge: 1 });
    });

    // 2b. 渲染上下密封带（横向密封带）的边界 —— 水平虚线
    const bands = getSealBands(config);
    bands.forEach((band, i) => {
        // 上边界：不能越过下边界（至少保留最小高度）
        createLineElement(band.y0, 'seal', i, (v) => {
            const cur = getSealBands(config)[i];
            if (!cur) return;
            const y0 = Math.min(Math.max(v, 0), cur.y1 - SEAL_MIN_W);
            config.sealBands[i] = { y0, y1: cur.y1 };
            syncSealVisuals(config);
        }, (pct) => {
            const cur = getSealBands(config)[i];
            return cur ? Math.min(Math.max(pct, 0), (cur.y1 - SEAL_MIN_W) * 100) : pct;
        }, { sealIndex: i, sealEdge: 0, axis: 'y' });

        // 下边界：不能越过上边界
        createLineElement(band.y1, 'seal', i, (v) => {
            const cur = getSealBands(config)[i];
            if (!cur) return;
            const y1 = Math.min(Math.max(v, cur.y0 + SEAL_MIN_W), 1);
            config.sealBands[i] = { y0: cur.y0, y1 };
            syncSealVisuals(config);
        }, (pct) => {
            const cur = getSealBands(config)[i];
            return cur ? Math.min(Math.max(pct, (cur.y0 + SEAL_MIN_W) * 100), 100) : pct;
        }, { sealIndex: i, sealEdge: 1, axis: 'y' });
    });

    // 更新按钮状态：文字恒为「去除密封线」（不随状态变化），
    // 只用颜色区分「已启用 / 未启用」—— 启用时呈蓝色（active-state）。
    const anySeal = seals.length + bands.length > 0;
    elements.toggleSealLineBtn.innerHTML = '<span class="material-icons">format_shapes</span> 去除密封线';
    elements.toggleSealLineBtn.classList.toggle('active-state', anySeal);

    // 遮罩与状态显示
    renderSealZones(config);
    updateSealUI(config);

    // 启用相关操作按钮
    elements.toggleSealLineBtn.disabled = false;
    enableApplyButtons();

    // 分栏预设按钮高亮：两栏(1条分割线) / 三栏(2条分割线)
    if (elements.splitHalfBtn) {
        elements.splitHalfBtn.classList.toggle('active-state', config.splitLines.length === 1);
    }
    if (elements.splitThirdBtn) {
        elements.splitThirdBtn.classList.toggle('active-state', config.splitLines.length === 2);
    }

    // 同步「去除分割线」相关按钮与提示
    updateSplitRemoveUI();

    // 通知外部：分割/密封/方向已变更，主画布的「结果预览」需要重绘
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

    syncFineStepperUI();
}

/**
 * 同步「− / +」微调按钮的可用状态
 * 到达滑块两端（±15°）时对应按钮自动禁用，避免点击无反应。
 */
export function syncFineStepperUI() {
    const slider = elements.rotateFineSlider;
    if (!slider) return;

    const min = Number(slider.min);
    const max = Number(slider.max);
    const value = Number(slider.value);

    if (elements.rotateFineMinusBtn) {
        elements.rotateFineMinusBtn.disabled = slider.disabled || value <= min;
    }
    if (elements.rotateFinePlusBtn) {
        elements.rotateFinePlusBtn.disabled = slider.disabled || value >= max;
    }
}

/**
 * 创建辅助线 DOM 元素并绑定拖拽事件
 *
 * 支持两个方向：
 *  - 默认（x 轴）：竖线，左右拖动，用 left 定位（分割线 / 左右密封带边界）
 *  - axis = 'y'：横线，上下拖动，用 top 定位（上下密封带边界）
 *
 * @param {number} initialX 初始位置比例 (0-1)
 * @param {string} type 线条类型 ('split' | 'seal')
 * @param {number} index 分割线索引（split 用）/ 密封区域序号（seal 用）
 * @param {Function} onUpdate 更新位置回调
 * @param {Function} [clampFn] 自定义范围钳制（输入/输出均为百分比）；不传则仅限制在 0-100%
 * @param {Object} [attrs] 附加的 data-* 属性（用于把密封边界与对应区域对位）
 */
function createLineElement(initialX, type, index, onUpdate, clampFn, attrs) {
    const lineEl = document.createElement('div');

    // axis = 'y' → 水平线（上下密封带边界）；否则为竖线
    const isY = !!(attrs && attrs.axis === 'y');
    const posProp = isY ? 'top' : 'left';

    lineEl.className = `split-line ${type}${isY ? ' horizontal' : ''}`;
    lineEl.style[posProp] = `${initialX * 100}%`;
    if (attrs) {
        for (const [k, v] of Object.entries(attrs)) lineEl.setAttribute(k, String(v));
    }

    // 密封边界属于第几个区域、是该区域的上/下（或左/右）边界
    const sealEdgeName = isY
        ? (attrs && attrs.sealEdge === 0 ? '上' : '下')
        : (attrs && attrs.sealEdge === 0 ? '左' : '右');
    const sealRegionNo = (attrs && typeof attrs.sealIndex === 'number') ? attrs.sealIndex + 1 : 1;

    // 键盘可操作：可聚焦，语义化为一维滑块（位置 0-100%）
    lineEl.tabIndex = 0;
    lineEl.setAttribute('role', 'slider');
    lineEl.setAttribute('aria-orientation', isY ? 'vertical' : 'horizontal');
    lineEl.setAttribute('aria-valuemin', '0');
    lineEl.setAttribute('aria-valuemax', '100');
    lineEl.setAttribute('aria-valuenow', String(Math.round(initialX * 100)));
    lineEl.setAttribute('aria-valuetext', `位置 ${Math.round(initialX * 100)}%`);
    lineEl.setAttribute('aria-label', type === 'split'
        ? `分割线 ${index + 1}：左右方向键微调位置，Delete 键删除`
        : `密封区域 ${sealRegionNo} 的${sealEdgeName}边界：${isY ? '上下' : '左右'}方向键微调位置`);
    lineEl.setAttribute('aria-valuetext',
        `位置 ${Math.round(initialX * 100)}%${type === 'seal' ? `（${sealEdgeName}边界）` : ''}`);

    if (type === 'split') {
        lineEl.title = state.removeSplitMode
            ? '点击直接删除该分割线（键盘：Enter 或 Delete 删除，方向键移动）'
            : '拖动调整位置，双击删除（键盘：Delete 删除，方向键移动）';
    } else {
        lineEl.title = `拖动调整密封区域 ${sealRegionNo} 的${sealEdgeName}边界（也可直接拖动斜纹区域整体移动）`;
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
        lineEl.style[posProp] = `${v}%`;
        syncAria(v);
        onUpdate(v / 100);
        // 位置变化后刷新主画布的「结果预览」
        document.dispatchEvent(new CustomEvent('papersplit:config-changed'));
    };

    const onDragStart = (clientX, clientY) => {
        isDragging = true;
        startX = isY ? clientY : clientX;
        // 获取当前 style.[left|top] 的百分比数值 (去除 %)
        startLeft = parseFloat(lineEl.style[posProp]);
        lineEl.classList.add('dragging');
    };

    const onDragMove = (clientX, clientY) => {
        if (!isDragging) return;

        const rect = elements.canvasWrapper.getBoundingClientRect();
        const size = isY ? rect.height : rect.width;
        if (!size) return;
        const delta = (isY ? clientY : clientX) - startX;
        const deltaPercent = (delta / size) * 100;

        let newPercent = clampPercent(startLeft + deltaPercent);

        lineEl.style[posProp] = `${newPercent}%`;
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
        onDragStart(e.clientX, e.clientY);
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
        onDragMove(e.clientX, e.clientY);
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
        onDragStart(e.touches[0].clientX, e.touches[0].clientY);
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
        onDragMove(e.touches[0].clientX, e.touches[0].clientY);
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
        // 密封线：仅支持方向键移动位置（水平线用上下键，竖直线用左右键）
        lineEl.addEventListener('keydown', (e) => {
            const cur = parseFloat(lineEl.style[posProp]) || 0;
            const step = e.shiftKey ? 5 : 1;
            let handled = true;
            if (isY) {
                if (e.key === 'ArrowUp') setPercent(cur - step);
                else if (e.key === 'ArrowDown') setPercent(cur + step);
                else if (e.key === 'Home') setPercent(0);
                else if (e.key === 'End') setPercent(100);
                else handled = false;
            } else {
                if (e.key === 'ArrowLeft') setPercent(cur - step);
                else if (e.key === 'ArrowRight') setPercent(cur + step);
                else if (e.key === 'Home') setPercent(0);
                else if (e.key === 'End') setPercent(100);
                else handled = false;
            }
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
 *
 * 四个方向都支持：
 *  - left / right → 左右密封带（沿 x 轴）
 *  - top / bottom → 上下密封带（沿 y 轴）
 *
 * @param {'left'|'right'|'top'|'bottom'} side 目标一侧
 */
export function setSealSide(side) {
    const config = getPageConfig(state.currentPage);
    const isY = (side === 'top' || side === 'bottom');
    const seals = isY ? getSealBands(config) : getSealRanges(config);

    // 找到贴在这一侧的区域（贴左/上 = 起点为 0；贴右/下 = 终点为 1）
    const isAtStart = (side === 'left' || side === 'top');
    const hitIndex = seals.findIndex(s => (isAtStart
        ? (isY ? s.y0 <= 0.001 : s.x0 <= 0.001)
        : (isY ? s.y1 >= 0.999 : s.x1 >= 0.999)));

    if (hitIndex >= 0) {
        // 已经贴在这一侧 —— 再点一次即取消
        seals.splice(hitIndex, 1);
        if (isY) config.sealBands = seals;
        else config.sealRanges = seals;
        renderSplitLines();
        return;
    }

    // 尚未贴在这一侧 —— 新增一个贴边区域
    //
    // 宽度来源按轴区分：
    //  · 左右（x 轴）：沿用「另一侧已有的贴边区域」—— 装订线左右等宽才对称
    //  · 上下（y 轴）：各自独立，统一用默认值 —— 顶部与底部是两个互不相干的
    //    裁切区域，若互相继承会把「上边 20%」悄悄带到「下边」，容易误解
    let w = SEAL_DEFAULT_W;
    if (!isY) {
        const other = seals.find(s => (isAtStart ? s.x1 >= 0.999 : s.x0 <= 0.001));
        if (other) w = other.x1 - other.x0;
    }
    const width = Math.min(Math.max(w, SEAL_MIN_W), SEAL_MAX_W);

    const next = isY
        ? (side === 'top'
            ? { y0: 0, y1: width }
            : { y0: 1 - width, y1: 1 })
        : (side === 'left'
            ? { x0: 0, x1: width }
            : { x0: 1 - width, x1: 1 });

    // 与已有区域重叠时以新的贴边区域为准
    const kept = seals.filter(s => isY
        ? (s.y1 <= next.y0 + 0.0001 || s.y0 >= next.y1 - 0.0001)
        : (s.x1 <= next.x0 + 0.0001 || s.x0 >= next.x1 - 0.0001));
    kept.push(next);
    kept.sort((a, b) => (isY ? a.y0 - b.y0 : a.x0 - b.x0));

    if (isY) config.sealBands = kept;
    else config.sealRanges = kept;

    renderSplitLines();
}

/**
 * 切换密封线状态（启用 / 取消）
 *
 * 首次启用时**同时打开「靠左」与「靠右」**两个方向（各占 15%）——
 * 用户点一下就能拿到完整的双边密封带，之后仍可用「靠左 / 靠右 / 靠上 / 靠下」
 * 单独开关任一方向。再次点击则取消全部密封区域。
 */
export function toggleSealLine() {
    const config = getPageConfig(state.currentPage);

    if (getSealRanges(config).length || getSealBands(config).length) {
        config.sealRanges = [];
        config.sealBands = [];
    } else {
        // 默认同时贴左、贴右（各 15%），与「靠左 / 靠右」两个按钮的初始状态一致
        config.sealRanges = [
            { x0: 0, x1: SEAL_DEFAULT_W },
            { x0: 1 - SEAL_DEFAULT_W, x1: 1 }
        ];
        config.sealBands = [];
    }

    renderSplitLines();
}


/**
 * 重置当前页的分割线为默认状态（一条中线，一分为二）
 * 注意：不影响密封区域、方向角度与裁剪比例
 * （密封区域有独立的「重置」按钮，其余两项也各自有独立重置入口）
 */
export function resetSplitLayout() {
    const config = getPageConfig(state.currentPage);

    config.splitLines = [0.5];

    // 退出「去除分割线」模式，避免残留选中态
    state.removeSplitMode = false;

    renderSplitLines();
    updateSplitRemoveUI();
}

/**
 * 清除当前页的所有密封区域（左右 + 上下，不影响分割线、方向角度与裁剪比例）
 */
export function resetSealAreas() {
    const config = getPageConfig(state.currentPage);

    config.sealRanges = [];
    config.sealBands = [];

    renderSplitLines();
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

/**
 * 把当前页的分割设置应用到当前页（确认并保存本页设置）
 *
 * 分割线本身在画布上拖动时即已生效，本按钮用于「明确确认 + 落盘」：
 * 立即写入本地存储并给出反馈，避免用户不确定设置是否已被记录。
 */
export function applySplitToCurrent() {
    const config = getPageConfig(state.currentPage);
    const lines = (config.splitLines || []).length;

    showToast(`分割设置已应用到当前页（${lines} 条分割线）`, 'success');
    document.dispatchEvent(new CustomEvent('papersplit:config-changed'));
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
 * 一页可能有多个密封区域（左右同时存在），此时逐个区域按上述规则处理。
 * **上下密封带不参与奇偶镜像** —— 顶部永远是顶部、底部永远是底部，
 * 只有左右方向才随奇偶左右互换。
 *
 * 只改动密封区域，不动分割线（两者彼此独立，可同时使用）；
 * 也不影响擦除标记、方向角度与裁剪比例。
 * @param {(page:number)=>boolean} match 页码筛选器
 * @param {string} scopeName 目标范围名称（用于提示文案）
 */
function applySealToPages(match, scopeName) {
    const currentConfig = getPageConfig(state.currentPage);
    const currentSeals = getSealRanges(currentConfig);
    const currentBands = getSealBands(currentConfig);
    const currentIsOdd = state.currentPage % 2 !== 0;

    if (!confirm(`确定把密封区域应用到${scopeName}吗？`)) return;

    let affected = 0;

    for (let i = 1; i <= state.totalPages; i++) {
        if (!match(i)) continue;

        const targetIsOdd = i % 2 !== 0;
        let seals;

        if (currentSeals.length) {
            seals = currentSeals.map(s => (
                targetIsOdd === currentIsOdd
                    // 同奇偶：原样复制
                    ? { x0: s.x0, x1: s.x1 }
                    // 跨奇偶：水平镜像，宽度不变
                    : { x0: 1 - s.x1, x1: 1 - s.x0 }
            ));
        } else {
            // 当前页未启用密封区域：按目标奇偶取默认位置
            seals = [targetIsOdd
                ? { x0: 0, x1: SEAL_DEFAULT_W }
                : { x0: 1 - SEAL_DEFAULT_W, x1: 1 }];
        }

        const config = getPageConfig(i);
        config.sealRanges = seals.sort((a, b) => a.x0 - b.x0);

        // 上下密封带：原样复制（顶部 / 底部不随奇偶翻转）
        config.sealBands = currentBands
            .map(b => ({ y0: b.y0, y1: b.y1 }))
            .sort((a, b) => a.y0 - b.y0);

        affected++;
    }

    showToast(`密封线已应用到${scopeName}（${affected} 页）`, 'success');
    requestRepaint();
}

/**
 * 把当前页的密封区域应用到当前页（确认并保存本页设置）
 *
 * 密封区域在画布上拖动时即已生效，本按钮用于「明确确认 + 落盘」：
 * 立即写入本地存储并给出反馈。
 */
export function applySealToCurrent() {
    const config = getPageConfig(state.currentPage);
    const seals = getSealRanges(config);
    const bands = getSealBands(config);
    const total = seals.length + bands.length;

    showToast(total
        ? `密封区域已应用到当前页（${total} 处）`
        : '当前页未启用密封区域', total ? 'success' : 'warn');
    document.dispatchEvent(new CustomEvent('papersplit:config-changed'));
}

/** 批量应用密封线到所有页面 */
export function applySealToAll() {
    applySealToPages(() => true, `所有 ${state.totalPages} 页`);
}

/** 请求重新绘制页面画布（配置批量应用后，可能包含已应用的擦除区域） */
function requestRepaint() {
    document.dispatchEvent(new CustomEvent('papersplit:page-repaint'));
}
