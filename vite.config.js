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
                }
            }
        }
    }
});
