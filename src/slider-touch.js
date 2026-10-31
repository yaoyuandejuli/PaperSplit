/**
 * 滑块触摸守卫（Slider Touch Guard）
 *
 * ## 要解决的问题
 * 手机上「输出比例」等滑块位于可独立滚动的控制面板里。用户想上下滑动面板时，
 * 手指常常正好落在滑块上，于是滑块值被意外改掉（误触）。
 *
 * 实测（360ChromeX headless + CDP 真实触摸事件）发现：
 *  · 原生 `<input type=range>` 在 **touchstart 瞬间就会吸附跳值**（100 → 170），
 *    所以单靠 CSS `touch-action: pan-y` 挡不住 —— 面板确实滚了，但值也被改了。
 *  · 纯 `touch-action: pan-x` 能挡住误触，但会让页面完全无法在滑块上滚动。
 *
 * ## 采用的方案（CSS + JS 组合）
 * 1. **CSS**：`touch-action: pan-y`
 *    浏览器接管垂直平移 → 面板能正常滚动；横向手势不被消费 → 滑块仍可跟手。
 * 2. **JS 方向判定**（本模块）：
 *    在 touchstart 记录起点与「按下瞬间的值」；touchmove 位移超过阈值后判定方向：
 *      · 纵向（|dy| > |dx|）→ 判定为「用户在滚页面」→ 锁定滚动模式，
 *        把滑块值持续还原回按下时的值；
 *      · 横向 → 判定为「用户在拖滑块」→ 放行，交回原生行为。
 * 3. **在父级捕获阶段拦截 input 事件**：
 *    滚动模式下原生 range 仍会冒泡 input 事件（值可能是错的）。
 *    在滑块**父元素**上用捕获阶段监听并 `stopPropagation()`，
 *    App 层（业务逻辑）根本收不到错误的值 —— 这比事后修正更干净。
 *
 * ## 兼容性
 * · 只处理触摸事件，鼠标拖动 / 键盘方向键完全不受影响。
 * · 桌面端浏览器的 `touch-action: pan-y` 不影响鼠标操作。
 * · 可重复调用（同一滑块只会初始化一次）。
 */

/** 方向判定阈值（px）：位移超过它才认为是「有意的滑动」 */
const DIRECTION_THRESHOLD = 6;

/**
 * 给一个 range 滑块装上触摸守卫
 * @param {HTMLInputElement} slider 目标滑块
 */
export function guardSliderTouch(slider) {
    if (!slider || slider.dataset.touchGuarded === '1') return;
    slider.dataset.touchGuarded = '1';

    // 状态
    let active = false;      // 是否正处于一次触摸手势中
    let mode = null;         // null=未判定 | 'scroll'=纵向滚动 | 'drag'=横向拖动
    let baseValue = 0;       // 手势开始（touchstart）时的滑块值
    let startX = 0;
    let startY = 0;

    /** 把滑块值还原回手势开始时的值 */
    const restore = () => {
        const v = String(baseValue);
        if (slider.value !== v) slider.value = v;
    };

    // ---- 触摸开始：记录起点与基准值 ----
    slider.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1) return;
        const t = e.touches[0];
        active = true;
        mode = null;
        baseValue = Number(slider.value);
        startX = t.clientX;
        startY = t.clientY;
    }, { passive: true });

    // ---- 触摸移动：判定方向 ----
    slider.addEventListener('touchmove', (e) => {
        if (!active || e.touches.length !== 1) return;
        const t = e.touches[0];
        const dx = t.clientX - startX;
        const dy = t.clientY - startY;

        if (!mode) {
            // 位移太小，方向未明 —— 继续观察
            if (Math.abs(dx) < DIRECTION_THRESHOLD && Math.abs(dy) < DIRECTION_THRESHOLD) return;
            // 纵向位移更大 → 判定为「用户在滚页面」
            mode = Math.abs(dy) > Math.abs(dx) ? 'scroll' : 'drag';
        }

        if (mode === 'scroll') {
            // 滚动模式：把原生 range 因 touchstart 吸附而产生的跳变持续还原
            restore();
        }
    }, { passive: false });

    // ---- 触摸结束：若从未判定为横向拖动，则视为误触，还原 ----
    const finish = () => {
        if (!active) return;
        if (mode !== 'drag') restore();
        active = false;
        mode = null;
    };
    slider.addEventListener('touchend', finish);
    slider.addEventListener('touchcancel', finish);

    // ---- 关键：在父元素的「捕获阶段」拦截 input ----
    // 原生 range 在 touchstart 时就会触发 input（值已跳变）。
    // 捕获阶段先于滑块自身的监听器执行，stopPropagation 后
    // App 层完全不会收到这个错误的值。
    const host = slider.parentElement;
    if (host) {
        host.addEventListener('input', (e) => {
            // 触摸手势进行中，且不是明确的横向拖动 → 屏蔽并还原
            if (active && mode !== 'drag') {
                e.stopPropagation();
                restore();
            }
        }, true);
    }
}

/**
 * 批量为页面上的滑块装上守卫
 * @param {Array<HTMLElement>} sliders 滑块元素列表
 */
export function guardSliders(sliders) {
    for (const s of sliders || []) {
        if (s) guardSliderTouch(s);
    }
}
