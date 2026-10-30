/**
 * 多文件文档集合管理
 *
 * 一次可以导入多个 PDF / 图片，它们会被合并成**一份连续文档**：
 *   - `state.documents`  按「导入先后」保存的文件条目（用于计算存储指纹）
 *   - `state.pageSlots`  按「当前顺序」展开的页面序列，每项指明这一页来自哪个文件的第几页
 *
 * 两者的关系：文件列表里看到的顺序 = pageSlots 中各文件页面块的先后顺序。
 * 页面顺序的调整统一交给「导出前排序」（页级），文件本身不再支持拖拽重排。
 * 调整顺序 / 删除文件时，页面的编辑配置（分割线、密封线、旋转、擦除标记）
 * 必须跟着页面一起搬家 —— 由 remapPagesData() 负责搬运。
 */
import { state } from './state.js';

/**
 * 解析某一全局页对应的源
 * @param {number} pageNumber 全局页码（从 1 开始）
 * @returns {{doc: Object, localPage: number, isPdf: boolean}|null}
 */
export function getPageSource(pageNumber) {
    const slot = state.pageSlots[pageNumber - 1];
    if (!slot) return null;
    const doc = state.documents.find(d => d.id === slot.docId);
    if (!doc) return null;
    return { doc, localPage: slot.localPage, isPdf: doc.type === 'pdf' };
}

/**
 * 按当前页面顺序返回文件列表（每个文件只出现一次）
 * @returns {Array} 文件条目数组
 */
export function getOrderedDocs() {
    const seen = new Set();
    const out = [];
    for (const slot of state.pageSlots) {
        if (seen.has(slot.docId)) continue;
        seen.add(slot.docId);
        const doc = state.documents.find(d => d.id === slot.docId);
        if (doc) out.push(doc);
    }
    return out;
}

/**
 * 页面配置搬运
 *
 * 排序或删除后，全局页码会变，但每一页的编辑配置必须跟着它走。
 * 这里用「(文件 id, 文件内页号)」作为页面的稳定标识，把旧配置搬到新页码上。
 *
 * @param {Array} oldSlots 调整前的页面槽位
 * @param {Array} newSlots 调整后的页面槽位
 * @param {Object} oldPagesData 调整前的各页配置
 * @returns {Object} 调整后的各页配置
 */
function remapPagesData(oldSlots, newSlots, oldPagesData) {
    const oldIndex = new Map();
    oldSlots.forEach((s, i) => oldIndex.set(`${s.docId}:${s.localPage}`, i + 1));

    const out = {};
    newSlots.forEach((s, i) => {
        const oldPage = oldIndex.get(`${s.docId}:${s.localPage}`);
        if (oldPage && oldPagesData[oldPage]) {
            out[i + 1] = oldPagesData[oldPage];
        }
    });
    return out;
}

/**
 * 重新计算页数
 */
function syncTotalPages() {
    state.totalPages = state.pageSlots.length;
}

/**
 * 从集合中移除一个文件，并把它的页面配置一并丢弃
 * @param {string} docId 文件 id
 * @returns {boolean} 是否成功移除
 */
export function removeDocument(docId) {
    const doc = state.documents.find(d => d.id === docId);
    if (!doc) return false;

    const newSlots = state.pageSlots.filter(s => s.docId !== docId);
    state.pagesData = remapPagesData(state.pageSlots, newSlots, state.pagesData);
    state.pageSlots = newSlots;
    state.documents = state.documents.filter(d => d.id !== docId);

    // 释放图片的对象 URL，避免内存泄漏
    if (doc.type === 'image' && doc.imageUrl) {
        try { URL.revokeObjectURL(doc.imageUrl); } catch (e) { /* 忽略 */ }
    }
    syncTotalPages();
    return true;
}

/**
 * 追加一个文件到集合末尾
 * @param {Object} doc 文件条目
 */
export function appendDocument(doc) {
    state.documents.push(doc);
    const slots = [];
    for (let p = 1; p <= doc.pageCount; p++) {
        slots.push({ docId: doc.id, localPage: p });
    }
    state.pageSlots.push(...slots);
    syncTotalPages();
}

/**
 * 计算整个文件集合的指纹（用于编辑配置的自动保存 / 恢复）
 *
 * 按「导入先后」计算，与排序无关：重新打开同一批文件（同样顺序）即可恢复上次的编辑。
 * @param {Array} docs 文件条目数组
 * @returns {string} 指纹字符串
 */
export function collectionFingerprint(docs) {
    if (!docs || !docs.length) return '';
    const raw = docs.map(d => d.fingerprint || d.name).join('||');
    // 轻量哈希，避免把过长的原始串直接写进 localStorage 的键
    let h1 = 0x811c9dc5;
    let h2 = 0x01000193;
    for (let i = 0; i < raw.length; i++) {
        const c = raw.charCodeAt(i);
        h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
        h2 = Math.imul(h2 + c + i, 2654435761) >>> 0;
    }
    return `${docs.length}-${h1.toString(36)}-${h2.toString(36)}`;
}

/**
 * 按给定的页面顺序整体重排（导出前的手动排序用）
 *
 * 页面顺序变了，全局页码也会变，因此每页的编辑配置必须跟着页面一起搬家。
 * @param {Array} newSlots 新的页面槽位数组 [{ docId, localPage }]
 * @returns {boolean} 是否发生了实际变化
 */
export function reorderPages(newSlots) {
    if (!Array.isArray(newSlots) || newSlots.length !== state.pageSlots.length) return false;

    const same = newSlots.every((s, i) => {
        const cur = state.pageSlots[i];
        return cur && cur.docId === s.docId && cur.localPage === s.localPage;
    });
    if (same) return false;

    state.pagesData = remapPagesData(state.pageSlots, newSlots, state.pagesData);
    state.pageSlots = newSlots.map(s => ({ docId: s.docId, localPage: s.localPage }));
    syncTotalPages();
    return true;
}

/**
 * 取得某个文件的第一页对应的全局页码（点击文件卡片时跳转用）
 * @param {string} docId 文件 id
 * @returns {number} 全局页码；找不到返回 0
 */
export function firstPageOf(docId) {
    const idx = state.pageSlots.findIndex(s => s.docId === docId);
    return idx < 0 ? 0 : idx + 1;
}
