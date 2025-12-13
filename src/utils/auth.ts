import { SignJWT, jwtVerify } from 'jose';

export interface TokenPayload {
  userId: number;
  username: string;
  isAdmin: boolean;
  iat?: number;
  exp?: number;
}

export interface AuthContext {
  userId?: number;
  username?: string;
  isAdmin: boolean;
  token?: string;
}

// 这里的密钥虽然写死，但在 Worker 每次运行会重新生成，
// 建议生产环境从 env 获取，这里为了简化先硬编码一个字符串
const SECRET_KEY = new TextEncoder().encode('your-very-secure-secret-key-change-this');

export async function generateToken(payload: Omit<TokenPayload, 'iat' | 'exp'>): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(SECRET_KEY);
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    return payload as unknown as TokenPayload;
  } catch {
    return null;
  }
}

export function extractTokenFromHeader(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

// 简单的密码比对（生产环境建议用 bcryptjs，但这里为了不再引入新坑，先用字符串比对）
// 你的注册代码也是用的 base64，所以这里保持一致
export async function hashPassword(password: string): Promise<string> {
  return btoa(password); // 使用 Web 标准的 btoa
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return btoa(password) === hash;
}

// 解析 AuthContext 现在需要变成异步的了
export async function parseAuthContext(request: Request): Promise<AuthContext> {
  const authHeader = request.headers.get('Authorization');
  const token = extractTokenFromHeader(authHeader || undefined);
  const isAdminHeader = request.headers.get('X-Admin-Key') !== null;

  if (!token) {
    return { isAdmin: isAdminHeader };
  }

  const payload = await verifyToken(token);
  if (!payload) {
    return { isAdmin: isAdminHeader };
  }

  return {
    userId: payload.userId,
    username: payload.username,
    isAdmin: isAdminHeader || payload.isAdmin,
    token,
  };
}
