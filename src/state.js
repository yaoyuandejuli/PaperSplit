/**
 * 全局状态管理
 */
export const state = {
    pdfDoc: null,         // PDF.js 文档对象
    currentPage: 1,       // 当前页码
    totalPages: 0,        // 总页数
    scale: 1.5,           // 渲染缩放比例
    pagesData: {},        // 页面配置数据 { pageIndex: { splitLines: number[], sealLine } }
    fileName: 'document', // 当前文件名
    isPdf: true,          // 文件类型标识
    fileData: null,       // 图片文件数据 (DataURL)
    rotationBase: 0,      // 整转基准角 ([0,360))，微调滑块相对此偏移
    outputScaleDraft: 1,  // 「裁剪后调整」待应用比例（应用到当前页后写入 config.outputScale）
    brushSize: 0.06,      // 「涂抹去除」笔刷直径，占页面宽度的比例
    removeSplitMode: false // 「去除分割线」选择模式：开启后点击画布上的分割线进行标记
};

/**
 * 重置全局状态到初始值
 * 用于加载新文件前清理旧数据
 */
export function resetState() {
    state.pdfDoc = null;
    state.currentPage = 1;
    state.totalPages = 0;
    state.pagesData = {};
    state.fileData = null;
    state.isPdf = true;
    state.rotationBase = 0;
    state.outputScaleDraft = 1;
    state.brushSize = 0.06;
    state.removeSplitMode = false;
}
