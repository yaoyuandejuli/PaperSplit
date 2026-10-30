/**
 * 轻量提示（Toast）
 * 用于「已恢复上次的编辑配置」这类短反馈，不打断操作流程
 */

let container = null;

/** 获取（或创建）提示容器 */
function ensureContainer() {
    if (container && document.body.contains(container)) return container;

    container = document.createElement('div');
    container.className = 'toast-container';
    // 读屏软件可感知，且不打断当前操作
    container.setAttribute('role', 'status');
    container.setAttribute('aria-live', 'polite');
    document.body.appendChild(container);
    return container;
}

/**
 * 显示一条提示
 * @param {string} message 提示文字
 * @param {'info'|'success'|'warn'} type 类型（影响配色）
 * @param {number} duration 停留时长（毫秒）
 */
export function showToast(message, type = 'info', duration = 3200) {
    if (!message) return null;

    const box = ensureContainer();
    const item = document.createElement('div');
    item.className = `toast toast-${type}`;
    item.textContent = message;
    box.appendChild(item);

    // 下一帧再加 show 类，保证过渡动画能触发
    requestAnimationFrame(() => item.classList.add('show'));

    setTimeout(() => {
        item.classList.remove('show');
        setTimeout(() => item.remove(), 320);
    }, duration);

    return item;
}
