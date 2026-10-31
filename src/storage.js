/**
 * 编辑配置自动保存 / 恢复
 *
 * 全部数据只写入本机浏览器的 localStorage，不会上传到任何服务器。
 * 以「文件指纹」（文件名 + 大小 + 最后修改时间）为键：
 * 同一个文件重新打开时，自动恢复上次的分割线 / 密封线 / 旋转角度 /
 * 裁剪后调整比例 / 擦除标记。
 *
 * 安全约束：
 *  - 读取时逐字段校验，任何异常数据都退回默认值，绝不让损坏数据影响使用
 *  - 结构版本不匹配则忽略旧记录（避免升级后字段语义变化导致错乱）
 *  - 最多保留 MAX_RECORDS 个文件的记录，超出时淘汰最旧的
 */

import { getSealRanges, getSealBands } from './export-geometry.js';

const STORAGE_PREFIX = 'papersplit:edit:';
const SCHEMA_VERSION = 1;
const MAX_RECORDS = 10;          // 最多保留 10 个文件的编辑配置
const SAVE_DEBOUNCE_MS = 600;    // 配置变更后延迟落盘，避免拖动时频繁写入

/* ------------------------------------------------------------------ */
/* 指纹与存储键                                                        */
/* ------------------------------------------------------------------ */

/**
 * 计算文件指纹：文件名 + 字节数 + 最后修改时间
 * 同一文件重新选择时指纹不变，替换成同名同大小的新文件也能命中
 * @param {File} file 浏览器 File 对象
 * @returns {string} 指纹字符串
 */
export function fileFingerprint(file) {
    if (!file) return '';
    return `${file.name}|${file.size}|${file.lastModified || 0}`;
}

function storageKey(fingerprint) {
    return STORAGE_PREFIX + fingerprint;
}

/* ------------------------------------------------------------------ */
/* 序列化 / 反序列化（含逐字段校验）                                    */
/* ------------------------------------------------------------------ */

/** 把页面配置裁剪为「可保存的最小集合」 */
function serializeConfig(cfg) {
    return {
        splitLines: cfg.splitLines,
        sealRanges: cfg.sealRanges,
        sealBands: cfg.sealBands,
        rotation: cfg.rotation,
        outputScale: cfg.outputScale,
        masks: cfg.masks,
        strokes: cfg.strokes,
        eraseOps: cfg.eraseOps
    };
}

/**
 * 校验并规整一份页面配置；任何不合法的字段都退回默认值
 * @returns {Object|null} 合法配置；完全无法识别时返回 null
 */
function sanitizeConfig(raw) {
    if (!raw || typeof raw !== 'object') return null;

    const splitLines = Array.isArray(raw.splitLines)
        ? raw.splitLines
            .filter(n => typeof n === 'number' && isFinite(n) && n > 0 && n < 1)
            .sort((a, b) => a - b)
        : [0.5];

    // 密封区域：一页可有多个（左右同时存在）
    // 现行格式 { sealRanges: [{x0,x1}] }；旧存档 { sealRange } / { sealLine } 由 normalizeSeal 转换
    const sealRanges = getSealRanges({
        sealRanges: raw.sealRanges,
        sealRange: raw.sealRange,
        sealLine: raw.sealLine
    });

    // 上下密封带（横向密封带）：{ sealBands: [{y0,y1}] }
    const sealBands = getSealBands({ sealBands: raw.sealBands });

    const rotation = Number.isFinite(raw.rotation)
        ? ((raw.rotation % 360) + 360) % 360
        : 0;

    const outputScale = (typeof raw.outputScale === 'number' && isFinite(raw.outputScale)
        && raw.outputScale >= 0.1 && raw.outputScale <= 5)
        ? raw.outputScale
        : 1;

    const masks = Array.isArray(raw.masks)
        ? raw.masks.filter(m => m && typeof m.x === 'number' && typeof m.y === 'number'
            && typeof m.w === 'number' && typeof m.h === 'number')
            .map(m => ({ ...m, applied: !!m.applied }))
        : [];

    const strokes = Array.isArray(raw.strokes)
        ? raw.strokes.filter(s => s && Array.isArray(s.points) && s.points.length > 0)
            .map(s => ({ ...s, applied: !!s.applied }))
        : [];

    const eraseOps = Array.isArray(raw.eraseOps) ? raw.eraseOps : [];

    return { splitLines, sealRanges, sealBands, rotation, outputScale, masks, strokes, eraseOps };
}

/* ------------------------------------------------------------------ */
/* 读取 / 写入                                                          */
/* ------------------------------------------------------------------ */

/**
 * 读取某文件保存的编辑配置
 * @param {string} fingerprint 文件指纹
 * @param {number} totalPages 当前文件的总页数（用于丢弃越界页）
 * @returns {{pages: Object, at: number, name: string}|null} 无记录时返回 null
 */
export function loadEditConfig(fingerprint, totalPages) {
    if (!fingerprint) return null;
    try {
        const raw = localStorage.getItem(storageKey(fingerprint));
        if (!raw) return null;

        const data = JSON.parse(raw);
        if (!data || data.v !== SCHEMA_VERSION || !data.pages) return null;

        const pages = {};
        for (const [k, cfg] of Object.entries(data.pages)) {
            const idx = Number(k);
            if (!Number.isInteger(idx) || idx < 1 || idx > totalPages) continue;
            const clean = sanitizeConfig(cfg);
            if (clean) pages[idx] = clean;
        }

        if (!Object.keys(pages).length) return null;
        return { pages, at: data.at || 0, name: data.name || '' };
    } catch (e) {
        // 隐私模式 / 存储被禁用 / 数据损坏 —— 一律按「没有记录」处理
        return null;
    }
}

/**
 * 保存当前文件的编辑配置
 * @param {string} fingerprint 文件指纹
 * @param {string} fileName 文件名（仅用于展示）
 * @param {Object} pagesData 各页配置
 * @param {number} totalPages 总页数
 * @returns {boolean} 是否保存成功
 */
export function saveEditConfig(fingerprint, fileName, pagesData, totalPages) {
    if (!fingerprint) return false;
    try {
        const pages = {};
        for (let i = 1; i <= totalPages; i++) {
            const cfg = pagesData[i];
            if (cfg) pages[i] = serializeConfig(cfg);
        }
        localStorage.setItem(storageKey(fingerprint), JSON.stringify({
            v: SCHEMA_VERSION,
            at: Date.now(),
            name: fileName,
            pages
        }));
        pruneOldRecords();
        return true;
    } catch (e) {
        // 配额不足或存储不可用 —— 不影响正常编辑流程
        return false;
    }
}

/** 清除某个文件的保存记录 */
export function clearEditConfig(fingerprint) {
    if (!fingerprint) return;
    try {
        localStorage.removeItem(storageKey(fingerprint));
    } catch (e) { /* 忽略 */ }
}

/** 是否有某文件的保存记录（用于「恢复默认」后判断是否要清记录） */
export function hasEditConfig(fingerprint) {
    if (!fingerprint) return false;
    try {
        return !!localStorage.getItem(storageKey(fingerprint));
    } catch (e) {
        return false;
    }
}

/** 淘汰超出数量上限的最旧记录 */
function pruneOldRecords() {
    try {
        const records = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key || !key.startsWith(STORAGE_PREFIX)) continue;
            let at = 0;
            try {
                at = JSON.parse(localStorage.getItem(key)).at || 0;
            } catch (e) { /* 损坏记录时间戳按最旧处理 */ }
            records.push({ key, at });
        }
        if (records.length <= MAX_RECORDS) return;

        records.sort((a, b) => a.at - b.at);
        for (const r of records.slice(0, records.length - MAX_RECORDS)) {
            localStorage.removeItem(r.key);
        }
    } catch (e) { /* 忽略 */ }
}

/* ------------------------------------------------------------------ */
/* 防抖保存调度                                                         */
/* ------------------------------------------------------------------ */

let saveTimer = 0;

/**
 * 安排一次保存（防抖）
 * 拖动分割线 / 涂抹时事件很密集，这里合并成最后一次写入
 * @param {Function} doSave 实际执行保存的回调
 */
export function scheduleSave(doSave) {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        saveTimer = 0;
        try { doSave(); } catch (e) { /* 忽略 */ }
    }, SAVE_DEBOUNCE_MS);
}
