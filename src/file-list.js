/**
 * 已导入文件清单
 *
 * 左面板显示已导入的文件，支持：
 *   - 移除单个文件（它的页面会一并移除，其余页面的编辑配置自动跟位）
 *   - 点击卡片跳转到该文件的第一页
 *   - 继续添加更多文件（追加到末尾）
 *
 * 桌面端清单常驻展开；手机端收在右侧竖条里，点击标题展开 / 收起。
 *
 * 注意：文件本身**不支持拖拽重排** —— 页面先后统一由「导出前排序」（页级）调整，
 * 那里可以把任意文件的所有页整体前移 / 后移，功能上完全覆盖文件级重排。
 */
import { state } from './state.js';
import { elements } from './dom.js';
import { getOrderedDocs, removeDocument, firstPageOf } from './documents.js';
import { renderThumbnails, renderCurrentPage, changePage, updatePageControls } from './viewer.js';
import { showToast } from './toast.js';

/**
 * 展开 / 收起文件清单（仅手机端生效，桌面端始终展开）
 */
export function toggleFileList() {
    const box = elements.fileListBox;
    if (!box) return;
    const expanded = box.classList.toggle('expanded');
    if (elements.fileListToggle) {
        elements.fileListToggle.setAttribute('aria-expanded', String(expanded));
    }
}

/**
 * 渲染文件清单
 */
export function renderFileList() {
    if (!elements.fileList) return;

    const docs = getOrderedDocs();
    const multi = docs.length > 1;

    // 单文件时不显示文件清单区，避免占用左面板空间
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
        li.dataset.docId = doc.id;
        li.title = `${doc.name}（${doc.pageCount} 页）\n点击跳转到该文件的第一页`;

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

        li.append(badge, name, pages, remove);

        // 点击卡片跳转到该文件的第一页
        li.addEventListener('click', () => {
            const page = firstPageOf(doc.id);
            if (page) changePage(page);
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
