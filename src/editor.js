import { state } from './state.js';
import { elements } from './dom.js';

/**
 * 获取或初始化当前页面的配置
 * 结构: {
 *   splitLines: number[],                   // 分割线位置比例 (0-1)，多条 => 分栏
 *   sealLine: null | { x, type },           // 密封线（奇左偶右）
 *   rotation: 0 | 90 | 180 | 270,           // 内容方向（每页独立）
 *   outputScale: 1,                        // 裁剪后调整比例（成品页上的大小，导出时生效）
 *   masks: Array<{id,x,y,w,h,applied}>     // 框选去除区域（比例坐标，导出时覆盖为白色）
 *   strokes: Array<{id,points,width,applied}> // 涂抹去除笔迹（比例坐标，导出时擦除）
 *   eraseOps: Array<{type,id|ids}>         // 去除操作栈（支持撤销「标记」与「应用」两类操作）
 * }
 * 注：splitLines / sealLine / masks / strokes 均定义在「旋转后的显示坐标系」中。
 * applied 表示该标记已被「应用」到画布（画布上直接显示擦除后的内容）。
 * @param {number} pageIndex 页面索引 (1-based)
 * @returns {Object} 页面配置对象
 */
export function getPageConfig(pageIndex) {
    if (!state.pagesData[pageIndex]) {
        state.pagesData[pageIndex] = {
            splitLines: [0.5],
            sealLine: null,
            rotation: 0,
            outputScale: 1,
            masks: [],
            strokes: [],
            eraseOps: []
        };
    }
    const cfg = state.pagesData[pageIndex];
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

    // 2. 渲染密封线 (如果存在)
    if (config.sealLine) {
        createLineElement(config.sealLine.x, 'seal', (newIter) => {
            config.sealLine.x = newIter;
        });

        // 更新按钮状态：显示取消
        elements.toggleSealLineBtn.innerHTML = '<span class="material-icons">close</span> 取消去除';
        elements.toggleSealLineBtn.classList.add('active-state');
    } else {
        // 更新按钮状态：显示添加
        elements.toggleSealLineBtn.innerHTML = '<span class="material-icons">format_shapes</span> 去除密封线';
        elements.toggleSealLineBtn.classList.remove('active-state');
    }

    // 启用相关操作按钮
    elements.toggleSealLineBtn.disabled = false;
    elements.applyToTypeBtn.disabled = false;
    elements.applyToAllBtn.disabled = false;

    // 分栏预设按钮高亮：两栏(1条分割线) / 三栏(2条分割线)
    if (elements.splitHalfBtn) {
        elements.splitHalfBtn.classList.toggle('active-state', config.splitLines.length === 1);
    }
    if (elements.splitThirdBtn) {
        elements.splitThirdBtn.classList.toggle('active-state', config.splitLines.length === 2);
    }

    // 同步「去除分割线」相关按钮与提示
    updateSplitRemoveUI();

    // 更新方向角度显示与微调滑块
    // 微调滑块值为【相对整转基准 rotationBase 的偏移】，翻页/±90° 时基准已更新，偏移归零
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

    // 通知外部：分割/密封/方向已变更，「裁剪结果预览」需要重绘
    document.dispatchEvent(new CustomEvent('papersplit:config-changed'));
}

/**
 * 创建辅助线 DOM 元素并绑定拖拽事件
 * @param {number} initialX 初始位置比例 (0-1)
 * @param {string} type 线条类型 ('split' | 'seal')
 * @param {number} index 分割线索引（仅 split 使用，用于双击删除 / 点击删除）
 * @param {Function} onUpdate 更新位置回调
 */
function createLineElement(initialX, type, index, onUpdate) {
    const lineEl = document.createElement('div');
    lineEl.className = `split-line ${type}`;
    lineEl.style.left = `${initialX * 100}%`;
    if (type === 'split') {
        lineEl.title = state.removeSplitMode
            ? '点击直接删除该分割线'
            : '双击删除该分割线';
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

        let newPercent = startLeft + deltaPercent;

        // 边界限制 (0% - 100%)
        newPercent = Math.max(0, Math.min(newPercent, 100));

        // 启用密封线时，将分割线钳制在保留区域内，避免落入被裁掉的密封区
        const cfg = getPageConfig(state.currentPage);
        if (cfg.sealLine) {
            const [lo, hi] = cfg.sealLine.type === 'left'
                ? [cfg.sealLine.x * 100, 100]
                : [0, cfg.sealLine.x * 100];
            newPercent = Math.max(lo, Math.min(newPercent, hi));
        }

        lineEl.style.left = `${newPercent}%`;
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

    elements.canvasWrapper.appendChild(lineEl);
}

/**
 * 新增一条分割线：插在当前最大间隙的中点（受密封线保留区域约束）
 */
export function addSplitLine() {
    const config = getPageConfig(state.currentPage);

    // 密封线存在时，仅能在保留区域内插入
    let lo = 0, hi = 1;
    if (config.sealLine) {
        if (config.sealLine.type === 'left') lo = config.sealLine.x;
        else hi = config.sealLine.x;
    }

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
export function removeSplitLineAt(index) {
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
export function updateSplitRemoveUI() {
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
 * 若已启用密封线，则在「保留区域」内均分（密封区域本来就要裁掉，不参与分栏）。
 *
 * @param {number} n 栏数（2 或 3）
 */
export function setSplitColumns(n) {
    const count = Math.max(1, Math.round(Number(n) || 2));
    const config = getPageConfig(state.currentPage);

    // 计算保留区域 [lo, hi]
    let lo = 0, hi = 1;
    if (config.sealLine) {
        if (config.sealLine.type === 'left') lo = config.sealLine.x;
        else hi = config.sealLine.x;
    }

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
 * 切换密封线状态 (添加/移除)
 * 智能判断：奇数页默认左侧，偶数页默认右侧
 */
export function toggleSealLine() {
    const config = getPageConfig(state.currentPage);

    if (config.sealLine) {
        config.sealLine = null;
    } else {
        // 奇数页 (1, 3, 5): 左侧 (0.15)
        // 偶数页 (2, 4, 6): 右侧 (0.85)，与左侧对称，各留 15% 边距
        const isOdd = state.currentPage % 2 !== 0;
        config.sealLine = isOdd ? { x: 0.15, type: 'left' } : { x: 0.85, type: 'right' };
    }

    // 密封线开启后，把已有分割线钳制进保留区域
    if (config.sealLine) {
        const [lo, hi] = config.sealLine.type === 'left'
            ? [config.sealLine.x, 1]
            : [0, config.sealLine.x];
        config.splitLines = config.splitLines.map(x => Math.min(Math.max(x, lo), hi));
    }

    renderSplitLines();
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
    config.sealLine = null;

    // 退出「去除分割线」选择模式，避免残留选中态
    state.removeSplitMode = false;

    renderSplitLines();
    updateSplitRemoveUI();
}

/**
 * 批量应用配置到同类页面 (奇数页或偶数页)
 */
export function applySplitToType() {
    const currentConfig = getPageConfig(state.currentPage);
    const isCurrentOdd = state.currentPage % 2 !== 0;
    const typeName = isCurrentOdd ? '奇数页' : '偶数页';

    if (confirm(`确定将当前配置应用到所有${typeName}吗？`)) {
        for (let i = 1; i <= state.totalPages; i++) {
            const isIterOdd = i % 2 !== 0;
            if (isIterOdd === isCurrentOdd) {
                // 深拷贝配置
                state.pagesData[i] = JSON.parse(JSON.stringify(currentConfig));
            }
        }
        alert('已应用完成');
        requestRepaint();
    }
}

/**
 * 批量应用配置到所有页面
 */
export function applySplitToAll() {
    const currentConfig = getPageConfig(state.currentPage);
    if (confirm(`确定将当前配置应用到所有 ${state.totalPages} 页吗？`)) {
        for (let i = 1; i <= state.totalPages; i++) {
            // 深拷贝配置
            state.pagesData[i] = JSON.parse(JSON.stringify(currentConfig));
        }
        alert('已应用到所有页面');
        requestRepaint();
    }
}

/** 请求重新绘制页面画布（配置批量应用后，可能包含已应用的擦除区域） */
function requestRepaint() {
    document.dispatchEvent(new CustomEvent('papersplit:page-repaint'));
}
