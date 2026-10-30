import { defineConfig } from 'vite';

export default defineConfig({
    base: './', // 使用相对路径，解决本地构建打开白屏问题
    build: {
        rollupOptions: {
            output: {
                // 仅固定 pdfjs 的大依赖；jspdf 交给 Rollup 按动态 import 自然切分，
                // 若手动分组会把 Vite 预加载助手一并塞进 jspdf chunk，反而使其被首屏静态引用
                manualChunks: {
                    'pdf-core': ['pdfjs-dist']
                },
                // PDF.js 的 worker 是 ES module，浏览器对 module 脚本做**严格 MIME 校验**：
                // 只要服务器把 .mjs 当成 application/octet-stream，worker 就会被拒绝加载，
                // 进而导致「无法加载 PDF 文件」（很多简易静态服务器 / 老版本 Python http.server 如此）。
                // 统一改名成 .js —— 几乎所有服务器都认识 .js，兼容性最好。
                assetFileNames: (assetInfo) => {
                    const mjs = (assetInfo.names || []).find(n => n.endsWith('.mjs'));
                    if (mjs) {
                        return `assets/${mjs.slice(0, -4)}-[hash].js`;
                    }
                    return 'assets/[name]-[hash][extname]';
                }
            }
        }
    }
});
