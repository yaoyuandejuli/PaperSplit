/**
 * 导出几何计算（由 exporter.js 与「裁剪结果预览」共用）
 *
 * 坐标约定：
 *  - 切片比例 (ratio) 定义在「旋转后的显示坐标系」中，0 = 左边缘，1 = 右边缘
 *  - 页面尺寸与绘制区域单位统一为毫米 (mm)
 */

/**
 * 在 [start, end] 区间内，按 lines（升序）把页面切成若干段，返回 [[s, e], ...]
 */
function splitRegion(start, end, lines) {
    const pts = [start, ...lines, end];
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
        out.push([pts[i], pts[i + 1]]);
    }
    return out;
}

/**
 * 根据页面配置计算切割区间（多条分割线 => 分栏，叠加密封线）
 * @param {Object} config 页面配置 { splitLines, sealLine }
 * @returns {Array<[number, number]>} 各段的 [起始比例, 结束比例]
 */
export function getSliceRanges(config) {
    const seal = config.sealLine;

    // 多条分割线支持：将页面按分割线数组切成 N 段
    // 无分割线（用户已用「去除分割线」全部移除）=> 整页不切，只有一段
    const splitLines = Array.isArray(config.splitLines)
        ? [...config.splitLines].sort((a, b) => a - b)
        : [];

    if (seal) {
        // 密封方向由 seal.type 决定（与线的语义一致），不受其相对分割线的位置影响。
        // 先剔除密封区，再在保留区域内按分割线切分；分割线已被钳制进保留区域，杜绝反向切片或漏出密封区。
        if (seal.type === 'left') {
            // 左侧密封：丢弃 [0, Seal]，保留 [Seal, 1]
            return splitRegion(seal.x, 1, splitLines.filter(x => x > seal.x && x < 1));
        }
        // 右侧密封：丢弃 [Seal, 1]，保留 [0, Seal]
        return splitRegion(0, seal.x, splitLines.filter(x => x > 0 && x < seal.x));
    }

    // 无分割线：整页作为一段（不切割）
    if (!splitLines.length) return [[0, 1]];

    // 无密封：按全部分割线切分 [0, 1]
    return splitRegion(0, 1, splitLines);
}

/** 统一输出纸张：标准 A4 (210×297mm)，所有导出页都是这个尺寸 */
export const A4_WIDTH = 210;
export const A4_HEIGHT = 297;

/**
 * 计算遮盖区域与某一切片的交集（像素坐标）
 *
 * 遮盖 masks 是整页比例坐标（基于旋转后的显示坐标系），切片是整页的一段，
 * 因此需要把遮盖换算到切片像素坐标后再求交集。
 *
 * @param {Array<{x,y,w,h}>} masks 遮盖列表（比例坐标）
 * @param {number} workWidth  整页像素宽
 * @param {number} workHeight 整页像素高
 * @param {number} sliceStartX 切片在整页中的左边界（像素）
 * @param {number} sliceWidth  切片像素宽
 * @param {number} sliceHeight 切片像素高
 * @returns {Array<{x,y,w,h}>} 与切片相交的遮盖矩形（切片像素坐标）
 */
export function getMaskRectsInSlice(masks, workWidth, workHeight, sliceStartX, sliceWidth, sliceHeight) {
    const out = [];
    for (const m of (masks || [])) {
        const mx = m.x * workWidth - sliceStartX;   // 相对切片左边界
        const my = m.y * workHeight;
        const mw = m.w * workWidth;
        const mh = m.h * workHeight;

        const x0 = Math.max(0, mx);
        const y0 = Math.max(0, my);
        const x1 = Math.min(sliceWidth, mx + mw);
        const y1 = Math.min(sliceHeight, my + mh);
        if (x1 <= x0 || y1 <= y0) continue; // 与该切片无交集

        out.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
    }
    return out;
}

/**
 * 计算切片在 A4 输出页面上的放置尺寸与位置
 *
 * 页面恒为标准 A4 (210×297mm)，导出模式只决定「内容在纸面上的摆放方式」：
 *  - a4-fit（默认）：等比留白 —— 内容保持裁剪比例完整放入页面并居中，不变形、不裁切
 *  - a4-fill：拉伸填满 —— 内容拉伸变形铺满整页
 *  - a4-cover：等比填满 —— 内容等比放大到铺满整页，超出页面的部分被裁掉（放大镜效果）
 *
 * outputScale = 裁剪后调整比例（1 = 原始大小），在上述摆放基础上再整体缩放并居中，
 * 超出页面的部分会被页面边界裁掉。
 *
 * @param {string} mode 'a4-fit' | 'a4-fill' | 'a4-cover'
 * @param {number} sliceAspect 切片宽高比 = 切片宽 / 切片高
 * @param {number} outputScale 输出比例（默认 1）
 * @returns {{pageWidth:number, pageHeight:number, orientation:string, drawX:number, drawY:number, drawW:number, drawH:number}}
 */
export function computePlacement(mode, sliceAspect, outputScale = 1) {
    const S = Number.isFinite(Number(outputScale)) && outputScale > 0 ? Number(outputScale) : 1;

    // 页面恒为标准 A4 纵向
    const pageWidth = A4_WIDTH;
    const pageHeight = A4_HEIGHT;

    const a4Aspect = A4_WIDTH / A4_HEIGHT;
    let drawW, drawH;

    if (mode === 'a4-fill') {
        // 拉伸填满：内容变形铺满整页
        drawW = A4_WIDTH;
        drawH = A4_HEIGHT;
    } else if (mode === 'a4-cover') {
        // 等比填满：按较大的方向铺满（cover），溢出部分被页面裁掉
        if (sliceAspect > a4Aspect) {
            drawH = A4_HEIGHT;
            drawW = A4_HEIGHT * sliceAspect;
        } else {
            drawW = A4_WIDTH;
            drawH = A4_WIDTH / sliceAspect;
        }
    } else {
        // 等比留白 (a4-fit)：保持裁剪比例缩放到完整放入页面并居中，不变形、不裁切
        if (sliceAspect > a4Aspect) {
            drawW = A4_WIDTH;
            drawH = A4_WIDTH / sliceAspect;
        } else {
            drawH = A4_HEIGHT;
            drawW = A4_HEIGHT * sliceAspect;
        }
    }

    // 应用输出比例：等比放大/缩小并居中（超出页面部分被裁掉）
    drawW *= S;
    drawH *= S;

    return {
        pageWidth,
        pageHeight,
        orientation: 'portrait',
        drawX: (A4_WIDTH - drawW) / 2,
        drawY: (A4_HEIGHT - drawH) / 2,
        drawW,
        drawH
    };
}
