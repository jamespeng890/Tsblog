// 👇👇👇 必须加在文件最开头，解决 "Dynamic require of buffer" 报错 👇👇👇
import { Buffer } from 'node:buffer';
(globalThis as any).Buffer = Buffer;

// ... (下面接你原来的 import 代码)
import {
  handleLogin,
// ...
import {
  handleLogin,
  handleRegister,
  handleCreatePost,
  handleGetPosts,
  handleGetPost,
  handleCreateComment,
  handleGetComments,
  handleGetPendingComments,
  handleApproveComment,
} from './api/handlers.js';
import { parseAuthContext } from './utils/auth.js';

interface CloudflareEnv {
  DB: D1Database;
  ADMIN_USERNAME: string;
  ADMIN_PASSWORD: string;
  ASSETS: Fetcher;
}

export default {
  async fetch(request: Request, env: CloudflareEnv): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // CORS 设置
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
      // 1. 先处理 API 请求
      if (pathname.startsWith('/api/')) {
        return await handleApiRequest(request, env);
      }

      // 2. 再处理静态网页 (解决 404 问题)
      if (env.ASSETS) {
         return await env.ASSETS.fetch(request);
      }
      
      // 3. 如果都不是，返回 404
      return new Response('Not Found', { status: 404, headers });

    } catch (error: any) {
      // 捕获并打印详细错误，解决 500 莫名其妙的问题
      console.error('Fatal Error:', error);
      const errorMessage = error.message || 'Unknown Error';
      const errorStack = error.stack || '';
      
      return new Response(JSON.stringify({ 
        error: `Critical Error: ${errorMessage}`,
        debug: errorStack 
      }), {
        status: 500,
        headers,
      });
    }
  },
};

// API 路由分发逻辑
async function handleApiRequest(request: Request, env: CloudflareEnv): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const method = request.method;

  let body: any = {};
  if (method !== 'GET' && method !== 'OPTIONS') {
    try {
      body = await request.json();
    } catch {
      // 忽略 JSON 解析错误
    }
  }

  const auth = parseAuthContext(request);

  // 这里的 env 传递非常关键，确保 handlers 能读到 wranger.toml 里的密码
  const apiRequest = {
    method,
    path: pathname,
    body,
    auth,
    db: env.DB,
    env: {
      ADMIN_USERNAME: env.ADMIN_USERNAME,
      ADMIN_PASSWORD: env.ADMIN_PASSWORD,
    },
  };

  let response;

  // 路由匹配
  if (pathname === '/api/login') {
    response = await handleLogin(apiRequest);
  } else if (pathname === '/api/register') {
    response = await handleRegister(apiRequest);
  } else if (pathname === '/api/posts') {
    if (method === 'POST') {
      response = await handleCreatePost(apiRequest);
    } else if (method === 'GET') {
      response = await handleGetPosts(apiRequest);
    } else {
      response = { status: 405, body: { error: '方法不允许' } };
    }
  } else if (pathname.startsWith('/api/posts/')) {
    const slug = pathname.replace('/api/posts/', '');
    response = await handleGetPost(apiRequest, slug);
  } else if (pathname === '/api/comments') {
    if (method === 'POST') {
      response = await handleCreateComment(apiRequest);
    } else {
      response = { status: 405, body: { error: '方法不允许' } };
    }
  } else if (pathname.startsWith('/api/comments/')) {
    const parts = pathname.replace('/api/comments/', '').split('/');
    if (parts[0] === 'pending') {
      response = await handleGetPendingComments(apiRequest);
    } else {
      const commentId = parseInt(parts[0]);
      if (parts[1] === 'approve') {
        response = await handleApproveComment(apiRequest, commentId, body.status);
      } else {
        const postId = parseInt(parts[0]);
        response = await handleGetComments(apiRequest, postId);
      }
    }
  } else {
    response = { status: 404, body: { error: 'API Not Found' } };
  }

  const responseBody = typeof response.body === 'string' ? response.body : JSON.stringify(response.body);

  return new Response(responseBody, {
    status: response.status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

