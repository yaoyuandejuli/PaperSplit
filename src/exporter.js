import { state } from './state.js';
import { elements } from './dom.js';
import { getPageConfig } from './editor.js';
import { getPageSource } from './documents.js';
import { rotateCanvas, rotatedBounds, buildEraseOverlay, loadImage } from './utils.js';
import { getSliceRanges, getVerticalRange, computePlacement, getMaskRectsInSlice, A4_WIDTH, A4_HEIGHT } from './export-geometry.js';

/**
 * 导出渲染参数
 *  - EXPORT_DPI：目标分辨率，400 DPI（之前为 200 DPI，即 2 倍高清）
 *  - MAX_SOURCE_PIXELS：单张中间画布的像素上限，防止移动端内存溢出
 *  - MAX_CANVAS_DIM：单轴像素上限（部分浏览器对超大画布有限制）
 *  - JPEG_QUALITY：成品图质量
 */
const EXPORT_DPI = 400;
const MAX_SOURCE_PIXELS = 30_000_000;
const MAX_CANVAS_DIM = 8192;
const JPEG_QUALITY = 0.93;

/**
 * 并行导出的并发度
 *
 * 导出是「CPU + 内存」双重密集型任务：每页都要做 PDF 栅格化 + JPEG 编码。
 * 完全串行时，N 页的耗时是各页之和；完全并行则会把内存峰值推到不可控
 * （每页可能占用数十 MB 的中间画布），在移动端极易 OOM 或被浏览器杀掉。
 *
 * 取 3 作为折中：
 *  · 明显快于串行（多页文档的等待时间下降约 50~60%）
 *  · 峰值内存约为串行的 3 倍，仍在可控范围
 */
const EXPORT_CONCURRENCY = 3;

/**
 * 计算渲染倍率
 * 目标：最窄的一栏拉伸到 A4 宽（210mm）后仍达到 EXPORT_DPI；
 * 同时不超过显存与单轴尺寸上限。
 *
 * @param {number} targetSlicePx 成品页宽对应的像素数
 * @param {number} minRatio 本页最窄切片的宽度比例
 * @param {number} baseW 旋转后基准宽度
 * @param {number} baseH 旋转后基准高度
 * @param {number} minScale 允许的最小倍率
 * @param {number} maxScale 允许的最大倍率
 * @returns {number} 渲染倍率
 */
function computeRenderScale(targetSlicePx, minRatio, baseW, baseH, minScale, maxScale) {
    if (!(baseW > 0) || !(baseH > 0)) return 1;

    // 达到目标 DPI 所需的倍率
    let scale = targetSlicePx / (minRatio * baseW);
    scale = Math.min(maxScale, Math.max(minScale, scale));

    // 显存保护：总像素数不超过上限
    const area = baseW * baseH * scale * scale;
    if (area > MAX_SOURCE_PIXELS) {
        scale *= Math.sqrt(MAX_SOURCE_PIXELS / area);
    }

    // 单轴尺寸保护
    if (baseW * scale > MAX_CANVAS_DIM) scale = MAX_CANVAS_DIM / baseW;
    if (baseH * scale > MAX_CANVAS_DIM) scale = MAX_CANVAS_DIM / baseH;

    return Math.max(0.1, scale);
}

/** 导出按钮进度文案 */
function setExportProgress(done, total) {
    elements.exportBtn.innerHTML =
        `<span class="material-icons">hourglass_top</span> 正在导出 ${done} / ${total} 页…`;
}

/** 释放画布显存（置 0 让浏览器尽快回收，多页文档导出时避免内存堆积） */
function releaseCanvas(canvas) {
    if (!canvas) return;
    canvas.width = 0;
    canvas.height = 0;
}

/**
 * 把画布编码成 JPEG 二进制（Uint8Array）
 *
 * 为什么不用 `toDataURL`：
 *  · toDataURL 会先产出 base64 字符串（体积膨胀 1/3），
 *    jsPDF 随后又要把它解码回二进制 —— 一进一出两次无谓的拷贝。
 *  · toBlob 直接给出二进制，省掉 base64 编码与解码，导出明显更快、峰值内存更低。
 * jsPDF 的 addImage 原生支持 Uint8Array（内部按魔术数字识别 JPEG）。
 *
 * @param {HTMLCanvasElement} canvas 源画布
 * @param {number} quality JPEG 质量 (0~1)
 * @returns {Promise<Uint8Array>} JPEG 二进制数据
 */
async function canvasToJpegBytes(canvas, quality) {
    const blob = await new Promise((resolve) => {
        canvas.toBlob((b) => resolve(b), 'image/jpeg', quality);
    });
    if (!blob) throw new Error('切片编码失败');
    return new Uint8Array(await blob.arrayBuffer());
}

/**
 * 生成导出文件名：A3-A4-YYMMDDHHmmss.pdf
 *
 * 例如 2026-10-30 20:19:50 → A3-A4-261030201950.pdf
 * 采用本地时间，保证同一分钟内连续导出时文件名也互不相同。
 * @returns {string} 文件名
 */
function buildExportFileName() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    const stamp =
        String(d.getFullYear()).slice(-2) +      // 年：后两位
        p(d.getMonth() + 1) +                    // 月
        p(d.getDate()) +                         // 日
        p(d.getHours()) +                        // 时
        p(d.getMinutes()) +                      // 分
        p(d.getSeconds());                       // 秒
    return `A3-A4-${stamp}.pdf`;
}

/**
 * 准备一页导出所需的素材（源画布 + 擦除层 + 切片区间）
 *
 * 抽成独立函数是为了让「页面级并行」成为可能：
 * 每页的准备工作相互独立（不同页、不同文件来源），可以并发执行；
 * 而写入 PDF 文档本身必须串行（jsPDF 的 doc.addImage / addPage 有先后顺序）。
 *
 * @param {number} pageNum 页码 (1-based)
 * @returns {Promise<Object|null>} 页面素材；页码无效时返回 null
 */
async function preparePage(pageNum) {
    const config = getPageConfig(pageNum);
    const rotation = config.rotation || 0;

    // 切割区间：基于分割线数组（可多条 => 分栏），叠加密封线
    const ranges = getSliceRanges(config);

    // 纵向保留区间：上下密封带（靠上 / 靠下）把顶部 / 底部挖掉，
    // 这里只保留中间这一段（没有上下密封带时就是整页 [0, 1]）
    const [vStart, vEnd] = getVerticalRange(config);
    const vRatio = Math.max(0.0001, vEnd - vStart);

    // 裁剪后调整比例：调整裁剪结果在成品页面上的大小（每页独立，可批量应用）
    const outputScale = config.outputScale || 1;

    // 高清导出：按目标 DPI 动态计算渲染倍率，保证“裁剪 + 拉伸填满”后依然清晰
    // 400 DPI 是之前 200 DPI 的 2 倍 —— A4 宽 210mm 对应 3307px，打印更锐利
    const targetSlicePx = (EXPORT_DPI / 25.4) * 210; // A4 宽 210mm 在目标 DPI 下的像素宽
    // 找出本页所有切片中最窄的宽度比例，确保最窄切片拉伸到 A4 宽度也达标
    let minRatio = 1;
    for (const rng of ranges) {
        const w = rng[1] - rng[0];
        if (w > 0.01 && w < minRatio) minRatio = w;
    }

    // 解析本页来自哪个文件（多文件合并后每页来源可能不同）
    const source = getPageSource(pageNum);
    if (!source) return null;

    let sourceCanvas;
    if (source.isPdf) {
        const page = await source.doc.pdfDoc.getPage(source.localPage);
        const base = page.getViewport({ scale: 1 });
        const rot = rotatedBounds(base.width, base.height, rotation);
        const rotBaseW = rot.width; // 旋转后切片基准宽度
        const scale = computeRenderScale(targetSlicePx, minRatio, rotBaseW, rot.height, 2, 8);
        const viewport = page.getViewport({ scale });
        sourceCanvas = document.createElement('canvas');
        sourceCanvas.width = viewport.width;
        sourceCanvas.height = viewport.height;
        await page.render({ canvasContext: sourceCanvas.getContext('2d'), viewport }).promise;
    } else {
        const img = new Image();
        img.src = source.doc.imageUrl;
        // 带 onerror + 超时的加载：图片损坏时 reject 而非永久挂起
        await loadImage(img);
        const rot = rotatedBounds(img.width, img.height, rotation);
        const rotBaseW = rot.width;
        const scale = computeRenderScale(targetSlicePx, minRatio, rotBaseW, rot.height, 1, 6);
        sourceCanvas = document.createElement('canvas');
        sourceCanvas.width = Math.round(img.width * scale);
        sourceCanvas.height = Math.round(img.height * scale);
        sourceCanvas.getContext('2d').drawImage(img, 0, 0, sourceCanvas.width, sourceCanvas.height);
    }

    // 应用方向旋转：后续切片坐标均基于旋转后的坐标系（所见即所得）
    // 0° 时 rotateCanvas 直接复用原画布，这里就不重复释放
    const workCanvas = rotateCanvas(sourceCanvas, rotation);
    if (workCanvas !== sourceCanvas) releaseCanvas(sourceCanvas);

    // 「涂抹擦除」：把【已应用】的笔迹渲染成白色擦除层，导出时叠加到切片上，真正擦除内容
    // 未应用的笔迹属于草稿标记，不参与导出
    const appliedStrokes = (config.strokes || []).filter(s => s.applied);
    const eraseOverlay = buildEraseOverlay(
        appliedStrokes, workCanvas.width, workCanvas.height, { fillStyle: '#ffffff' }
    );

    // 「擦除内容 · 框选」：【已应用】的遮盖区域（导出时覆盖为白色）
    const appliedMasks = (config.masks || []).filter(m => m.applied);

    return { config, ranges, vStart, vRatio, outputScale, workCanvas, eraseOverlay, appliedMasks };
}

/**
 * 把一页切成若干张 A4 成品页并写入 PDF
 *
 * 切片画布的绘制与 JPEG 编码是本页最耗时的部分（每栏一张全尺寸位图）。
 * 这里把「编码」这一步提前到并行阶段做完，主线程只负责串行地写 PDF ——
 * JPEG 编码是纯 CPU 计算，交给并发执行能显著缩短总耗时。
 *
 * @param {Object} page preparePage 的产物
 * @param {string} mode 摆放模式（'a4-fit' | 'a4-fill' | 'a4-cover'）
 * @returns {Promise<Array<{imgData:Uint8Array, placement:Object}>>} 各切片的成品数据
 */
async function buildSlices(page, mode) {
    const { config, ranges, vStart, vRatio, outputScale, workCanvas, eraseOverlay, appliedMasks } = page;
    const out = [];

    for (const rng of ranges) {
        const startXRatio = rng[0];
        const endXRatio = rng[1];
        const widthRatio = endXRatio - startXRatio;

        // 忽略过小的切片
        if (widthRatio <= 0.01) continue;

        const sx = workCanvas.width * startXRatio;
        const sy = workCanvas.height * vStart;        // 顶部密封带裁掉的高度
        const sWidth = workCanvas.width * widthRatio;
        const sHeight = workCanvas.height * vRatio;    // 上下密封带之间的有效高度

        // 创建切片 Canvas
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = sWidth;
        sliceCanvas.height = sHeight;
        const sliceCtx = sliceCanvas.getContext('2d');
        sliceCtx.drawImage(workCanvas, sx, sy, sWidth, sHeight, 0, 0, sWidth, sHeight);

        // 「擦除内容 · 框选」：把【已应用】的遮盖区域覆盖为白色，彻底擦除该处内容
        // （导出为位图，覆盖后无法从 PDF 中提取/还原原文）
        const maskRects = getMaskRectsInSlice(
            appliedMasks, workCanvas.width, workCanvas.height, sx, sWidth, sy, sHeight
        );
        for (const r of maskRects) {
            sliceCtx.fillStyle = '#ffffff';
            sliceCtx.fillRect(r.x, r.y, r.w, r.h);
        }

        // 「擦除内容 · 涂抹」：叠加白色笔迹层，擦除笔迹经过的内容
        if (eraseOverlay) {
            sliceCtx.drawImage(eraseOverlay, sx, sy, sWidth, sHeight, 0, 0, sWidth, sHeight);
        }

        const imgData = await canvasToJpegBytes(sliceCanvas, JPEG_QUALITY);
        // 切片已编码成二进制，原画布立即释放，避免多页导出时内存堆积
        releaseCanvas(sliceCanvas);

        // 根据摆放模式 + 裁剪后调整比例，确定内容在 A4 页面上的绘制区域
        const placement = computePlacement(mode, sWidth / sHeight, outputScale);
        out.push({ imgData, placement });
    }

    return out;
}

/**
 * 导出处理后的 PDF
 * 遍历每一页，根据切割线和密封线裁剪，每一栏生成一页标准 A4 (210×297mm)
 */
export async function exportPdf() {
    if (!state.totalPages) return;

    elements.exportBtn.disabled = true;
    elements.exportBtn.setAttribute('aria-busy', 'true');
    elements.exportBtn.innerHTML = '<span class="material-icons">hourglass_top</span> 正在准备导出…';

    // 内容在 A4 页面上的摆放方式：
    // 'a4-fit'(等比留白，默认) | 'a4-fill'(拉伸填满) | 'a4-cover'(等比填满·超出裁切)
    // 注：所有导出页的纸张尺寸统一为标准 A4 (210×297mm)
    const mode = elements.exportFitSelect ? elements.exportFitSelect.value : 'a4-fit';

    try {
        // 延迟创建：统一使用标准 A4 纵向
        let doc = null;

        // jspdf 按需动态加载：只有真正点导出才下载该 chunk（含 html2canvas/purify），
        // 首屏加载体积约减半
        const { jsPDF } = await import('jspdf');

        const total = state.totalPages;

        /**
         * 按并发度分批处理页面
         *
         * 每一批内：并发准备素材 + 并发编码切片（纯计算，收益最大）
         * 批次之间：串行写入 PDF（doc.addImage 必须有序）
         *
         * 分批而不是「全部并发 + 全部串行写」是为了把内存峰值控制在
         * EXPORT_CONCURRENCY 页的量级，而不是全部页数。
         *
         * @param {Array<number>} pageNums 本批要处理的页码
         * @returns {Promise<Array<{imgData:Uint8Array, placement:Object}>>>} 本批的切片数据
         */
        async function processBatch(pageNums) {
            // 第一步：并发准备页面素材（栅格化 PDF / 图片）
            const pages = await Promise.all(pageNums.map((n) => preparePage(n)));

            // 第二步：并发切分 + JPEG 编码（CPU 密集，并行收益最明显）
            const sliceGroups = await Promise.all(
                pages.map((p) => (p ? buildSlices(p, mode) : Promise.resolve([])))
            );

            // 第三步：释放本页的中间画布（切片已编码成二进制）
            pages.forEach((p) => {
                if (!p) return;
                releaseCanvas(p.workCanvas);
                releaseCanvas(p.eraseOverlay);
            });

            // 第四步：按页码顺序串行写入 PDF
            const ordered = [];
            for (let i = 0; i < pages.length; i++) {
                if (!pages[i]) continue;
                for (const s of sliceGroups[i]) ordered.push(s);
            }
            return ordered;
        }

        // 遍历所有原始页面（分批并发）
        for (let start = 1; start <= total; start += EXPORT_CONCURRENCY) {
            const pageNums = [];
            for (let i = start; i < start + EXPORT_CONCURRENCY && i <= total; i++) {
                pageNums.push(i);
            }

            setExportProgress(start, total);
            const slices = await processBatch(pageNums);

            for (const s of slices) {
                const { drawX, drawY, drawW, drawH } = s.placement;

                // 纸张统一为标准 A4 (210×297mm)
                if (!doc) {
                    doc = new jsPDF({ unit: 'mm', orientation: 'portrait', format: [A4_WIDTH, A4_HEIGHT] });
                } else {
                    doc.addPage([A4_WIDTH, A4_HEIGHT], 'portrait');
                }

                doc.addImage(s.imgData, 'JPEG', drawX, drawY, drawW, drawH);
            }
        }

        if (!doc) {
            alert('没有可导出的内容');
            return;
        }
        doc.save(buildExportFileName());

    } catch (e) {
        console.error(e);
        alert('导出失败: ' + e.message);
    } finally {
        elements.exportBtn.disabled = false;
        elements.exportBtn.removeAttribute('aria-busy');
        elements.exportBtn.innerHTML = '<span class="material-icons">save_alt</span> 导出为 PDF (A4)';
    }
}
