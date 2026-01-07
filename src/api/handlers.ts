import { parseMarkdown, escapeHtml } from '../utils/markdown.js';
import { AuthContext, generateToken, hashPassword, verifyPassword } from '../utils/auth.js';

export interface ApiRequest {
  method: string;
  path: string;
  body?: Record<string, unknown>;
  auth: AuthContext;
  db: any; // Cloudflare D1 Database
  env: Record<string, string>;
}

export interface ApiResponse {
  status: number;
  body: Record<string, unknown> | string;
  headers?: Record<string, string>;
}

/**
 * 输入验证和清理辅助函数
 */
function sanitizeString(input: string | undefined, maxLength: number = 255): string {
  if (!input || typeof input !== 'string') return '';
  return escapeHtml(input.trim().slice(0, maxLength));
}

function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function validateUsername(username: string): boolean {
  // Username should be 3-50 characters, alphanumeric with underscores and hyphens
  const usernameRegex = /^[a-zA-Z0-9_-]{3,50}$/;
  return usernameRegex.test(username);
}

/**
 * 登录API
 */
export async function handleLogin(request: ApiRequest): Promise<ApiResponse> {
  if (request.method !== 'POST') {
    return { status: 405, body: { error: '方法不允许' } };
  }

  const { username, password, isAdmin } = request.body as any;

  if (!username || !password) {
    return { status: 400, body: { error: '用户名和密码不能为空' } };
  }

  // 管理员登录 - 使用环境变量
  if (isAdmin) {
    const adminPassword = request.env['ADMIN_PASSWORD'];
    const adminUsername = request.env['ADMIN_USERNAME'] || 'admin';

    if (username !== adminUsername || password !== adminPassword) {
      return { status: 401, body: { error: '管理员凭证无效' } };
    }

    const token = generateToken({
      userId: 0,
      username: adminUsername,
      isAdmin: true,
    });

    return {
      status: 200,
      body: {
        success: true,
        token,
        user: {
          username: adminUsername,
          isAdmin: true,
        },
      },
    };
  }

  // 普通用户登录 - 使用数据库
  try {
    const user = await request.db
      .prepare('SELECT id, username, password_hash FROM users WHERE username = ?')
      .bind(username)
      .first();

    if (!user) {
      return { status: 401, body: { error: '用户不存在' } };
    }

    const passwordValid = await verifyPassword(password, user.password_hash);
    if (!passwordValid) {
      return { status: 401, body: { error: '密码错误' } };
    }

    const token = generateToken({
      userId: user.id,
      username: user.username,
      isAdmin: false,
    });

    return {
      status: 200,
      body: {
        success: true,
        token,
        user: {
          id: user.id,
          username: user.username,
          isAdmin: false,
        },
      },
    };
  } catch (error) {
    console.error('登录错误:', error);
    return { status: 500, body: { error: '服务器错误' } };
  }
}

/**
 * 用户注册API
 */
export async function handleRegister(request: ApiRequest): Promise<ApiResponse> {
  if (request.method !== 'POST') {
    return { status: 405, body: { error: '方法不允许' } };
  }

  const { username, email, password } = request.body as any;

  if (!username || !email || !password) {
    return { status: 400, body: { error: '用户名、邮箱和密码不能为空' } };
  }

  // Validate username format
  if (!validateUsername(username)) {
    return { status: 400, body: { error: '用户名格式无效，只能包含字母、数字、下划线和连字符，长度3-50字符' } };
  }

  // Validate email format
  if (!validateEmail(email)) {
    return { status: 400, body: { error: '邮箱格式无效' } };
  }

  if (password.length < 6) {
    return { status: 400, body: { error: '密码至少需要6个字符' } };
  }

  if (password.length > 128) {
    return { status: 400, body: { error: '密码不能超过128个字符' } };
  }

  try {
    const passwordHash = await hashPassword(password);

    const result = await request.db
      .prepare('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)')
      .bind(username.trim(), email.trim().toLowerCase(), passwordHash)
      .run();

    return {
      status: 201,
      body: {
        success: true,
        user: {
          id: result.meta.last_row_id,
          username,
          email,
        },
      },
    };
  } catch (error: any) {
    if (error.message?.includes('UNIQUE')) {
      return { status: 409, body: { error: '用户名或邮箱已存在' } };
    }
    console.error('注册错误:', error);
    return { status: 500, body: { error: '服务器错误' } };
  }
}

/**
 * 创建博客文章API
 */
export async function handleCreatePost(request: ApiRequest): Promise<ApiResponse> {
  if (!request.auth.isAdmin && !request.auth.userId) {
    return { status: 401, body: { error: '需要认证' } };
  }

  if (request.method !== 'POST') {
    return { status: 405, body: { error: '方法不允许' } };
  }

  const { title, markdownContent, published } = request.body as any;

  if (!title || !markdownContent) {
    return { status: 400, body: { error: '标题和内容不能为空' } };
  }

  // Validate title length
  const sanitizedTitle = sanitizeString(title, 200);
  if (sanitizedTitle.length < 1) {
    return { status: 400, body: { error: '标题不能为空' } };
  }

  // Validate content length (max 100KB)
  if (typeof markdownContent !== 'string' || markdownContent.length > 100000) {
    return { status: 400, body: { error: '内容过长或格式无效' } };
  }

  try {
    const parsed = await parseMarkdown(markdownContent);
    const slug = parsed.metadata.slug;

    const result = await request.db
      .prepare(
        `INSERT INTO posts (title, slug, markdown_content, content, author_id, published)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(sanitizedTitle, slug, markdownContent, parsed.html, request.auth.userId || 0, published ? 1 : 0)
      .run();

    return {
      status: 201,
      body: {
        success: true,
        post: {
          id: result.meta.last_row_id,
          title,
          slug,
          published,
        },
      },
    };
  } catch (error) {
    console.error('创建文章错误:', error);
    return { status: 500, body: { error: '服务器错误' } };
  }
}

/**
 * 获取所有文章API
 */
export async function handleGetPosts(request: ApiRequest): Promise<ApiResponse> {
  try {
    const posts = await request.db
      .prepare('SELECT id, title, slug, created_at, views FROM posts WHERE published = 1 ORDER BY created_at DESC')
      .all();

    return {
      status: 200,
      body: {
        success: true,
        posts: posts.results,
      },
    };
  } catch (error) {
    console.error('获取文章错误:', error);
    return { status: 500, body: { error: '服务器错误' } };
  }
}

/**
 * 获取单篇文章API
 */
export async function handleGetPost(request: ApiRequest, slug: string): Promise<ApiResponse> {
  try {
    const post = await request.db
      .prepare('SELECT * FROM posts WHERE slug = ? AND published = 1')
      .bind(slug)
      .first();

    if (!post) {
      return { status: 404, body: { error: '文章不存在' } };
    }

    // 增加浏览次数
    await request.db
      .prepare('UPDATE posts SET views = views + 1 WHERE id = ?')
      .bind(post.id)
      .run();

    return {
      status: 200,
      body: {
        success: true,
        post,
      },
    };
  } catch (error) {
    console.error('获取文章错误:', error);
    return { status: 500, body: { error: '服务器错误' } };
  }
}

/**
 * 提交评论API
 */
export async function handleCreateComment(request: ApiRequest): Promise<ApiResponse> {
  if (request.method !== 'POST') {
    return { status: 405, body: { error: '方法不允许' } };
  }

  const { postId, authorName, authorEmail, content } = request.body as any;

  if (!postId || !authorName || !content) {
    return { status: 400, body: { error: '缺少必要字段' } };
  }

  // Validate and sanitize inputs
  const sanitizedAuthorName = sanitizeString(authorName, 100);
  const sanitizedContent = sanitizeString(content, 2000);

  if (sanitizedAuthorName.length < 2) {
    return { status: 400, body: { error: '作者名称至少需要2个字符' } };
  }

  if (sanitizedContent.length < 1) {
    return { status: 400, body: { error: '评论内容不能为空' } };
  }

  // Validate email if provided
  if (authorEmail && !validateEmail(authorEmail)) {
    return { status: 400, body: { error: '邮箱格式无效' } };
  }

  const sanitizedEmail = authorEmail ? authorEmail.trim().toLowerCase() : null;

  try {
    const result = await request.db
      .prepare(
        `INSERT INTO comments (post_id, user_id, author_name, author_email, content, status)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(postId, request.auth.userId || null, sanitizedAuthorName, sanitizedEmail, sanitizedContent, 'pending')
      .run();

    return {
      status: 201,
      body: {
        success: true,
        comment: {
          id: result.meta.last_row_id,
          status: 'pending',
        },
      },
    };
  } catch (error) {
    console.error('创建评论错误:', error);
    return { status: 500, body: { error: '服务器错误' } };
  }
}

/**
 * 获取文章评论API（仅获取已批准的）
 */
export async function handleGetComments(request: ApiRequest, postId: number): Promise<ApiResponse> {
  try {
    const comments = await request.db
      .prepare(
        `SELECT id, author_name, content, created_at FROM comments 
         WHERE post_id = ? AND status = 'approved' 
         ORDER BY created_at DESC`,
      )
      .bind(postId)
      .all();

    return {
      status: 200,
      body: {
        success: true,
        comments: comments.results,
      },
    };
  } catch (error) {
    console.error('获取评论错误:', error);
    return { status: 500, body: { error: '服务器错误' } };
  }
}

/**
 * 获取待审核评论API（仅限管理员）
 */
export async function handleGetPendingComments(request: ApiRequest): Promise<ApiResponse> {
  if (!request.auth.isAdmin) {
    return { status: 403, body: { error: '权限不足' } };
  }

  try {
    const comments = await request.db
      .prepare(
        `SELECT id, post_id, author_name, content, created_at FROM comments 
         WHERE status = 'pending' 
         ORDER BY created_at ASC`,
      )
      .all();

    return {
      status: 200,
      body: {
        success: true,
        comments: comments.results,
      },
    };
  } catch (error) {
    console.error('获取待审核评论错误:', error);
    return { status: 500, body: { error: '服务器错误' } };
  }
}

/**
 * 审核评论API（仅限管理员）
 */
export async function handleApproveComment(
  request: ApiRequest,
  commentId: number,
  status: 'approved' | 'rejected',
): Promise<ApiResponse> {
  if (!request.auth.isAdmin) {
    return { status: 403, body: { error: '权限不足' } };
  }

  if (request.method !== 'PATCH') {
    return { status: 405, body: { error: '方法不允许' } };
  }

  try {
    await request.db
      .prepare('UPDATE comments SET status = ? WHERE id = ?')
      .bind(status, commentId)
      .run();

    return {
      status: 200,
      body: {
        success: true,
        message: `评论已${status === 'approved' ? '批准' : '拒绝'}`,
      },
    };
  } catch (error) {
    console.error('审核评论错误:', error);
    return { status: 500, body: { error: '服务器错误' } };
  }
}
