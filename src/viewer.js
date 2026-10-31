import { state } from './state.js';
import { elements } from './dom.js';
import { renderSplitLines, getPageConfig, syncRotationUI } from './editor.js';
import { renderMasks, renderAppliedErasures } from './mask-editor.js';
import { rotateCanvas } from './utils.js';
import { syncCropZoomFromPage } from './crop-adjust.js';
import { getPageSource, reorderPages } from './documents.js';
import { showToast } from './toast.js';
import { setFitScale, resetView } from './viewport.js';

/**
 * 渲染质量系数
 * 以「适配尺寸 × 该系数」渲染，放大后依然清晰（同时为缩放手势留出余量）
 */
const RENDER_QUALITY = 2.5;

/** 渲染倍率上限（PDF 可放大渲染，图片不放大超过原始像素） */
const MAX_RENDER_SCALE_PDF = 2;
const MAX_RENDER_SCALE_IMAGE = 1;

/** 单轴渲染像素上限（防止超大页面把移动端内存打爆） */
const MAX_RENDER_DIM = 2800;

/**
 * 上一次渲染的基准信息
 * 重新适配时（Header 折叠 / 窗口变化）复用，避免整页重新渲染
 */
let lastRender = null;

/**
 * 取景框内部可用尺寸
 * 红框本身尺寸固定，这里量的是「框内可视区」，也就是图片能占满的范围
 * @returns {{w:number,h:number}} 宽高（像素）
 */
function getViewportBox() {
    const clip = elements.a3Clip;
    const w = clip ? clip.clientWidth : 0;
    const h = clip ? clip.clientHeight : 0;
    if (w > 0 && h > 0) return { w, h };

    // 兜底：取景框尚未完成布局时，用中间区域的尺寸
    const c = elements.canvasContainer;
    return {
        w: Math.max(1, (c ? c.clientWidth : 0) - 24),
        h: Math.max(1, (c ? c.clientHeight : 0) - 24)
    };
}

/**
 * 计算适配系数：把内容完整放进取景框（contain，横向纵向都不裁切）
 * @param {number} w 内容原始宽度
 * @param {number} h 内容原始高度
 * @param {number} boxW 可用宽度
 * @param {number} boxH 可用高度
 * @returns {number} 适配系数
 */
function computeFitScale(w, h, boxW, boxH) {
    if (!(w > 0) || !(h > 0) || !(boxW > 0) || !(boxH > 0)) return 1;
    return Math.min(boxW / w, boxH / h);
}

/**
 * 计算渲染倍率：适配系数 × 质量系数，并受上限与像素上限约束
 * @param {number} fit 适配系数
 * @param {number} maxScale 渲染倍率上限
 * @returns {number} 渲染倍率
 */
function computeRenderScale(fit, maxScale) {
    const s = fit * RENDER_QUALITY;
    return Math.min(maxScale, Math.max(0.05, s));
}

/**
 * 切换到指定页面
 * @param {number} pageNum 目标页码
 */
export function changePage(pageNum) {
    if (pageNum < 1 || pageNum > state.totalPages) return;

    state.currentPage = pageNum;
    // 翻页时把旋转基准重置为该页绝对角，微调滑块归零（偏移 = 角度 - 基准 = 0）
    state.rotationBase = getPageConfig(state.currentPage).rotation || 0;
    syncRotationUI();
    // 「裁剪后调整」的待应用值同步为该页已应用值
    syncCropZoomFromPage();
    // 换页后取景框内的缩放 / 平移复位，保证新页面完整可见
    resetView();
    updatePageControls();

    // 更新缩略图选中状态
    const thumbs = elements.thumbnailsPanel.querySelectorAll('.thumbnail-item');
    thumbs.forEach(t => t.classList.remove('active'));
    if (thumbs[pageNum - 1]) thumbs[pageNum - 1].classList.add('active');

    renderCurrentPage();
}

/**
 * 旋转当前页内容方向（每页独立）
 * @param {number} delta 角度增量，+90 顺时针 / -90 逆时针
 */
export function rotatePage(delta) {
    const config = getPageConfig(state.currentPage);
    config.rotation = (((config.rotation || 0) + delta) % 360 + 360) % 360;
    // 整转（左/右 90°）后更新旋转基准为新的绝对角，微调滑块归零
    state.rotationBase = config.rotation;
    syncRotationUI();
    renderCurrentPage();
}

/**
 * 重置当前页方向角度为 0°（同时重置整转基准与微调滑块）
 */
export function resetRotation() {
    const config = getPageConfig(state.currentPage);
    config.rotation = 0;
    state.rotationBase = 0;
    syncRotationUI();
    renderCurrentPage();
}

/**
 * 设置当前页内容方向的绝对角度（支持任意自定义角度，用于纠正扫描歪斜）
 * @param {number|string} angle 目标角度（度），会被归一化到 [0, 360)
 */
export function setPageRotation(angle) {
    const v = Number(angle);
    if (!Number.isFinite(v)) return;
    const config = getPageConfig(state.currentPage);
    config.rotation = ((v % 360) + 360) % 360;
    syncRotationUI();
    renderCurrentPage();
}

/**
 * 把当前页的方向角度应用到当前页（确认并保存本页角度）
 *
 * 微调滑块在拖动时即已实时生效，本按钮用于「明确确认 + 落盘」：
 * 先补一次最终角度的写入（确保节流窗口内的最后一次改动也已落定），
 * 再写入本地存储并给出反馈。
 */
export function applyRotationToCurrent() {
    const offset = Number(elements.rotateFineSlider ? elements.rotateFineSlider.value : 0);
    const target = state.rotationBase + offset;
    const current = getPageConfig(state.currentPage).rotation || 0;

    // 比较两个角度是否等价（0 与 360 同义）
    const diff = Math.abs((((target - current) % 360) + 540) % 360 - 180);
    if (diff >= 0.01) {
        setPageRotation(target);
    }

    const angle = getPageConfig(state.currentPage).rotation || 0;
    showToast(`方向角度已应用到当前页（${angle}°）`, 'success');
    document.dispatchEvent(new CustomEvent('papersplit:config-changed'));
}

/**
 * 把当前页的方向角度应用到所有页面
 */
export function applyRotationToAll() {
    const angle = getPageConfig(state.currentPage).rotation || 0;
    if (!confirm(`确定把当前页的方向角度（${angle}°）应用到所有页面吗？`)) return;

    for (let i = 1; i <= state.totalPages; i++) {
        getPageConfig(i).rotation = angle;
    }

    showToast(`方向角度已应用到所有页面（${angle}°）`, 'success');
    document.dispatchEvent(new CustomEvent('papersplit:page-repaint'));
}

/**
 * 更新分页控件状态 (页码显示、按钮禁用)
 */
export function updatePageControls() {
    elements.pageInfo.textContent = `${state.currentPage} / ${state.totalPages}`;
    // 取景框角标同步页码（Header 收起后仍能看到当前页）
    if (elements.a3PageTag) {
        elements.a3PageTag.textContent = `${state.currentPage} / ${state.totalPages}`;
    }
    // 结果预览态的角标同步页码
    if (elements.previewPageTag) {
        elements.previewPageTag.textContent = `${state.currentPage} / ${state.totalPages}`;
    }
    elements.prevPageBtn.disabled = state.currentPage <= 1;
    elements.nextPageBtn.disabled = state.currentPage >= state.totalPages;
}

/**
 * 渲染当前主页面的 Canvas
 * 渲染到「A3 取景框」内：适配比例按取景框计算，
 * 渲染倍率高于适配倍率（保证放大清晰），显示时用 CSS 缩放抵消，
 * 因此图片旋转后超出红框的部分会被红框直接裁掉。
 */
let renderToken = 0;

export async function renderCurrentPage() {
    // 每次渲染分配一个唯一令牌；异步完成后若令牌已过期则丢弃，避免并发渲染叠加重影
    const myToken = ++renderToken;

    let canvas, baseW, baseH, renderScale;

    const rotation = getPageConfig(state.currentPage).rotation || 0;

    // 解析当前页来自哪个文件（多文件合并后，每页可能来源不同）
    const source = getPageSource(state.currentPage);
    if (!source) return;

    const box = getViewportBox();

    if (source.isPdf) {
        const page = await source.doc.pdfDoc.getPage(source.localPage);
        const unscaledViewport = page.getViewport({ scale: 1 });
        baseW = unscaledViewport.width;
        baseH = unscaledViewport.height;

        // 适配系数基于「未旋转」的页面尺寸 —— 纸张在屏幕上的大小不随旋转改变，
        // 旋转后超出取景框的部分由红框裁切（所见即所得）
        const fit = computeFitScale(baseW, baseH, box.w, box.h);
        renderScale = computeRenderScale(fit, MAX_RENDER_SCALE_PDF);
        renderScale = Math.min(renderScale, MAX_RENDER_DIM / baseW, MAX_RENDER_DIM / baseH);

        const viewport = page.getViewport({ scale: renderScale });
        canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({
            canvasContext: context,
            viewport: viewport
        }).promise;
    } else {
        // 图片渲染
        const img = new Image();
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = source.doc.imageUrl;
        });
        baseW = img.width;
        baseH = img.height;

        const fit = computeFitScale(baseW, baseH, box.w, box.h);
        renderScale = computeRenderScale(fit, MAX_RENDER_SCALE_IMAGE);

        canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(baseW * renderScale));
        canvas.height = Math.max(1, Math.round(baseH * renderScale));
        const context = canvas.getContext('2d');
        context.drawImage(img, 0, 0, canvas.width, canvas.height);
    }

    // 应用方向旋转，得到显示画布。分割线/密封线/切片坐标均基于此旋转后坐标系。
    canvas = rotateCanvas(canvas, rotation);
    // 注意：旋转会生成新画布，类名需在此处重新设置
    canvas.className = 'page-canvas';

    // 把「已应用」的擦除区域真正画到画布上 —— 画布直接显示擦除后的内容
    renderAppliedErasures(canvas);

    // 渲染期间若有更新的渲染请求（翻页/缩放），则放弃本次结果
    if (myToken !== renderToken) return;

    elements.canvasWrapper.innerHTML = ''; // 清除旧的 Canvas 和裁切线
    elements.canvasWrapper.style.width = `${canvas.width}px`;
    elements.canvasWrapper.style.height = `${canvas.height}px`;
    elements.canvasWrapper.appendChild(canvas);

    // 显示尺寸 = 内容尺寸 × 适配系数（渲染倍率由 CSS 抵消）
    const finalFit = computeFitScale(baseW, baseH, box.w, box.h);
    lastRender = { baseW, baseH, renderScale, fit: finalFit };
    setFitScale(finalFit / renderScale);

    // 恢复或添加默认裁切线
    renderSplitLines();

    // 渲染「擦除内容」遮盖框（覆盖在画布之上）
    renderMasks();
}

/**
 * 取景框尺寸变化后重新适配（不重新渲染页面，只重算显示比例）
 * Header 折叠 / 窗口缩放 / 屏幕旋转时调用
 */
export function refitCanvas() {
    if (!lastRender) return;
    const box = getViewportBox();
    const fit = computeFitScale(lastRender.baseW, lastRender.baseH, box.w, box.h);
    lastRender.fit = fit;
    setFitScale(fit / lastRender.renderScale);
}

/**
 * 缩略图密度分级
 *
 * 导入的文件越多，左侧预览图就越小，否则纵向堆叠后需要滚动很久才能看完。
 * 分三档：
 *   normal  —— 页数不多，缩略图占满整列（看得最清楚）
 *   compact —— 页数较多，两列并排（预览图缩小，仍可上下滑动选择）
 *   dense   —— 页数很多，三列并排（大幅缩小，一屏能看到更多页）
 *
 * 注意：这里只改**列数**，不改变缩略图的宽高比，
 * 面板依然是纵向滚动容器，页面足够多时仍能上下滑动选择任意一页。
 */
const THUMB_TIERS = [
    { max: 8, tier: 'normal' },
    { max: 24, tier: 'compact' },
    { max: Infinity, tier: 'dense' }
];

/** 按当前总页数决定缩略图密度档位 */
function pickThumbTier(totalPages) {
    for (const t of THUMB_TIERS) {
        if (totalPages <= t.max) return t.tier;
    }
    return 'dense';
}

/**
 * 缩略图拖拽排序：当前被拖动的源页码（1-based），未拖动时为 -1
 */
let dragFrom = -1;

/** 缩略图在手机端是横向平铺条，桌面端是纵向列表；据此决定「前后」判定用 X 还是 Y 轴 */
function isThumbHorizontal() {
    return window.matchMedia('(max-width: 768px)').matches;
}

/** 清除所有缩略图上的拖拽落点提示 */
function clearDropMarkers() {
    elements.thumbnailsPanel.querySelectorAll('.thumbnail-item').forEach(el =>
        el.classList.remove('drop-before', 'drop-after'));
}

/**
 * 拖动缩略图调整页面顺序（左侧预览图直接手动排序）
 *
 * 复用导出前排序底层的 reorderPages 重排 pageSlots，页面编辑配置（分割线 / 密封线 /
 * 旋转 / 擦除）会跟着页面一起搬家。重排后让视图仍停在「同一页内容」上，避免跳页。
 *
 * @param {number} fromPage 被拖动的源页码（1-based）
 * @param {number} insertIndex 在「删除源之后」的槽位数组里插入的目标下标
 */
async function reorderThumbnails(fromPage, insertIndex) {
    if (fromPage < 1 || fromPage > state.totalPages) return;
    if (insertIndex === fromPage - 1) return; // 落点即原位，无变化

    // 记录当前页对应的稳定槽位，重排后让视图继续显示同一份内容
    const cur = state.pageSlots[state.currentPage - 1];
    const key = cur ? `${cur.docId}:${cur.localPage}` : null;

    const slots = state.pageSlots.slice();
    const [moved] = slots.splice(fromPage - 1, 1);
    slots.splice(insertIndex, 0, moved);

    const changed = reorderPages(slots);
    if (!changed) return;

    if (key) {
        const idx = state.pageSlots.findIndex(s => `${s.docId}:${s.localPage}` === key);
        if (idx >= 0) state.currentPage = idx + 1;
    }
    if (state.currentPage > state.totalPages) state.currentPage = state.totalPages;

    updatePageControls();
    await renderThumbnails();
    await renderCurrentPage();
    // 文件顺序依赖 pageSlots，重排后同步刷新文件清单
    const { renderFileList } = await import('./file-list.js');
    renderFileList();
    showToast('页面顺序已更新', 'success');
}

/**
 * 渲染左侧缩略图列表
 */
export async function renderThumbnails() {
    elements.thumbnailsPanel.innerHTML = '';
    elements.thumbnailsPanel.dataset.tier = pickThumbTier(state.totalPages);

    // 先按顺序建好占位容器（保证缩略图顺序与页码一致），再并行渲染各自内容
    const slots = [];
    for (let i = 1; i <= state.totalPages; i++) {
        const thumbainer = document.createElement('div');
        thumbainer.className = `thumbnail-item ${i === state.currentPage ? 'active' : ''}`;
        thumbainer.dataset.pageNumber = i;
        thumbainer.draggable = true;
        thumbainer.onclick = () => changePage(i);

        // ---- 拖拽排序（手动调整左侧预览图顺序）----
        thumbainer.addEventListener('dragstart', (e) => {
            dragFrom = i;
            e.dataTransfer.effectAllowed = 'move';
            try { e.dataTransfer.setData('text/plain', String(i)); } catch (_) { /* 某些浏览器限制 */ }
            // 延迟加类，避免拖拽快照本身被半透明化
            requestAnimationFrame(() => thumbainer.classList.add('dragging'));
        });
        thumbainer.addEventListener('dragend', () => {
            thumbainer.classList.remove('dragging');
            dragFrom = -1;
            clearDropMarkers();
        });
        thumbainer.addEventListener('dragover', (e) => {
            if (dragFrom < 0 || dragFrom === i) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            const rect = thumbainer.getBoundingClientRect();
            const horizontal = isThumbHorizontal();
            const before = horizontal
                ? (e.clientX < rect.left + rect.width / 2)
                : (e.clientY < rect.top + rect.height / 2);
            clearDropMarkers();
            thumbainer.classList.add(before ? 'drop-before' : 'drop-after');
        });
        thumbainer.addEventListener('dragleave', () => {
            thumbainer.classList.remove('drop-before', 'drop-after');
        });
        thumbainer.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (dragFrom < 0 || dragFrom === i) { clearDropMarkers(); return; }
            const rect = thumbainer.getBoundingClientRect();
            const horizontal = isThumbHorizontal();
            const before = horizontal
                ? (e.clientX < rect.left + rect.width / 2)
                : (e.clientY < rect.top + rect.height / 2);
            const targetIdx = i - 1;
            let to = before ? targetIdx : targetIdx + 1;
            if (dragFrom - 1 < to) to -= 1; // 源在目标之前，删除源后目标下标前移
            clearDropMarkers();
            const from = dragFrom;
            dragFrom = -1;
            reorderThumbnails(from, to);
        });

        elements.thumbnailsPanel.appendChild(thumbainer);
        slots.push({ page: i, thumbainer });
    }

    /** 渲染单页缩略图画布 */
    const renderOne = async ({ page: i, thumbainer }) => {
        let canvas;

        const source = getPageSource(i);
        if (!source) return;

        if (source.isPdf) {
            const page = await source.doc.pdfDoc.getPage(source.localPage);
            const viewport = page.getViewport({ scale: 0.2 }); // 缩略图比例
            canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({
                canvasContext: context,
                viewport
            }).promise;
        } else {
            // 图片缩略图
            const img = new Image();
            img.src = source.doc.imageUrl;
            await new Promise(r => img.onload = r);

            // 简单的缩放
            const scale = 0.2; // 略微缩小
            canvas = document.createElement('canvas');
            canvas.width = img.width * scale;
            canvas.height = img.height * scale;
            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        }

        // 缩略图同步方向旋转，与主视图一致
        const rotation = getPageConfig(i).rotation || 0;
        canvas = rotateCanvas(canvas, rotation);

        const pageNum = document.createElement('div');
        pageNum.className = 'page-number';
        pageNum.textContent = i;

        thumbainer.appendChild(canvas);
        thumbainer.appendChild(pageNum);
    };

    // 并行渲染：页数多时比逐页 await 快得多
    await Promise.all(slots.map(renderOne));
}
