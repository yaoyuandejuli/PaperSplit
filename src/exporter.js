import { state } from './state.js';
import { elements } from './dom.js';
import { getPageConfig } from './editor.js';
import { getPageSource } from './documents.js';
import { rotateCanvas, rotatedBounds, buildEraseOverlay } from './utils.js';
import { getSliceRanges, computePlacement, getMaskRectsInSlice, A4_WIDTH, A4_HEIGHT } from './export-geometry.js';

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

        // 遍历所有原始页面
        for (let i = 1; i <= state.totalPages; i++) {
            setExportProgress(i, state.totalPages);
            const config = getPageConfig(i);
            const rotation = config.rotation || 0;

            // 准备切割区间：基于分割线数组（可多条 => 分栏），叠加密封线
            const ranges = getSliceRanges(config);

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
            const source = getPageSource(i);
            if (!source) continue;

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
                await new Promise(r => img.onload = r);
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

            // 执行切割
            for (let rng of ranges) {
                const startXRatio = rng[0];
                const endXRatio = rng[1];
                const widthRatio = endXRatio - startXRatio;

                // 忽略过小的切片
                if (widthRatio <= 0.01) continue;

                const sx = workCanvas.width * startXRatio;
                const sy = 0;
                const sWidth = workCanvas.width * widthRatio;
                const sHeight = workCanvas.height;

                // 创建切片 Canvas
                const sliceCanvas = document.createElement('canvas');
                sliceCanvas.width = sWidth;
                sliceCanvas.height = sHeight;
                const sliceCtx = sliceCanvas.getContext('2d');
                sliceCtx.drawImage(workCanvas, sx, sy, sWidth, sHeight, 0, 0, sWidth, sHeight);

                // 「擦除内容 · 框选」：把【已应用】的遮盖区域覆盖为白色，彻底擦除该处内容
                // （导出为位图，覆盖后无法从 PDF 中提取/还原原文）
                const appliedMasks = (config.masks || []).filter(m => m.applied);
                const maskRects = getMaskRectsInSlice(
                    appliedMasks, workCanvas.width, workCanvas.height, sx, sWidth, sHeight
                );
                for (const r of maskRects) {
                    sliceCtx.fillStyle = '#ffffff';
                    sliceCtx.fillRect(r.x, r.y, r.w, r.h);
                }

                // 「擦除内容 · 涂抹」：叠加白色笔迹层，擦除笔迹经过的内容
                if (eraseOverlay) {
                    sliceCtx.drawImage(eraseOverlay, sx, 0, sWidth, sHeight, 0, 0, sWidth, sHeight);
                }

                const imgData = sliceCanvas.toDataURL('image/jpeg', JPEG_QUALITY);

                // 根据摆放模式 + 裁剪后调整比例，确定内容在 A4 页面上的绘制区域
                const placement = computePlacement(mode, sWidth / sHeight, outputScale);
                const { drawX, drawY, drawW, drawH } = placement;

                // 纸张统一为标准 A4 (210×297mm)
                if (!doc) {
                    doc = new jsPDF({ unit: 'mm', orientation: 'portrait', format: [A4_WIDTH, A4_HEIGHT] });
                } else {
                    doc.addPage([A4_WIDTH, A4_HEIGHT], 'portrait');
                }

                doc.addImage(imgData, 'JPEG', drawX, drawY, drawW, drawH);
            }

            // 本页切片完成：释放高分辨率画布显存，避免多页文档导出时内存持续增长
            releaseCanvas(workCanvas);
            releaseCanvas(eraseOverlay);
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
