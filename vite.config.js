import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 把 PDF worker 源码内联成 base64 字符串，注入到构建产物中。
 *
 * 背景：PDF.js 的 worker 是一个独立的 ES module 文件，浏览器必须单独向服务器
 * 请求它才能加载。真实内网环境里这一步经常失败：
 *   - 服务器 MIME 不对（返回 application/octet-stream）→ 浏览器拒绝执行；
 *   - 服务器并发能力弱 → 浏览器并发拉取资源时连接被 reset；
 *   - 服务器对 worker 路径做了限制 / 白名单 → 直接 403。
 *
 * 把源码内联进主包后，worker 不再需要任何独立请求：
 *   - 运行时用 base64 解码出源码 → 生成 Blob URL → 交给 PDF.js；
 *   - 完全不依赖服务器对 worker 文件的响应，MIME 与并发问题一并消失。
 *
 * 内联的代价是首屏包体积增加约 1.4MB（base64 编码后），因此 worker 采用
 * **动态导入**的方式按需加载：用户上传 PDF 时才下载，不影响首屏。
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
            const source = fs.readFileSync(workerPath, 'utf-8');
            const b64 = Buffer.from(source, 'utf-8').toString('base64');
            return `export default ${JSON.stringify(b64)};`;
        },
        // 开发模式也需要能解析该虚拟模块（供动态 import 使用）
        configureServer(server) {
            server.middlewares.use((req, res, next) => {
                if (!req.url || !req.url.includes('virtual:pdf-worker-inline')) {
                    return next();
                }
                res.setHeader('Content-Type', 'application/javascript');
                res.end(
                    `export default ${JSON.stringify(readWorkerBase64(workerPath))};`
                );
            });
        }
    };
}

/** 读取 worker 源码并转成 base64（依赖未安装时返回空串） */
function readWorkerBase64(workerPath) {
    if (!fs.existsSync(workerPath)) return '';
    return Buffer.from(fs.readFileSync(workerPath, 'utf-8'), 'utf-8').toString('base64');
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
