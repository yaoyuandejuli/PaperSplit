// DOM 元素引用
export const elements = {
    fileInput: document.getElementById('fileInput'),
    uploadBtn: document.getElementById('uploadBtn'),
    changeFileBtn: document.getElementById('changeFileBtn'),
    prevPageBtn: document.getElementById('prevPageBtn'),
    nextPageBtn: document.getElementById('nextPageBtn'),
    pageInfo: document.getElementById('pageInfo'),

    // New controls
    toggleSealLineBtn: document.getElementById('toggleSealLineBtn'),
    applyToTypeBtn: document.getElementById('applyToTypeBtn'),
    applyToAllBtn: document.getElementById('applyToAllBtn'),

    // 方向旋转
    rotateLeftBtn: document.getElementById('rotateLeftBtn'),
    rotateRightBtn: document.getElementById('rotateRightBtn'),
    rotateAngle: document.getElementById('rotateAngle'),
    rotateFineSlider: document.getElementById('rotateFineSlider'),
    rotateFineVal: document.getElementById('rotateFineVal'),
    resetRotationBtn: document.getElementById('resetRotationBtn'),
    // 裁剪后调整（作用于成品页大小，导出时生效）
    cropZoomSlider: document.getElementById('cropZoomSlider'),
    cropZoomVal: document.getElementById('cropZoomVal'),
    cropZoomApplied: document.getElementById('cropZoomApplied'),
    cropZoomState: document.getElementById('cropZoomState'),
    cropZoomInBtn: document.getElementById('cropZoomInBtn'),
    cropZoomOutBtn: document.getElementById('cropZoomOutBtn'),
    cropZoomResetBtn: document.getElementById('cropZoomResetBtn'),
    applyCropZoomBtn: document.getElementById('applyCropZoomBtn'),
    cropPreview: document.getElementById('cropPreview'),

    exportBtn: document.getElementById('exportBtn'),
    exportFitSelect: document.getElementById('exportFitSelect'),
    addSplitBtn: document.getElementById('addSplitBtn'),
    // 去除分割线（点击即删）
    removeSplitBtn: document.getElementById('removeSplitBtn'),
    // 恢复当前页默认编辑状态
    resetDefaultsBtn: document.getElementById('resetDefaultsBtn'),
    // 分栏预设：两栏 / 三栏
    splitHalfBtn: document.getElementById('splitHalfBtn'),
    splitThirdBtn: document.getElementById('splitThirdBtn'),
    // 擦除内容（框选 + 涂抹）
    maskToggleBtn: document.getElementById('maskToggleBtn'),
    maskBrushBtn: document.getElementById('maskBrushBtn'),
    maskBrushSlider: document.getElementById('maskBrushSlider'),
    maskBrushVal: document.getElementById('maskBrushVal'),
    maskUndoBtn: document.getElementById('maskUndoBtn'),
    clearMasksBtn: document.getElementById('clearMasksBtn'),
    maskApplyBtn: document.getElementById('maskApplyBtn'),
    maskCount: document.getElementById('maskCount'),
    thumbnailsPanel: document.getElementById('thumbnailsPanel'),
    canvasContainer: document.getElementById('canvasContainer'),
    canvasWrapper: document.getElementById('canvasWrapper'),
    emptyState: document.getElementById('emptyState'),
    dragOverlay: document.getElementById('dragOverlay')
};
