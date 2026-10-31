/**
 * 取景框视图变换（View Transform）
 *
 * 作用：在 A3 固定取景框内对试卷图片做「缩放 / 平移」。
 *  · 红框本身绝对静止 —— 只有框里的图片会变形
 *  · 图片超出红框的部分由 .a3-clip 的 overflow:hidden 直接隐藏
 *  · 适配缩放（fit）由 viewer.js 计算后写入，二者相乘才是最终显示比例
 *
 * 交互：
 *  · 双指捏合 = 缩放 + 平移
 *  · 鼠标滚轮 = 以指针为中心缩放
 *  · 双击 / 双触 = 复位（zoom = 1，位移归零）
 */

import { elements } from './dom.js';

/** 缩放范围 */
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 6;

/**
 * 视图状态
 *  - fit：由 viewer.js 写入的「适配缩放」（把画布像素尺寸缩到取景框大小）
 *  - zoom：用户缩放倍率
 *  - x / y：平移量（屏幕像素，不随缩放变化）
 */
export const view = {
    fit: 1,
    zoom: 1,
    x: 0,
    y: 0
};

/** 把当前视图状态写进画布容器的 CSS 变换 */
export function applyViewTransform() {
    const wrapper = elements.canvasWrapper;
    if (!wrapper) return;

    const scale = view.fit * view.zoom;
    wrapper.style.transform =
        `translate(-50%, -50%) translate(${view.x}px, ${view.y}px) scale(${scale})`;
}

/**
 * 写入适配缩放（每次重新渲染画布后调用）
 * @param {number} k 适配缩放系数
 */
export function setFitScale(k) {
    const v = Number(k);
    view.fit = Number.isFinite(v) && v > 0 ? v : 1;
    applyViewTransform();
}

/** 复位视图（缩放与平移归零，适配缩放保持不变） */
export function resetView() {
    view.zoom = 1;
    view.x = 0;
    view.y = 0;
    applyViewTransform();
}

/** 当前是否处于放大状态（>1 表示用户放大过） */
export function isZoomed() {
    return view.zoom > 1.001;
}

/** 限制缩放倍率 */
function clampZoom(z) {
    return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
}

/* ------------------------------------------------------------------ */
/* 手势处理                                                            */
/* ------------------------------------------------------------------ */

/** 双指手势的起始状态 */
let pinch = null;
/** 双击检测 */
let lastTap = 0;

/**
 * 两指之间的距离
 * @param {TouchList} touches 触点列表
 * @returns {number} 像素距离
 */
function touchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
}

/**
 * 两指的中点
 * @param {TouchList} touches 触点列表
 * @returns {{x:number,y:number}} 中点坐标
 */
function touchMid(touches) {
    return {
        x: (touches[0].clientX + touches[1].clientX) / 2,
        y: (touches[0].clientY + touches[1].clientY) / 2
    };
}

/**
 * 判断事件是否落在画布内的交互元素上
 * （分割线 / 擦除框 / 密封区 —— 这些元素有自己的双击、双指手势语义）
 * @param {EventTarget} target 事件目标
 * @returns {boolean} 是否命中交互元素
 */
function isOnCanvasControl(target) {
    if (!target || typeof target.closest !== 'function') return false;
    return !!target.closest('.split-line, .mask-rect, .seal-zone');
}

/**
 * 初始化取景框内的缩放 / 平移手势
 * 监听对象为取景框本身：红框不动，手指操作只影响里面的图片
 */
export function initViewportGestures() {
    const frame = elements.a3Frame;
    if (!frame) return;

    /* ---- 双指：捏合缩放 + 平移 ---- */
    frame.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
            pinch = {
                dist: touchDistance(e.touches),
                mid: touchMid(e.touches),
                zoom: view.zoom,
                x: view.x,
                y: view.y
            };
            e.preventDefault();
        } else if (e.touches.length === 1 && !isOnCanvasControl(e.target)) {
            // 单指按下：记录时间，用于双击复位判定
            // （点在分割线 / 擦除框上时不参与，避免与它们的双击删除冲突）
            const now = Date.now();
            if (now - lastTap < 300) {
                resetView();
                lastTap = 0;
            } else {
                lastTap = now;
            }
        }
    }, { passive: false });

    frame.addEventListener('touchmove', (e) => {
        if (!pinch || e.touches.length !== 2) return;
        e.preventDefault();

        const dist = touchDistance(e.touches);
        const mid = touchMid(e.touches);

        if (pinch.dist > 0) {
            view.zoom = clampZoom(pinch.zoom * (dist / pinch.dist));
        }
        // 平移跟随双指中点的位移
        view.x = pinch.x + (mid.x - pinch.mid.x);
        view.y = pinch.y + (mid.y - pinch.mid.y);

        applyViewTransform();
    }, { passive: false });

    const endPinch = (e) => {
        if (e.touches && e.touches.length < 2) pinch = null;
    };
    frame.addEventListener('touchend', endPinch);
    frame.addEventListener('touchcancel', endPinch);

    /* ---- 鼠标滚轮：以指针为中心缩放 ---- */
    frame.addEventListener('wheel', (e) => {
        e.preventDefault();

        const clip = elements.a3Clip;
        if (!clip) return;
        const rect = clip.getBoundingClientRect();

        // 指针在取景框内的位置（相对中心）
        const px = e.clientX - (rect.left + rect.width / 2);
        const py = e.clientY - (rect.top + rect.height / 2);

        const factor = Math.exp(-e.deltaY * 0.0015);
        const next = clampZoom(view.zoom * factor);
        const applied = next / view.zoom;

        // 保持指针下的内容位置不变
        view.x = px - (px - view.x) * applied;
        view.y = py - (py - view.y) * applied;
        view.zoom = next;

        applyViewTransform();
    }, { passive: false });

    /* ---- 双击：复位视图 ---- */
    frame.addEventListener('dblclick', (e) => {
        // 分割线自身的「双击删除」优先，不在此处复位视图
        if (isOnCanvasControl(e.target)) return;
        e.preventDefault();
        resetView();
    });
}
