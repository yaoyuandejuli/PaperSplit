/**
 * 手机端「置顶迷你预览」
 *
 * 手机上要调分割 / 密封 / 方向这些参数，用户必须下滑到右面板的功能区，
 * 这时主画布已经滚出视口 —— 看不到改动的效果，只能来回滚动。
 *
 * 这里在右面板最上方放一条迷你预览并让它吸顶：
 * 下滑使用下方功能时，当前页（含分割线与密封区）始终顶在屏幕最上面，
 * 边调边看结果。
 *
 * 桌面端右侧本来就是常驻侧边栏，用不到迷你预览，整体隐藏（见 style.css）。
 */

import { state } from './state.js';
import { elements } from './dom.js';
import { getPageConfig } from './editor.js';
import { getSealRanges } from './export-geometry.js';
import { renderPageContentCanvas } from './crop-adjust.js';

/** 预览条高度（CSS 像素），与 style.css 里 .mini-preview 的 height 保持一致 */
const MINI_H = 78;

/** 页面渲染宽度 —— 迷你预览很小，600px 足够清晰且省性能 */
const RENDER_W = 600;

/** 是否处于手机端布局（桌面端不需要迷你预览） */
const mobileQuery = window.matchMedia('(max-width: 768px)');

/** 待渲染标记：配置或页面变化后置位 */
let dirty = true;
/** 渲染防抖定时器 */
let timer = null;
/** 滚动监听用的 rAF 句柄 */
let rafId = 0;

/**
 * 现在是否需要迷你预览
 * 条件：手机端布局 + 已经滚动到右面板区域（主画布已滚出视口）
 */
function shouldShow() {
    if (!mobileQuery.matches) return false;
    if (!state.totalPages) return false;
    const panel = elements.rightPanel;
    if (!panel) return false;
    // 右面板顶部到达视口顶部 = 主画布已完全滚出，此时开始置顶预览
    return panel.getBoundingClientRect().top <= 0;
}

/**
 * 绘制迷你预览
 */
export async function renderMiniPreview() {
    const cv = elements.miniPreviewCanvas;
    if (!cv) return;
    if (!state.totalPages) return;

    const dpr = window.devicePixelRatio || 1;
    const cssW = Math.max(160, Math.round(cv.clientWidth) || window.innerWidth);
    const cssH = MINI_H;

    cv.width = Math.round(cssW * dpr);
    cv.height = Math.round(cssH * dpr);
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    // 底色与主画布一致（浅石板灰），白色纸张从中凸显
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(0, 0, cssW, cssH);

    let work;
    try {
        work = await renderPageContentCanvas(RENDER_W);
    } catch (e) {
        return;
    }
    if (!work) return;

    // 内容按高度等比缩放并水平居中
    const scale = cssH / work.height;
    const w = work.width * scale;
    const x = (cssW - w) / 2;
    ctx.drawImage(work, x, 0, w, cssH);

    const cfg = getPageConfig(state.currentPage);

    // 分割线：与主画布一致用红色虚线
    const lines = cfg.splitLines || [];
    if (lines.length) {
        ctx.save();
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        for (const line of lines) {
            const lx = x + line * w;
            ctx.beginPath();
            ctx.moveTo(lx, 0);
            ctx.lineTo(lx, cssH);
            ctx.stroke();
        }
        ctx.restore();
    }

    // 密封区域：半透明标出导出时会被裁掉的部分
    const seals = getSealRanges(cfg);
    if (seals.length) {
        ctx.save();
        for (const s of seals) {
            const sx = x + s.x0 * w;
            const sw = (s.x1 - s.x0) * w;
            ctx.fillStyle = 'rgba(239, 68, 68, 0.18)';
            ctx.fillRect(sx, 0, sw, cssH);
            ctx.strokeStyle = 'rgba(239, 68, 68, 0.8)';
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 2]);
            ctx.strokeRect(sx, 0, sw, cssH);
        }
        ctx.restore();
    }
}

/**
 * 请求刷新迷你预览（配置 / 页面变化时调用）
 * 合并短时间内的多次请求，避免频繁重绘。
 */
export function scheduleMiniPreview() {
    dirty = true;
    if (timer) return;
    timer = setTimeout(() => {
        timer = 0;
        flushMiniPreview();
    }, 160);
}

/**
 * 立即按需重绘（滚动到位或配置变化后）
 */
function flushMiniPreview() {
    if (!shouldShow()) return;
    if (!dirty) return;
    dirty = false;
    renderMiniPreview();
}

/**
 * 初始化：监听滚动与窗口尺寸变化
 */
export function initMiniPreview() {
    const onScroll = () => {
        if (rafId) return;
        rafId = requestAnimationFrame(() => {
            rafId = 0;
            flushMiniPreview();
        });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', () => {
        dirty = true;
        onScroll();
    });

    // 从手机切到桌面（或反过来）时，布局变了，预览需要重画
    if (typeof mobileQuery.addEventListener === 'function') {
        mobileQuery.addEventListener('change', () => {
            dirty = true;
            onScroll();
        });
    }
}
