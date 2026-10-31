/**
 * Header 随控制面板滚动折叠
 *
 * 场景（手机端）：底部控制面板可独立滚动。
 *  · 继续下拉 → 顶部 Header 平滑向上收起（transform: translateY(-100%) + transition）
 *  · 向上滑动 / 回到面板顶部 → Header 平滑向下展开
 *  · 收起时用负外边距把 Header 占用的高度还回来，
 *    中间取景区因此自动向上填补空间，图片可以显示得更大
 *
 * Header 内的 Logo 与页码始终保留（收起后角标仍显示当前页码）。
 */

import { elements } from './dom.js';

/** 累计下拉多少像素后收起 Header */
const HIDE_THRESHOLD = 28;
/** 上滑多少像素后立即展开 Header */
const SHOW_THRESHOLD = 8;
/** 距面板顶部多近时强制展开 */
const TOP_THRESHOLD = 4;

/**
 * 初始化 Header 折叠
 * @param {Function} onToggle 状态变化回调（用于重新适配取景框）
 */
export function initHeaderCollapse(onToggle) {
    const panel = elements.rightPanel;
    const navbar = document.querySelector('.navbar');
    const app = document.querySelector('.app-container');
    if (!panel || !navbar || !app) return;

    let lastTop = panel.scrollTop;
    let downAcc = 0;
    let hidden = false;

    const isMobile = () => window.matchMedia('(max-width: 768px)').matches;

    /** 记录 Header 实际高度（手机端高度随内容换行而变，必须实测） */
    const measure = () => {
        app.style.setProperty('--nav-h', `${navbar.offsetHeight}px`);
    };
    measure();
    window.addEventListener('resize', measure);

    const setHidden = (next) => {
        if (next === hidden) return;
        hidden = next;
        app.classList.toggle('nav-collapsed', next);
        if (typeof onToggle === 'function') onToggle(hidden);
    };

    panel.addEventListener('scroll', () => {
        // 桌面端控制面板在右侧，不做折叠
        if (!isMobile()) {
            if (hidden) setHidden(false);
            lastTop = panel.scrollTop;
            return;
        }

        const top = panel.scrollTop;
        const delta = top - lastTop;
        lastTop = top;

        // 回到顶部：强制展开
        if (top <= TOP_THRESHOLD) {
            downAcc = 0;
            setHidden(false);
            return;
        }

        if (delta > 0) {
            // 下拉：累计到阈值才收起，避免轻微抖动
            downAcc += delta;
            if (downAcc >= HIDE_THRESHOLD) setHidden(true);
        } else if (delta < 0) {
            downAcc = Math.max(0, downAcc + delta);
            if (delta <= -SHOW_THRESHOLD) setHidden(false);
        }
    }, { passive: true });
}
