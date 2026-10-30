/**
 * 全局状态管理
 */
export const state = {
    currentPage: 1,       // 当前页码
    totalPages: 0,        // 总页数
    pagesData: {},        // 页面配置数据 { pageIndex: { splitLines: number[], sealLine } }
    fileName: 'document', // 当前文件名（仅用于本地存储记录的展示名）
    rotationBase: 0,      // 整转基准角 ([0,360))，微调滑块相对此偏移
    outputScaleDraft: 1,  // 「裁剪后调整」待应用比例（应用到当前页后写入 config.outputScale）
    brushSize: 0.06,      // 「涂抹擦除」笔刷直径，占页面宽度的比例
    removeSplitMode: false, // 「去除分割线」选择模式：开启后点击画布上的分割线进行标记
    fileFingerprint: '',   // 当前文件集合的指纹（用于编辑配置自动保存/恢复）
    suppressSave: false,   // 载入/恢复过程中的首次渲染不触发自动保存（避免"没编辑也存记录"）
    saveDisabled: false,   // 用户手动清除保存记录后，停止该文件的自动保存
    documents: [],         // 已导入的文件条目（按导入先后）[{ id, name, type, pdfDoc, imageUrl, pageCount }]
    pageSlots: [],         // 当前排序后的页面序列 [{ docId, localPage }]
    docSeq: 0             // 文件 id 自增序号
};

/**
 * 重置全局状态到初始值
 * 用于加载新文件前清理旧数据
 */
export function resetState() {
    state.currentPage = 1;
    state.totalPages = 0;
    state.pagesData = {};
    state.rotationBase = 0;
    state.outputScaleDraft = 1;
    state.brushSize = 0.06;
    state.removeSplitMode = false;
    state.fileFingerprint = '';
    state.suppressSave = false;
    state.saveDisabled = false;
    state.documents = [];
    state.pageSlots = [];
    // 注意：docSeq **不归零**。
    // 它是全局单调递增的文件 id 计数器，若在此归零，下一次导入的文件会拿到
    // 与旧集合重复的 id（doc1/doc2…），导致按 id 索引的页面映射错位。
    // 追加导入时旧集合仍在，id 必须始终唯一。
}
