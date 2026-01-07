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
  JWT_SECRET?: string;
  ASSETS: Fetcher;
}

export default {
  async fetch(request: Request, env: CloudflareEnv): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // CORS Headers
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
      if (pathname.startsWith('/api/')) {
        return await handleApiRequest(request, env);
      }

      if (env.ASSETS) {
         return await env.ASSETS.fetch(request);
      }
      
      return new Response('Not Found', { status: 404, headers });

    } catch (error: any) {
      console.error('Fatal Error:', error);
      // Don't expose stack traces in production for security
      const errorResponse = {
        error: 'Internal Server Error',
        message: error.message || 'An unexpected error occurred',
      };
      return new Response(JSON.stringify(errorResponse), { status: 500, headers });
    }
  },
};

async function handleApiRequest(request: Request, env: CloudflareEnv): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const method = request.method;

  // CORS Headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Key',
    'Content-Type': 'application/json; charset=utf-8',
  };

  let body: any = {};
  if (method !== 'GET' && method !== 'OPTIONS') {
    try {
      body = await request.json();
    } catch {}
  }

  const auth = await parseAuthContext(request, env.JWT_SECRET);

  const apiRequest = {
    method,
    path: pathname,
    body,
    auth,
    db: env.DB,
    env: {
      ADMIN_USERNAME: env.ADMIN_USERNAME,
      ADMIN_PASSWORD: env.ADMIN_PASSWORD,
      JWT_SECRET: env.JWT_SECRET,
    },
  };

  let response;

  // 路由逻辑
  if (pathname === '/api/login') {
    response = await handleLogin(apiRequest);
  } else if (pathname === '/api/register') {
    response = await handleRegister(apiRequest);
  } else if (pathname === '/api/posts') {
    if (method === 'POST') response = await handleCreatePost(apiRequest);
    else response = await handleGetPosts(apiRequest);
  } else if (pathname.startsWith('/api/posts/')) {
    const slug = pathname.replace('/api/posts/', '');
    response = await handleGetPost(apiRequest, slug);
  } else if (pathname === '/api/comments') {
    if (method === 'POST') response = await handleCreateComment(apiRequest);
    else response = { status: 405, body: { error: 'Method Not Allowed' } };
  } else if (pathname.startsWith('/api/comments/')) {
    const parts = pathname.replace('/api/comments/', '').split('/');
    if (parts[0] === 'pending') {
      response = await handleGetPendingComments(apiRequest);
    } else {
      const id = parseInt(parts[0]);
      if (parts[1] === 'approve') response = await handleApproveComment(apiRequest, id, body.status);
      else response = await handleGetComments(apiRequest, id);
    }
  } else {
    response = { status: 404, body: { error: 'API Not Found' } };
  }

  return new Response(JSON.stringify(response.body), {
    status: response.status,
    headers,
  });
}
