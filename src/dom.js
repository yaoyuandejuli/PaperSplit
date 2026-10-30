// DOM 元素引用
export const elements = {
    fileInput: document.getElementById('fileInput'),
    uploadBtn: document.getElementById('uploadBtn'),
    changeFileBtn: document.getElementById('changeFileBtn'),
    prevPageBtn: document.getElementById('prevPageBtn'),
    nextPageBtn: document.getElementById('nextPageBtn'),
    pageInfo: document.getElementById('pageInfo'),

    // New controls
    // 编辑工具 · 批量应用：奇数页 / 偶数页（并排一行）+ 所有页（独占一行）
    applyToOddBtn: document.getElementById('applyToOddBtn'),
    applyToEvenBtn: document.getElementById('applyToEvenBtn'),
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
    // 清除本文件已保存的编辑配置
    clearSaveBtn: document.getElementById('clearSaveBtn'),
    addSplitBtn: document.getElementById('addSplitBtn'),
    // 去除分割线（点击即删）
    removeSplitBtn: document.getElementById('removeSplitBtn'),
    // 密封线（独立分区：开关 + 左右切换 + 状态 + 批量应用）
    toggleSealLineBtn: document.getElementById('toggleSealLineBtn'),
    sealStatus: document.getElementById('sealStatus'),
    sealLeftBtn: document.getElementById('sealLeftBtn'),
    sealRightBtn: document.getElementById('sealRightBtn'),
    // 密封线 · 批量应用：奇数页 / 偶数页（并排一行）+ 所有页（独占一行）
    sealApplyOddBtn: document.getElementById('sealApplyOddBtn'),
    sealApplyEvenBtn: document.getElementById('sealApplyEvenBtn'),
    sealApplyAllBtn: document.getElementById('sealApplyAllBtn'),
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
    dragOverlay: document.getElementById('dragOverlay'),

    // 文件列表（多选导入 + 拖拽排序）
    fileListBox: document.getElementById('fileListBox'),
    fileList: document.getElementById('fileList'),
    fileListCount: document.getElementById('fileListCount'),
    addFilesBtn: document.getElementById('addFilesBtn'),

    // 导出前排序面板（页级手动排序）
    openSortBtn: document.getElementById('openSortBtn'),
    sortPanel: document.getElementById('sortPanel'),
    sortPanelMask: document.getElementById('sortPanelMask'),
    sortPanelList: document.getElementById('sortPanelList'),
    sortPanelClose: document.getElementById('sortPanelClose'),
    sortPanelCancel: document.getElementById('sortPanelCancel'),
    sortPanelApply: document.getElementById('sortPanelApply'),
    sortPanelReset: document.getElementById('sortPanelReset'),
    sortPanelCount: document.getElementById('sortPanelCount')
};
