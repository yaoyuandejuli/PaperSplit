/**
 * 绘制一条「涂抹擦除」笔迹
 *
 * 笔迹数据：{ id, points: [[x, y], ...], width }
 *  - points 为「旋转后显示坐标系」中的比例坐标 (0~1)
 *  - width 为笔刷直径，占页面宽度的比例（因此在像素空间中是圆形，导出/预览一致）
 *
 * @param {CanvasRenderingContext2D} ctx 目标上下文
 * @param {Object} stroke 笔迹数据
 * @param {number} width  画布像素宽（笔迹比例坐标的基准）
 * @param {number} height 画布像素高
 * @param {Object} options { fillStyle, lineStyle } —— 导出用白色，编辑器用红色标记
 */
export function drawEraseStroke(ctx, stroke, width, height, options = {}) {
    const { fillStyle = null, lineStyle = null } = options;

    const pts = (stroke && Array.isArray(stroke.points)) ? stroke.points : [];
    if (!pts.length) return;

    const w = Math.max(1, (Number(stroke.width) || 0.02) * width);

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 单点：画一个圆点
    if (pts.length === 1) {
        ctx.beginPath();
        ctx.arc(pts[0][0] * width, pts[0][1] * height, w / 2, 0, Math.PI * 2);
        if (fillStyle) {
            ctx.fillStyle = fillStyle;
            ctx.fill();
        } else if (lineStyle) {
            // 无填充时用描边表示轮廓
            ctx.strokeStyle = lineStyle;
            ctx.lineWidth = Math.max(1, w * 0.14);
            ctx.stroke();
        }
        ctx.restore();
        return;
    }

    ctx.beginPath();
    ctx.moveTo(pts[0][0] * width, pts[0][1] * height);
    for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i][0] * width, pts[i][1] * height);
    }

    if (fillStyle) {
        ctx.strokeStyle = fillStyle;
        ctx.lineWidth = w;
        ctx.stroke();
    }
    if (lineStyle) {
        ctx.strokeStyle = lineStyle;
        ctx.lineWidth = Math.max(1, w * 0.14);
        ctx.stroke();
    }

    ctx.restore();
}

/**
 * 加载一张图片并等待解码完成
 *
 * 为什么需要自己包一层（而不是直接 `await new Promise(r => img.onload = r)`）：
 *   1. 只监听 onload 时，图片损坏 / blob URL 失效 / 内存不足会触发 onerror 而非 onload，
 *      Promise 将永远挂起 —— 导出流程会卡死在「正在准备导出…」，连 finally 都执行不到，
 *      按钮永久 disabled，用户只能刷新页面；
 *   2. 图片已在浏览器缓存时仍可能走异步路径，必须等 load 事件；
 *   3. 加超时兜底，避免极端情况下 onload / onerror 都不触发导致请求链卡死。
 *
 * @param {HTMLImageElement} img 已设置好 src 的图片元素
 * @param {number} timeoutMs 超时毫秒数
 * @returns {Promise<void>} 加载成功 resolve，失败或超时 reject
 */
export function loadImage(img, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
        // 已完成加载的图片（complete 且有尺寸）直接放行，避免漏掉事件
        if (img.complete && img.naturalWidth > 0) {
            resolve();
            return;
        }

        const timer = setTimeout(() => {
            cleanup();
            reject(new Error('图片加载超时'));
        }, timeoutMs);

        function cleanup() {
            clearTimeout(timer);
            img.onload = null;
            img.onerror = null;
        }
        function onLoad() {
            cleanup();
            resolve();
        }
        function onError() {
            cleanup();
            reject(new Error('图片解码失败'));
        }

        img.onload = onLoad;
        img.onerror = onError;
    });
}

/**
 * 把一组笔迹渲染成一张「擦除层」画布（透明底 + 白色笔迹）
 * 导出时把该层与切片叠加，被擦除的内容即被真正覆盖。
 *
 * @param {Array} strokes 笔迹列表
 * @param {number} width  画布像素宽
 * @param {number} height 画布像素高
 * @param {Object} options 传给 drawEraseStroke 的样式
 * @returns {HTMLCanvasElement|null} 无笔迹时返回 null
 */
export function buildEraseOverlay(strokes, width, height, options = { fillStyle: '#ffffff' }) {
    if (!strokes || !strokes.length) return null;

    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(width));
    cv.height = Math.max(1, Math.round(height));

    const ctx = cv.getContext('2d');
    for (const s of strokes) {
        drawEraseStroke(ctx, s, cv.width, cv.height, options);
    }
    return cv;
}

/**
 * 计算矩形 (w × h) 旋转 deg 度后的外接矩形尺寸。
 * 用于：① 确定旋转后画布的真实宽高（不裁切）；
 *       ② 主视图按旋转后尺寸做 Fit 缩放；
 *       ③ 导出时按旋转后基准宽度计算高清渲染倍率。
 *
 * @param {number} w 原始宽度
 * @param {number} h 原始高度
 * @param {number} deg 旋转角度（任意值，会归一化到 0-360）
 * @returns {{width:number, height:number}}
 */
export function rotatedBounds(w, h, deg) {
    const r = ((Math.round(deg) % 360) + 360) % 360;
    const rad = (r * Math.PI) / 180;
    const cos = Math.abs(Math.cos(rad));
    const sin = Math.abs(Math.sin(rad));
    return {
        width: Math.ceil(w * cos + h * sin),
        height: Math.ceil(h * cos + w * sin)
    };
}

/**
 * 复制一张画布（新建同尺寸画布并把内容画过去）
 *
 * 用途：位图缓存里的画布是**共享**的，任何需要在画布上作画的操作
 * （如烘焙「已应用」的擦除区域）都必须先复制一份，
 * 否则会污染缓存，让撤销擦除后仍残留白块。
 *
 * @param {HTMLCanvasElement} src 源画布
 * @returns {HTMLCanvasElement} 独立的新画布
 */
export function cloneCanvas(src) {
    const out = document.createElement('canvas');
    out.width = src.width;
    out.height = src.height;
    out.getContext('2d').drawImage(src, 0, 0);
    return out;
}

/**
 * 将画布按指定角度旋转，返回新的画布。
 * 画布尺寸取「旋转后的外接矩形」，因此 0°/90°/180°/270° 及任意角度都不会裁切内容。
 * 所有分割线 / 密封线 / 切片坐标都定义在「旋转后的显示坐标系」中，
 * 因此界面所见即导出所得。
 *
 * @param {HTMLCanvasElement} src 源画布（未旋转）
 * @param {number} deg 旋转角度（任意值）
 * @returns {HTMLCanvasElement} 旋转后的新画布
 */
export function rotateCanvas(src, deg) {
    // 0° 旋转：直接复用原画布，省掉一份同尺寸的大图（导出高清大图时很关键）
    if (((Math.round(deg) % 360) + 360) % 360 === 0) return src;

    const b = rotatedBounds(src.width, src.height, deg);

    const out = document.createElement('canvas');
    out.width = b.width;
    out.height = b.height;

    const ctx = out.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.translate(b.width / 2, b.height / 2);
    ctx.rotate((((Math.round(deg) % 360) + 360) % 360) * Math.PI / 180);
    ctx.drawImage(src, -src.width / 2, -src.height / 2);
    // 重置变换：后续在该画布上按像素坐标绘制（如擦除层）时坐标才不会偏移
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    return out;
}
