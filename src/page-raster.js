/**
 * 页面位图缓存（Page Raster Cache）
 *
 * ## 要解决的问题
 *
 * 「方向调整」是本工具的核心操作之一（旋转 90°、用微调滑块纠正扫描歪斜）。
 * 但页面的**栅格化**（把 PDF / 图片画到 canvas 上）与旋转角度其实**无关** ——
 * 旋转是在栅格化之后、通过一次画布变换完成的。
 *
 * 改造前每次旋转都要重新栅格化一遍页面，实测单次约 100ms；
 * 连续拖动微调滑块时帧率被拖得很低，手感明显发涩。
 *
 * ## 做法
 *
 * 把「未旋转」的页面位图按 (文档, 页码, 渲染倍率) 缓存下来，
 * 旋转时只需重新做一次画布变换（毫秒级），不再重新渲染 PDF。
 * 同一页面在翻页来回、预览与编辑之间来回时也能直接命中缓存。
 *
 * ## 尺寸一致性
 *
 * 画布尺寸的取整规则必须与改造前**完全一致**（PDF 用视口浮点值赋值、
 * 图片四舍五入），否则画布差一个像素，
 * 经 CSS 缩放后整页画面就会轻微位移 —— 密封区的斜纹底纹与文字都会跟着偏。
 *
 * ## 内存
 *
 * 缓存只保留最近若干条，超出即淘汰。淘汰时**不主动清零画布** ——
 * 结果预览层可能仍持有同一张画布，清零会让预览突然变空白。
 */

import { loadImage } from './utils.js';

/**
 * 缓存条数上限
 *
 * 需要同时容纳：
 *  · 「当前页编辑位图」—— 取景框尺寸对应的那一档
 *  · 「结果预览位图」—— 固定 1200px 宽的另一档
 *  · 相邻档位（窗口拖动时倍率连续变化，可能命中上一档）
 *
 * 原为 3，翻页来回时会频繁淘汰 —— 用户在第 1 页与第 2 页之间来回切换时，
 * 两页的位图互相挤掉，每次都重新渲染 PDF（实测约 100ms/次）。
 * 提到 6 后，来回翻页基本都能命中缓存。
 *
 * 内存代价：每条是一张全尺寸画布（约 1190×842×4 ≈ 4MB @ 1x，2x 屏更高）。
 * 6 条在最常见的 2x 屏上约 48MB，可接受。
 */
const MAX_ENTRIES = 6;

/**
 * 渲染倍率量化步长
 *
 * 窗口拖动 / 折叠面板展开收起时，取景框可用尺寸连续变化，
 * 若每次都按精确倍率渲染，PDF 会被反复重绘。
 * 倍率按档位取整后，相邻尺寸共用同一份位图，只有跨档才真正重渲染。
 *
 * 档位取得足够细（1/128）：A3 页面宽约 1190pt，
 * 一个档位对应约 9px 的宽度差 —— 肉眼无法分辨，却能把连续拖动时的
 * 重渲染次数压到个位数。
 */
const SCALE_STEP = 1 / 128;

/** key -> { promise } —— 记录进行中的渲染，避免同一页面被并发渲染多次 */
const rasterCache = new Map();

/** key -> { promise } —— 页面原始尺寸（不随渲染倍率变化） */
const sizeCache = new Map();

/**
 * 取某一页的原始尺寸（PDF 页面尺寸 / 图片像素尺寸）
 * @param {{doc:Object, localPage:number, isPdf:boolean}} source 页面来源
 * @returns {Promise<{w:number,h:number}>}
 */
export function getPageSize(source) {
    const key = `${source.doc.id}:${source.localPage}`;
    const hit = sizeCache.get(key);
    if (hit) return hit;

    const promise = (async () => {
        if (source.isPdf) {
            const page = await source.doc.pdfDoc.getPage(source.localPage);
            const vp = page.getViewport({ scale: 1 });
            return { w: vp.width, h: vp.height };
        }
        const img = new Image();
        img.src = source.doc.imageUrl;
        await loadImage(img);
        return { w: img.width, h: img.height };
    })();

    sizeCache.set(key, promise);
    return promise;
}

/**
 * 取某一页的位图（未旋转），带缓存
 *
 * @param {{doc:Object, localPage:number, isPdf:boolean}} source 页面来源
 * @param {number} scale 请求的渲染倍率
 * @param {boolean} [quantize=true] 是否把倍率归到固定档位
 * @returns {Promise<{canvas:HTMLCanvasElement, scale:number}|null>} 未旋转的页面画布与其**实际**倍率
 */
export function getPageRaster(source, scale, quantize = true) {
    // 倍率归到固定档位：窗口尺寸连续变化时相邻档位共用同一份位图，
    // 避免拖动窗口时反复重渲染 PDF。
    // 注意这只影响位图的**分辨率**，不影响版面 —— 页面在屏幕上的显示尺寸
    // 恒为「原始尺寸 × 适配系数」，与渲染倍率无关（见 viewer.js 的 setFitScale）。
    //
    // 「结果预览」用固定倍率，不做量化 —— 它的分辨率直接决定预览清晰度。
    const actualScale = quantize ? quantizeScale(scale) : scale;
    const key = `${source.doc.id}:${source.localPage}:${actualScale.toFixed(4)}`;

    const hit = rasterCache.get(key);
    if (hit) {
        // LRU：命中后移到末尾，淘汰时先删最久未用的
        rasterCache.delete(key);
        rasterCache.set(key, hit);
        return hit.promise;
    }

    const promise = renderRaster(source, actualScale)
        .then(canvas => ({ canvas, scale: actualScale }));
    rasterCache.set(key, { promise });

    while (rasterCache.size > MAX_ENTRIES) {
        const oldest = rasterCache.keys().next().value;
        rasterCache.delete(oldest);
    }
    return promise;
}

/**
 * 把某一页按指定倍率栅格化
 *
 * 尺寸取整规则与改造前保持一致：
 *  · PDF —— 视口宽高为浮点数，直接赋给 canvas.width/height
 *  · 图片 —— 四舍五入
 *
 * @param {{doc:Object, localPage:number, isPdf:boolean}} source 页面来源
 * @param {number} scale 渲染倍率
 * @returns {Promise<HTMLCanvasElement>}
 */
async function renderRaster(source, scale) {
    if (source.isPdf) {
        const page = await source.doc.pdfDoc.getPage(source.localPage);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        return canvas;
    }

    const img = new Image();
    img.src = source.doc.imageUrl;
    await loadImage(img);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
}

/**
 * 把渲染倍率归到固定档位
 *
 * 窗口尺寸连续变化会让倍率连续变化，若每次都精确渲染，
 * PDF 会被反复重绘；按档位取整后，相邻尺寸共用同一份位图。
 * @param {number} scale 原始倍率
 * @returns {number} 量化后的倍率
 */
export function quantizeScale(scale) {
    if (!(scale > 0)) return scale;
    return Math.max(SCALE_STEP, Math.round(scale / SCALE_STEP) * SCALE_STEP);
}

/**
 * 清空缓存（重新导入文件后调用，避免用到旧页面的画面）
 */
export function clearPageRasterCache() {
    rasterCache.clear();
    sizeCache.clear();
}
