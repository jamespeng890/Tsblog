// 1. 先写所有的 import (必须在最上面)
import { Buffer } from 'node:buffer';
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

// 2. import 结束后，立即注入 Buffer Polyfill
// 这行代码解决了 "Dynamic require of buffer" 的报错
(globalThis as any).Buffer = Buffer;

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
      // API 路由处理
      if (pathname.startsWith('/api/')) {
        return await handleApiRequest(request, env);
      }

      // 静态资源服务 (前端页面)
      if (env.ASSETS) {
         return await env.ASSETS.fetch(request);
      }
      
      return new Response('Not Found', { status: 404, headers });

    } catch (error: any) {
      // 错误捕获
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

// API 分发逻辑
async function handleApiRequest(request: Request, env: CloudflareEnv): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const method = request.method;

  let body: any = {};
  if (method !== 'GET' && method !== 'OPTIONS') {
    try {
      body = await request.json();
    } catch {
      // ignore
    }
  }

  const auth = parseAuthContext(request);

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
      response = { status: 405, body: { error: 'Method Not Allowed' } };
    }
  } else if (pathname.startsWith('/api/posts/')) {
    const slug = pathname.replace('/api/posts/', '');
    response = await handleGetPost(apiRequest, slug);
  } else if (pathname === '/api/comments') {
    if (method === 'POST') {
      response = await handleCreateComment(apiRequest);
    } else {
      response = { status: 405, body: { error: 'Method Not Allowed' } };
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
