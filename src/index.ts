// ... (保留之前的 import)
import {
  handleLogin,
  // ... (保留其他 import)
} from './api/handlers.js';
import { parseAuthContext } from './utils/auth.js';

interface CloudflareEnv {
  DB: D1Database;
  ADMIN_USERNAME: string;
  ADMIN_PASSWORD: string;
  ASSETS: Fetcher; // ✨ 新增：这是 Cloudflare 用来获取静态资源(public文件夹)的接口
}

export default {
  async fetch(request: Request, env: CloudflareEnv): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // ... (保留 CORS 设置 headers)
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Key',
      'Content-Type': 'application/json; charset=utf-8',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers });
    }

    try {
      // API路由
      if (pathname.startsWith('/api/')) {
        return handleApiRequest(request, env);
      }

      // ✨ 关键修改：如果是静态文件（网页），交给 Cloudflare 静态资产处理器
      // 只有当 env.ASSETS 存在时才调用（本地开发和线上环境可能不同）
      if (env.ASSETS) {
         return env.ASSETS.fetch(request);
      }
      
      return new Response('Not Found', { status: 404, headers });
    } catch (error) {
      console.error('Error:', error);
      // ... (错误处理保持不变)
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
        status: 500,
        headers,
      });
    }
  },
};

// ... (handleApiRequest 函数保持不变)
