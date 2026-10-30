#!/usr/bin/env node
/**
 * PaperSplit 本地服务器（零依赖，Node.js 内置模块）
 *
 * 为什么不用 `python -m http.server`？
 *   Python 的 SimpleHTTPRequestHandler 使用 **HTTP/1.0**，不支持 keep-alive，
 *   浏览器复用连接时服务器会直接断开（ERR_CONNECTION_RESET）。
 *   实测并发 6 个请求就有 2 个超时，页面样式、主脚本、PDF 解析组件都会随机加载失败，
 *   最终表现为「无法加载 PDF 文件」——这其实不是程序的问题，是服务器扛不住浏览器的并发请求。
 *
 * 本脚本使用 Node 内置的 http 模块，默认启用 keep-alive 并能并发处理请求，
 * 同时正确设置 .js / .mjs / .css / .woff2 的 MIME 类型，适合本地预览与局域网部署。
 *
 * 用法：
 *   node scripts/serve.js                 # 服务 dist/，端口 8080
 *   node scripts/serve.js 3000            # 指定端口
 *   node scripts/serve.js 3000 docs       # 指定端口与目录
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const port = Number(process.argv[2]) || 8080;
const dirArg = process.argv[3] || 'dist';
const DIR = path.resolve(ROOT, dirArg);

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.map': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.webp': 'image/webp',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.pdf': 'application/pdf',
    '.wasm': 'application/wasm'
};

if (!fs.existsSync(DIR)) {
    console.error(`\n✗ 找不到目录：${DIR}`);
    console.error('\n请先构建产物：npm run build');
    console.error('或改为指定其他目录：node scripts/serve.js 8080 docs\n');
    process.exit(1);
}

const server = http.createServer((req, res) => {
    let pathname;
    try {
        pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    } catch {
        res.writeHead(400).end('Bad Request');
        return;
    }

    if (pathname.endsWith('/')) pathname += 'index.html';

    const filePath = path.join(DIR, pathname);
    // 防目录穿越
    if (!filePath.startsWith(DIR)) {
        res.writeHead(403).end('Forbidden');
        return;
    }

    fs.stat(filePath, (err, stat) => {
        if (err || !stat.isFile()) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('404 Not Found');
            return;
        }
        const type = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
        res.writeHead(200, {
            'Content-Type': type,
            'Content-Length': stat.size,
            'Cache-Control': 'no-cache'
        });
        fs.createReadStream(filePath).pipe(res);
    });
});

server.keepAliveTimeout = 30000;
server.headersTimeout = 35000;

server.listen(port, '0.0.0.0', () => {
    console.log('\n  PaperSplit 本地服务器已启动\n');
    console.log(`  本机访问：  http://localhost:${port}/`);
    console.log(`  局域网访问：http://<本机IP>:${port}/`);
    console.log(`  服务目录：  ${DIR}\n`);
    console.log('  按 Ctrl+C 停止\n');
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`\n✗ 端口 ${port} 已被占用，换一个：node scripts/serve.js ${port + 1}\n`);
    } else {
        console.error('\n✗ 启动失败：', err.message, '\n');
    }
    process.exit(1);
});
