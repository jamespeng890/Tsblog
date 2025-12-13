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
}

export default {
  async fetch(request: Request, env: CloudflareEnv): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // CORS设置
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Key',
      'Content-Type': 'application/json; charset=utf-8',
    };

    // 处理CORS预检请求
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers });
    }

    try {
      // API路由
      if (pathname.startsWith('/api/')) {
        return handleApiRequest(request, env);
      }

      // 静态文件服务
      return new Response('Not Found', { status: 404, headers });
    } catch (error) {
      console.error('Error:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
        status: 500,
        headers,
      });
    }
  },
};

async function handleApiRequest(request: Request, env: CloudflareEnv): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const method = request.method;

  // 解析请求体
  let body: any = {};
  if (method !== 'GET' && method !== 'OPTIONS') {
    try {
      body = await request.json();
    } catch {
      // 忽略JSON解析错误
    }
  }

  // 解析认证信息
  const auth = parseAuthContext(request);

  // 构建API请求对象
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

  // 路由处理
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
    response = { status: 404, body: { error: 'Not Found' } };
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
