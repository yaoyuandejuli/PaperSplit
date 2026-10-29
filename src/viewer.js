import { state } from './state.js';
import { elements } from './dom.js';
import { renderSplitLines, getPageConfig } from './editor.js';
import { renderMasks, renderAppliedErasures } from './mask-editor.js';
import { rotateCanvas, rotatedBounds } from './utils.js';
import { syncCropZoomFromPage } from './crop-adjust.js';

/**
 * 切换到指定页面
 * @param {number} pageNum 目标页码
 */
export function changePage(pageNum) {
    if (pageNum < 1 || pageNum > state.totalPages) return;

    state.currentPage = pageNum;
    // 翻页时把旋转基准重置为该页绝对角，微调滑块归零
    state.rotationBase = getPageConfig(state.currentPage).rotation || 0;
    if (elements.rotateFineSlider) {
        elements.rotateFineSlider.value = 0;
        if (elements.rotateFineVal) elements.rotateFineVal.textContent = '0';
    }
    // 「裁剪后调整」的待应用值同步为该页已应用值
    syncCropZoomFromPage();
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
    if (elements.rotateFineSlider) {
        elements.rotateFineSlider.value = 0;
        if (elements.rotateFineVal) elements.rotateFineVal.textContent = '0';
    }
    renderCurrentPage();
}

/**
 * 重置当前页方向角度为 0°（同时重置整转基准与微调滑块）
 */
export function resetRotation() {
    const config = getPageConfig(state.currentPage);
    config.rotation = 0;
    state.rotationBase = 0;
    if (elements.rotateFineSlider) {
        elements.rotateFineSlider.value = 0;
        if (elements.rotateFineVal) elements.rotateFineVal.textContent = '0';
    }
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
    renderCurrentPage();
}

/**
 * 更新分页控件状态 (页码显示、按钮禁用)
 */
export function updatePageControls() {
    elements.pageInfo.textContent = `${state.currentPage} / ${state.totalPages}`;
    elements.prevPageBtn.disabled = state.currentPage <= 1;
    elements.nextPageBtn.disabled = state.currentPage >= state.totalPages;
}

/**
 * 渲染当前主页面的 Canvas
 * 会自动计算缩放比例以适应容器
 */
let renderToken = 0;

export async function renderCurrentPage() {
    // 每次渲染分配一个唯一令牌；异步完成后若令牌已过期则丢弃，避免并发渲染叠加重影
    const myToken = ++renderToken;

    let canvas, viewport;

    const rotation = getPageConfig(state.currentPage).rotation || 0;

    if (state.isPdf) {
        const page = await state.pdfDoc.getPage(state.currentPage);
        const unscaledViewport = page.getViewport({ scale: 1 });

        // 获取容器的可用宽高 (减去 padding)
        const availableWidth = elements.canvasContainer.clientWidth - 40;
        const availableHeight = elements.canvasContainer.clientHeight - 40;

        // 按旋转后的外接矩形尺寸做 Fit Page（支持任意角度，避免裁切）
        const disp = rotatedBounds(unscaledViewport.width, unscaledViewport.height, rotation);
        const dispW = disp.width;
        const dispH = disp.height;
        const scaleX = availableWidth / dispW;
        const scaleY = availableHeight / dispH;

        // Fit Page：按容器适配（显示比例统一由「裁剪后调整」控制成品页大小）
        let fitScale = Math.min(scaleX, scaleY);
        if (fitScale > 1.5) fitScale = 1.5; // 防止无意义放大
        fitScale = Math.max(fitScale, 0.1);
        const scale = fitScale;

        viewport = page.getViewport({ scale: scale });
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
            img.src = state.fileData;
        });

        const availableWidth = elements.canvasContainer.clientWidth - 40;
        const availableHeight = elements.canvasContainer.clientHeight - 40;

        // 按旋转后的外接矩形尺寸做 Fit Page（支持任意角度）
        const disp = rotatedBounds(img.width, img.height, rotation);
        const dispW = disp.width;
        const dispH = disp.height;
        const scaleX = availableWidth / dispW;
        const scaleY = availableHeight / dispH;
        let fitScale = Math.min(scaleX, scaleY);
        if (fitScale > 1) fitScale = 1;
        fitScale = Math.max(fitScale, 0.1);
        const scale = fitScale;

        canvas = document.createElement('canvas');
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const context = canvas.getContext('2d');
        context.drawImage(img, 0, 0, canvas.width, canvas.height);

        viewport = { width: canvas.width, height: canvas.height };
    }

    // 应用方向旋转，得到显示画布。分割线/密封线/切片坐标均基于此旋转后坐标系。
    canvas = rotateCanvas(canvas, rotation);
    // 注意：旋转会生成新画布，类名需在此处重新设置
    canvas.className = 'page-canvas';
    viewport = { width: canvas.width, height: canvas.height };

    // 把「已应用」的去除区域真正画到画布上 —— 画布直接显示去除后的内容
    renderAppliedErasures(canvas);

    // 渲染期间若有更新的渲染请求（翻页/缩放），则放弃本次结果
    if (myToken !== renderToken) return;

    elements.canvasWrapper.innerHTML = ''; // 清除旧的 Canvas 和裁切线
    elements.canvasWrapper.style.width = `${canvas.width}px`;
    elements.canvasWrapper.style.height = `${canvas.height}px`;
    elements.canvasWrapper.appendChild(canvas);

    // 恢复或添加默认裁切线
    renderSplitLines();

    // 渲染「去除内容」遮盖框（覆盖在画布之上）
    renderMasks();
}

/**
 * 渲染左侧缩略图列表
 */
export async function renderThumbnails() {
    elements.thumbnailsPanel.innerHTML = '';

    for (let i = 1; i <= state.totalPages; i++) {
        const thumbainer = document.createElement('div');
        thumbainer.className = `thumbnail-item ${i === state.currentPage ? 'active' : ''}`;
        thumbainer.dataset.pageNumber = i;
        thumbainer.onclick = () => changePage(i);

        let canvas;

        if (state.isPdf) {
            const page = await state.pdfDoc.getPage(i);
            const viewport = page.getViewport({ scale: 0.2 }); // 缩略图比例
            canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;
        } else {
            // 图片缩略图
            const img = new Image();
            img.src = state.fileData;
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
        elements.thumbnailsPanel.appendChild(thumbainer);
    }
}
