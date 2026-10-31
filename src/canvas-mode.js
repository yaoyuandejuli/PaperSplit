/**
 * 主画布双态切换（Canvas Mode）
 *
 * 上方主画布有两种形态：
 *  · edit    —— 原图编辑态：带红框、分割线、密封线的原图，用于排版操作
 *  · preview —— 结果预览态：处理后的最终 A4 成品页（双页效果），用于确认比例效果
 *
 * 切换规则（由底部控制面板的分区决定）：
 *  · 用户在「输出比例调整」分区操作（放大 / 缩小 / 重置 / 拖滑块）
 *      → 主画布切到「结果预览态」，并实时响应缩放比例
 *  · 用户在其他分区（方向调整 / 编辑工具 / 擦除内容 / 密封线调整）操作
 *      → 主画布自动切回「原图编辑态」
 *
 * 视觉提示：画布左上角始终显示当前形态标签（[ 原图编辑 ] / [ 打印结果预览 ]），
 * 避免用户混淆"当前看的是什么"。
 *
 * 防闪烁：
 *  · 两种形态共用同一个 A3 比例容器（.a3-content），切换时尺寸不变、画面不跳动
 *  · 两层用 opacity 交叉淡入淡出（220ms），不是 display 硬切
 *  · 预览画面「画好之后」才淡入（data-preview-ready="1"），
 *    绝不允许出现"切过去了但还是空白"的闪白
 */

import { state } from './state.js';
import { elements } from './dom.js';
import { requestResultPreview } from './result-preview.js';

/** 画布形态常量 */
export const CANVAS_MODE = {
    EDIT: 'edit',
    PREVIEW: 'preview'
};

/** 形态标签文案 */
const MODE_LABEL = {
    [CANVAS_MODE.EDIT]: '[ 原图编辑 ]',
    [CANVAS_MODE.PREVIEW]: '[ 打印结果预览 ]'
};

/** 形态标签图标（Material Icons） */
const MODE_ICON = {
    [CANVAS_MODE.EDIT]: 'edit',
    [CANVAS_MODE.PREVIEW]: 'picture_as_pdf'
};

/**
 * 更新左上角的状态标签
 * @param {string} mode
 */
function updateBadge(mode) {
    const badge = elements.canvasModeBadge;
    if (!badge) return;
    badge.dataset.mode = mode;
    if (elements.canvasModeText) {
        elements.canvasModeText.textContent = MODE_LABEL[mode];
    }
    if (elements.canvasModeIcon) {
        elements.canvasModeIcon.textContent = MODE_ICON[mode];
    }
}

/**
 * 真正把画面切到某一种形态（CSS 依据 data-mode 控制两层互斥显示）
 * @param {string} mode
 */
function applyMode(mode) {
    const content = elements.a3Content;
    if (content) content.dataset.mode = mode;
}

/**
 * 切换主画布形态
 * @param {string} mode 'edit' | 'preview'
 */
export function setCanvasMode(mode) {
    const next = mode === CANVAS_MODE.PREVIEW ? CANVAS_MODE.PREVIEW : CANVAS_MODE.EDIT;
    state.canvasMode = next;

    // 标签立即更新 —— 用户点了就立刻有反馈
    updateBadge(next);

    if (next === CANVAS_MODE.EDIT) {
        // 回到原图编辑态：立刻淡回原图（原图一直都在，不会重新渲染）
        applyMode(CANVAS_MODE.EDIT);
        return;
    }

    // 切到结果预览态：先把预览画好，画好之后才淡入（不闪白）
    requestResultPreview().then(() => {
        // 期间用户可能又切回编辑态 → 此时不再切换
        if (state.canvasMode !== CANVAS_MODE.PREVIEW) return;
        applyMode(CANVAS_MODE.PREVIEW);
    });
}

/**
 * 初始化形态：默认「原图编辑态」
 */
export function initCanvasMode() {
    state.canvasMode = CANVAS_MODE.EDIT;
    updateBadge(CANVAS_MODE.EDIT);
    applyMode(CANVAS_MODE.EDIT);
}

/**
 * 事件委托：控制面板里哪个分区被操作，主画布就切到对应形态
 *
 * · 输出比例调整分区（data-canvas-mode="preview"）→ 结果预览态
 * · 其它编辑分区（data-canvas-mode="edit"）→ 原图编辑态
 * · 未标注分区的区域（操作指南 / 文件导出）→ 不改变形态
 */
export function bindPanelModeSwitch() {
    const panel = elements.rightPanel;
    if (!panel) return;

    const handle = (e) => {
        const section = e.target.closest ? e.target.closest('.panel-section[data-canvas-mode]') : null;
        if (!section) return;
        const mode = section.getAttribute('data-canvas-mode');
        if (mode !== CANVAS_MODE.EDIT && mode !== CANVAS_MODE.PREVIEW) return;
        setCanvasMode(mode);
    };

    // 点击 / 输入（滑块拖动）都要触发切换
    panel.addEventListener('click', handle);
    panel.addEventListener('input', handle);
}
