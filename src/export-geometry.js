/**
 * 导出几何计算（由 exporter.js 与「修改后文件预览」共用）
 *
 * 坐标约定：
 *  - 切片比例 (ratio) 定义在「旋转后的显示坐标系」中，0 = 左边缘，1 = 右边缘
 *  - 页面尺寸与绘制区域单位统一为毫米 (mm)
 *  - 密封带分两个方向：
 *      · 左右（竖向密封带）：{ x0, x1 }，沿 x 轴挖掉
 *      · 上下（横向密封带）：{ y0, y1 }，沿 y 轴挖掉
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

/** 密封区域最小宽度（低于此值视为未启用） */
export const SEAL_MIN_W = 0.02;
/** 密封区域最大宽度（避免整页都被裁掉） */
export const SEAL_MAX_W = 0.9;

/**
 * 把任意形态的密封数据规整为 { x0, x1 }，非法数据返回 null
 *
 * 支持两种形态：
 *  - 现行：{ x0, x1 } —— 自由区域，可落在页面任意位置（不一定贴边）
 *  - 旧存档：{ x, type } —— 贴左/贴右，转换为等价的贴边区域
 *
 * @param {*} seal 密封数据
 * @returns {{x0:number, x1:number}|null}
 */
export function normalizeSeal(seal) {
    if (!seal || typeof seal !== 'object') return null;

    let a, b;
    if (Number.isFinite(seal.x0) && Number.isFinite(seal.x1)) {
        a = seal.x0; b = seal.x1;
    } else if (Number.isFinite(seal.x)) {
        // 旧形态：type = 'left' 表示裁掉 [0, x]，'right' 表示裁掉 [x, 1]
        if (seal.type === 'right') { a = seal.x; b = 1; }
        else { a = 0; b = seal.x; }
    } else {
        return null;
    }

    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    if (hi - lo < SEAL_MIN_W) return null;

    // 宽度封顶，并把区域收进 [0, 1] 之内
    const w = Math.min(hi - lo, SEAL_MAX_W);
    const x0 = Math.min(Math.max(lo, 0), 1 - w);
    return { x0, x1: x0 + w };
}

/**
 * 读取并规整某一页的全部密封区域
 *
 * 一页可以有多个密封区域（例如左右两侧同时存在装订线），
 * 返回结果按位置升序。这里只做「合法性过滤 + 排序」，**不合并重叠区域** ——
 * 合并会让区域下标发生偏移，导致拖动时改错区域；重叠部分由几何层自行处理。
 *
 * @param {Object} config 页面配置
 * @returns {Array<{x0:number,x1:number}>}
 */
export function getSealRanges(config) {
    if (!config) return [];
    const raw = config.sealRanges != null ? config.sealRanges
        : (config.sealRange != null ? config.sealRange : config.sealLine);
    const list = Array.isArray(raw) ? raw : (raw ? [raw] : []);

    const valid = [];
    for (const item of list) {
        const s = normalizeSeal(item);
        if (s) valid.push(s);
    }
    valid.sort((a, b) => a.x0 - b.x0);
    return valid;
}

/**
 * 把任意形态的「上下密封带」规整为 { y0, y1 }，非法数据返回 null
 *
 * @param {*} band 密封带数据
 * @returns {{y0:number, y1:number}|null}
 */
export function normalizeSealBand(band) {
    if (!band || typeof band !== 'object') return null;

    let a, b;
    if (Number.isFinite(band.y0) && Number.isFinite(band.y1)) {
        a = band.y0; b = band.y1;
    } else if (Number.isFinite(band.y)) {
        // 旧形态：type = 'bottom' 表示裁掉 [y, 1]，否则裁掉 [0, y]
        if (band.type === 'bottom') { a = band.y; b = 1; }
        else { a = 0; b = band.y; }
    } else {
        return null;
    }

    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    if (hi - lo < SEAL_MIN_W) return null;

    // 高度封顶，并把区域收进 [0, 1] 之内
    const h = Math.min(hi - lo, SEAL_MAX_W);
    const y0 = Math.min(Math.max(lo, 0), 1 - h);
    // edge 记录该密封带「属于哪个方向」（'top' / 'bottom'），
    // 供「手动调整」精确定位用；老数据没有该字段时按贴边情况推断。
    let edge = (band.edge === 'top' || band.edge === 'bottom') ? band.edge : null;
    if (!edge) {
        if (y0 <= 0.001) edge = 'top';
        else if (y0 + h >= 0.999) edge = 'bottom';
    }

    return { y0, y1: y0 + h, edge };
}

/**
 * 读取并规整某一页的全部「上下密封带」（横向密封带）
 *
 * @param {Object} config 页面配置
 * @returns {Array<{y0:number,y1:number}>} 按位置升序
 */
export function getSealBands(config) {
    if (!config) return [];
    const raw = config.sealBands;
    const list = Array.isArray(raw) ? raw : (raw ? [raw] : []);

    const valid = [];
    for (const item of list) {
        const s = normalizeSealBand(item);
        if (s) valid.push(s);
    }
    valid.sort((a, b) => a.y0 - b.y0);
    return valid;
}

/**
 * 计算页面纵向（上下方向）保留下来的区间
 *
 * 上下密封带把页面的顶部 / 底部挖掉，导出时只保留中间这段。
 * 没有密封带时返回整页 [0, 1]；有多个区间时取最大的一段。
 *
 * @param {Object} config 页面配置
 * @returns {[number, number]} [起始比例, 结束比例]
 */
export function getVerticalRange(config) {
    const bands = getSealBands(config);
    if (!bands.length) return [0, 1];

    const segs = subtractRanges(0, 1, bands.map(b => [b.y0, b.y1]));
    if (!segs.length) return [0, 1];

    segs.sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]));
    return [segs[0][0], segs[0][1]];
}

/**
 * 从 [start, end] 区间中挖掉若干子区间，返回剩余的区间列表
 * @param {number} start
 * @param {number} end
 * @param {Array<[number,number]>} removals 待挖掉的区间
 * @returns {Array<[number,number]>}
 */
function subtractRanges(start, end, removals) {
    let segs = [[start, end]];
    for (const [a, b] of removals) {
        const next = [];
        for (const [s, e] of segs) {
            if (b <= s || a >= e) { next.push([s, e]); continue; }
            if (a > s) next.push([s, a]);
            if (b < e) next.push([b, e]);
        }
        segs = next;
    }
    return segs.filter(([s, e]) => e - s > 0.0001);
}

/**
 * 根据页面配置计算切割区间（多条分割线 => 分栏，叠加密封区域）
 *
 * 密封区域与分割线彼此独立、可同时使用：
 *  1. 先从整页中挖掉所有密封区域（可落在任意位置，一页可有多个）
 *  2. 再在每一块保留区域内，按落在该区域内的分割线继续切分
 *
 * @param {Object} config 页面配置 { splitLines, sealRanges }
 * @returns {Array<[number, number]>} 各段的 [起始比例, 结束比例]
 */
export function getSliceRanges(config) {
    const seals = getSealRanges(config);

    // 多条分割线支持：将页面按分割线数组切成 N 段
    // 无分割线（用户已用「去除分割线」全部移除）=> 整页不切，只有一段
    const splitLines = Array.isArray(config && config.splitLines)
        ? [...config.splitLines].sort((a, b) => a - b)
        : [];

    // 保留区域：挖掉所有密封区域后剩下的部分
    let regions = subtractRanges(0, 1, seals.map(s => [s.x0, s.x1]));
    if (!regions.length) regions = [[0, 1]];

    // 在每块保留区域内按分割线切分
    const out = [];
    for (const [s, e] of regions) {
        const inner = splitLines.filter(x => x > s && x < e);
        out.push(...splitRegion(s, e, inner));
    }
    return out;
}

/** 统一输出纸张：标准 A4 (210×297mm)，所有导出页都是这个尺寸 */
export const A4_WIDTH = 210;
export const A4_HEIGHT = 297;

/**
 * 计算遮盖区域与某一切片的交集（像素坐标）
 *
 * 遮盖 masks 是整页比例坐标（基于旋转后的显示坐标系），切片是整页的一段
 * （横向可能因上下密封带而不从 0 开始），因此需要把遮盖换算到切片像素坐标后再求交集。
 *
 * @param {Array<{x,y,w,h}>} masks 遮盖列表（比例坐标）
 * @param {number} workWidth  整页像素宽
 * @param {number} workHeight 整页像素高
 * @param {number} sliceStartX 切片在整页中的左边界（像素）
 * @param {number} sliceWidth  切片像素宽
 * @param {number} sliceStartY 切片在整页中的上边界（像素，0 = 未裁掉顶部）
 * @param {number} sliceHeight 切片像素高
 * @returns {Array<{x,y,w,h}>} 与切片相交的遮盖矩形（切片像素坐标）
 */
export function getMaskRectsInSlice(masks, workWidth, workHeight, sliceStartX, sliceWidth, sliceStartY = 0, sliceHeight) {
    const out = [];
    const h = (sliceHeight === undefined) ? workHeight : sliceHeight;
    for (const m of (masks || [])) {
        const mx = m.x * workWidth - sliceStartX;   // 相对切片左边界
        const my = m.y * workHeight - sliceStartY; // 相对切片上边界
        const mw = m.w * workWidth;
        const mh = m.h * workHeight;

        const x0 = Math.max(0, mx);
        const y0 = Math.max(0, my);
        const x1 = Math.min(sliceWidth, mx + mw);
        const y1 = Math.min(h, my + mh);
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
