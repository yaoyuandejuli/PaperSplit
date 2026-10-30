/**
 * 文件列表（多选导入后的文件顺序管理）
 *
 * 左面板顶部显示已导入的文件卡片，支持：
 *   - 拖拽调整文件先后顺序（顺序 = 各文件页面块在成品中的先后）
 *   - 移除单个文件（它的页面会一并移除，其余页面的编辑配置自动跟位）
 *   - 点击卡片跳转到该文件的第一页
 *   - 继续添加更多文件（追加到末尾）
 */
import { state } from './state.js';
import { elements } from './dom.js';
import { getOrderedDocs, moveDocument, removeDocument, firstPageOf } from './documents.js';
import { renderThumbnails, renderCurrentPage, changePage, updatePageControls } from './viewer.js';
import { showToast } from './toast.js';

/** 正在被拖拽的文件 id */
let draggingId = null;

/**
 * 渲染文件列表
 */
export function renderFileList() {
    if (!elements.fileList) return;

    const docs = getOrderedDocs();
    const multi = docs.length > 1;

    // 单文件时不显示文件列表区，避免占用左面板空间
    if (elements.fileListBox) {
        elements.fileListBox.hidden = docs.length === 0;
    }
    if (elements.fileListCount) {
        elements.fileListCount.textContent = docs.length
            ? `${docs.length} 个 · ${state.totalPages} 页`
            : '';
    }
    if (elements.addFilesBtn) {
        elements.addFilesBtn.hidden = !multi;
    }

    elements.fileList.innerHTML = '';

    for (const doc of docs) {
        const li = document.createElement('li');
        li.className = 'file-card';
        li.draggable = true;
        li.dataset.docId = doc.id;
        li.title = `${doc.name}（${doc.pageCount} 页）\n拖动可调整顺序，点击跳转到第一页`;

        const handle = document.createElement('span');
        handle.className = 'file-drag material-icons';
        handle.textContent = 'drag_indicator';
        handle.setAttribute('aria-hidden', 'true');

        const badge = document.createElement('span');
        badge.className = `file-badge ${doc.type === 'pdf' ? 'is-pdf' : 'is-img'}`;
        badge.textContent = doc.type === 'pdf' ? 'PDF' : 'IMG';

        const name = document.createElement('span');
        name.className = 'file-name';
        // 徽标已表示类型（PDF / IMG），文件名省略扩展名以节省横向空间
        name.textContent = doc.name.replace(/\.[^/.]+$/, '');

        const pages = document.createElement('span');
        pages.className = 'file-pages';
        pages.textContent = `${doc.pageCount} 页`;

        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'file-remove';
        remove.title = '移除此文件';
        remove.setAttribute('aria-label', `移除 ${doc.name}`);
        remove.textContent = '×';
        remove.addEventListener('click', (e) => {
            e.stopPropagation();
            handleRemove(doc);
        });

        li.append(handle, badge, name, pages, remove);

        li.addEventListener('click', () => {
            const page = firstPageOf(doc.id);
            if (page) changePage(page);
        });

        // --- 拖拽排序 ---
        li.addEventListener('dragstart', (e) => {
            draggingId = doc.id;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', doc.id);
            li.classList.add('dragging');
        });
        li.addEventListener('dragend', () => {
            draggingId = null;
            li.classList.remove('dragging');
            elements.fileList.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target'));
        });
        li.addEventListener('dragover', (e) => {
            if (!draggingId || draggingId === doc.id) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            const rect = li.getBoundingClientRect();
            const after = e.clientY > rect.top + rect.height / 2;
            li.classList.toggle('drop-above', !after);
            li.classList.toggle('drop-below', after);
        });
        li.addEventListener('dragleave', () => {
            li.classList.remove('drop-above', 'drop-below');
        });
        li.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            li.classList.remove('drop-above', 'drop-below');
            if (!draggingId || draggingId === doc.id) return;

            const rect = li.getBoundingClientRect();
            const after = e.clientY > rect.top + rect.height / 2;

            const ordered = getOrderedDocs();
            const fromIdx = ordered.findIndex(d => d.id === draggingId);
            const targetIdx = ordered.findIndex(d => d.id === doc.id);
            if (fromIdx < 0 || targetIdx < 0) return;

            // 目标位置：拖到卡片上方 → 插到它前面；拖到下方 → 插到它后面
            let insertAt = after ? targetIdx + 1 : targetIdx;
            if (fromIdx < insertAt) insertAt -= 1;   // 移除自身后索引前移

            if (moveDocument(draggingId, insertAt)) {
                renderFileList();
                refreshAfterReorder();
                showToast('文件顺序已更新', 'success');
            }
        });

        elements.fileList.appendChild(li);
    }
}

/**
 * 移除一个文件
 * @param {Object} doc 文件条目
 */
async function handleRemove(doc) {
    const remaining = state.totalPages - doc.pageCount;
    if (remaining <= 0) {
        showToast('这是最后一个文件，移除后请重新导入', 'info');
        return;
    }
    if (!confirm(`确定移除「${doc.name}」吗？\n该文件的 ${doc.pageCount} 页会一并移除。`)) {
        return;
    }

    removeDocument(doc.id);

    // 页码会变化，重新渲染并把当前页收敛到合法范围
    if (state.currentPage > state.totalPages) {
        state.currentPage = state.totalPages;
    }
    renderFileList();
    updatePageControls();
    await renderThumbnails();
    await renderCurrentPage();
    showToast(`已移除「${doc.name}」`, 'success');
}

/**
 * 顺序变化后的统一刷新
 */
export async function refreshAfterReorder() {
    if (state.currentPage > state.totalPages) {
        state.currentPage = state.totalPages;
    }
    updatePageControls();
    await renderThumbnails();
    await renderCurrentPage();
}
