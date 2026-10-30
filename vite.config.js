import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 把 PDF worker 源码内联进构建产物。
 *
 * 背景：PDF.js 的 worker 是一个独立的 ES module 文件，浏览器必须单独向服务器
 * 请求它才能加载。真实内网环境里这一步经常失败：
 *   - 服务器 MIME 不对（返回 application/octet-stream）→ 浏览器拒绝执行；
 *   - 服务器并发能力弱 → 浏览器并发拉取资源时连接被 reset；
 *   - 服务器对 worker 路径做了限制 / 白名单 → 直接 403。
 *
 * 关键设计：worker 源码必须**静态导入**进主 chunk，而不是动态 import 成独立 chunk。
 * 动态 import 依然需要浏览器额外发一个请求，弱服务器照样会把它掐断；
 * 静态导入则由打包器把源码直接写进主 JS —— 服务器只要能返回主 JS 这一个文件，
 * PDF 功能就一定可用（于是「图片能正常处理」必然意味着「PDF 也能正常处理」）。
 *
 * 代价：主包体积增加约 1MB（源码原文），换取在任何服务器上的确定性。
 */
function inlinePdfWorker() {
    const workerPath = path.resolve(
        process.cwd(),
        'node_modules/pdfjs-dist/build/pdf.worker.min.mjs'
    );
    // Vite 约定：以 \0 开头的 ID 是「虚拟模块」，不会被解析到文件系统
    const virtualId = '\0virtual:pdf-worker-inline';
    const requestId = 'virtual:pdf-worker-inline';

    return {
        name: 'inline-pdf-worker',
        enforce: 'pre',
        resolveId(id) {
            if (id === virtualId || id === requestId) return virtualId;
            return null;
        },
        load(id) {
            if (id !== virtualId) return null;
            if (!fs.existsSync(workerPath)) {
                // 依赖未安装时不阻断构建，回退到普通 worker 文件
                return 'export default "";';
            }
            // 直接内联源码原文（比 base64 省约 25% 体积）
            const source = fs.readFileSync(workerPath, 'utf-8');
            return `export default ${JSON.stringify(source)};`;
        },
        // 开发模式也需要能解析该虚拟模块
        configureServer(server) {
            server.middlewares.use((req, res, next) => {
                if (!req.url || !req.url.includes('virtual:pdf-worker-inline')) {
                    return next();
                }
                res.setHeader('Content-Type', 'application/javascript');
                res.end(
                    `export default ${JSON.stringify(readWorkerSource(workerPath))};`
                );
            });
        }
    };
}

/** 读取 worker 源码（依赖未安装时返回空串） */
function readWorkerSource(workerPath) {
    if (!fs.existsSync(workerPath)) return '';
    return fs.readFileSync(workerPath, 'utf-8');
}

export default defineConfig({
    base: './', // 使用相对路径，解决本地构建打开白屏问题
    plugins: [inlinePdfWorker()],
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
