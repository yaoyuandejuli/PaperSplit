/**
 * 导出前手动排序面板
 *
 * 这是页面顺序的**唯一**调整入口 —— 无论同一文件的页还是不同文件的页，
 * 都可以在这里逐页拖动或用上下按钮移动。
 *
 * 面板内是当前页面顺序的工作副本，拖拽或用上下按钮调整，
 * 点「应用」后才会真正写回；点「取消」或关闭则放弃本次改动。
 */
import { state } from './state.js';
import { elements } from './dom.js';
import { getPageSource, reorderPages } from './documents.js';
import { renderThumbnails, renderCurrentPage, updatePageControls } from './viewer.js';
import { showToast } from './toast.js';

/** 面板内的工作副本：[{ docId, localPage }] */
let working = [];

/** 正在被拖拽的条目下标 */
let dragIndex = -1;

/**
 * 打开排序面板
 */
export function openSortPanel() {
    if (!state.totalPages) {
        showToast('请先导入文件', 'info');
        return;
    }
    working = state.pageSlots.map(s => ({ docId: s.docId, localPage: s.localPage }));
    renderSortPanel();
    elements.sortPanel.hidden = false;
    // 触发过渡动画
    requestAnimationFrame(() => elements.sortPanel.classList.add('open'));
    document.body.classList.add('modal-open');
}

/**
 * 关闭排序面板（放弃改动）
 */
export function closeSortPanel() {
    elements.sortPanel.classList.remove('open');
    document.body.classList.remove('modal-open');
    setTimeout(() => { elements.sortPanel.hidden = true; }, 200);
}

/**
 * 应用排序
 */
export async function applySort() {
    const changed = reorderPages(working);
    closeSortPanel();

    if (state.currentPage > state.totalPages) {
        state.currentPage = state.totalPages;
    }
    updatePageControls();
    await renderThumbnails();
    await renderCurrentPage();

    showToast(changed ? '页面顺序已更新' : '顺序没有变化', changed ? 'success' : 'info');
}

/**
 * 恢复默认顺序（按文件导入先后 + 文件内页序）
 */
export function resetSort() {
    const order = new Map();
    state.documents.forEach((d, i) => order.set(d.id, i));
    working.sort((a, b) => {
        const oa = order.has(a.docId) ? order.get(a.docId) : 999;
        const ob = order.has(b.docId) ? order.get(b.docId) : 999;
        if (oa !== ob) return oa - ob;
        return a.localPage - b.localPage;
    });
    renderSortPanel();
    showToast('已恢复默认顺序（应用后生效）', 'info');
}

/**
 * 渲染排序面板内容
 */
async function renderSortPanel() {
    const list = elements.sortPanelList;
    if (!list) return;

    if (elements.sortPanelCount) {
        elements.sortPanelCount.textContent = `${working.length} 页`;
    }

    list.innerHTML = '';

    // 先建占位，保持顺序稳定
    const slots = [];
    working.forEach((slot, index) => {
        const li = document.createElement('li');
        li.className = 'sort-item';
        li.draggable = true;
        li.dataset.index = index;

        const order = document.createElement('span');
        order.className = 'sort-order';
        order.textContent = index + 1;

        const thumbBox = document.createElement('span');
        thumbBox.className = 'sort-thumb';

        const info = document.createElement('span');
        info.className = 'sort-info';

        const source = getPageSourceOf(slot);
        const doc = source ? source.doc : null;
        const name = document.createElement('span');
        name.className = 'sort-name';
        name.textContent = doc ? doc.name : '未知文件';

        const sub = document.createElement('span');
        sub.className = 'sort-sub';
        sub.textContent = doc
            ? (doc.type === 'pdf' ? `第 ${slot.localPage} 页 / 共 ${doc.pageCount} 页` : '图片')
            : '';

        info.append(name, sub);

        const ops = document.createElement('span');
        ops.className = 'sort-ops';

        const up = document.createElement('button');
        up.type = 'button';
        up.className = 'sort-op';
        up.title = '上移';
        up.setAttribute('aria-label', '上移');
        up.innerHTML = '<span class="material-icons">arrow_upward</span>';
        up.disabled = index === 0;
        up.addEventListener('click', () => moveItem(index, index - 1));

        const down = document.createElement('button');
        down.type = 'button';
        down.className = 'sort-op';
        down.title = '下移';
        down.setAttribute('aria-label', '下移');
        down.innerHTML = '<span class="material-icons">arrow_downward</span>';
        down.disabled = index === working.length - 1;
        down.addEventListener('click', () => moveItem(index, index + 1));

        ops.append(up, down);

        li.append(order, thumbBox, info, ops);

        // 拖拽排序
        li.addEventListener('dragstart', (e) => {
            dragIndex = index;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', String(index));
            li.classList.add('dragging');
        });
        li.addEventListener('dragend', () => {
            dragIndex = -1;
            li.classList.remove('dragging');
            list.querySelectorAll('.sort-item').forEach(el => el.classList.remove('drop-before', 'drop-after'));
        });
        li.addEventListener('dragover', (e) => {
            if (dragIndex < 0 || dragIndex === index) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            const rect = li.getBoundingClientRect();
            const before = e.clientY < rect.top + rect.height / 2;
            li.classList.toggle('drop-before', before);
            li.classList.toggle('drop-after', !before);
        });
        li.addEventListener('dragleave', () => {
            li.classList.remove('drop-before', 'drop-after');
        });
        li.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            li.classList.remove('drop-before', 'drop-after');
            if (dragIndex < 0 || dragIndex === index) return;

            const rect = li.getBoundingClientRect();
            const before = e.clientY < rect.top + rect.height / 2;
            let to = before ? index : index + 1;
            if (dragIndex < to) to -= 1;

            moveItem(dragIndex, to);
            dragIndex = -1;
        });

        list.appendChild(li);
        slots.push({ slot, li, thumbBox });
    });

    // 并行渲染缩略图
    await Promise.all(slots.map(async ({ slot, thumbBox }) => {
        const source = getPageSourceOf(slot);
        if (!source) return;
        try {
            const canvas = await renderThumb(source);
            if (canvas) thumbBox.appendChild(canvas);
        } catch (e) { /* 缩略图失败不影响排序 */ }
    }));
}

/**
 * 上移 / 下移一项
 * @param {number} from 源下标
 * @param {number} to 目标下标
 */
function moveItem(from, to) {
    if (to < 0 || to >= working.length || from === to) return;
    const [item] = working.splice(from, 1);
    working.splice(to, 0, item);
    renderSortPanel();
}

/**
 * 根据槽位找到源（面板打开期间 state.pageSlots 可能已变化，这里用 documents 兜底）
 * @param {Object} slot 页面槽位
 */
function getPageSourceOf(slot) {
    const doc = state.documents.find(d => d.id === slot.docId);
    if (!doc) return null;
    return { doc, localPage: slot.localPage, isPdf: doc.type === 'pdf' };
}

/**
 * 渲染单页缩略图
 * @param {Object} source 页面源
 * @returns {Promise<HTMLCanvasElement|null>}
 */
async function renderThumb(source) {
    const scale = 0.18;
    const canvas = document.createElement('canvas');

    if (source.isPdf) {
        const page = await source.doc.pdfDoc.getPage(source.localPage);
        const viewport = page.getViewport({ scale });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    } else {
        const img = new Image();
        img.src = source.doc.imageUrl;
        await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
    }
    return canvas;
}
