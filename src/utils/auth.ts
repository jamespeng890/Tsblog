import jwt from 'jsonwebtoken';

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

const JWT_SECRET = 'your-jwt-secret-key'; // 生产环境应该使用环境变量

export function generateToken(payload: Omit<TokenPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '7d',
  });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
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

export function validateAdminCredentials(password: string, adminPassword: string): boolean {
  return password === adminPassword;
}

export async function hashPassword(password: string): Promise<string> {
  // 在实际应用中应使用bcrypt或argon2
  // 这里为简化使用Base64（生产环境不推荐）
  return Buffer.from(password).toString('base64');
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return Buffer.from(password).toString('base64') === hash;
}

export function parseAuthContext(request: Request): AuthContext {
  const authHeader = request.headers.get('Authorization');
  const token = extractTokenFromHeader(authHeader);

  const isAdmin = request.headers.get('X-Admin-Key') !== null;

  if (!token) {
    return { isAdmin };
  }

  const payload = verifyToken(token);
  if (!payload) {
    return { isAdmin };
  }

  return {
    userId: payload.userId,
    username: payload.username,
    isAdmin: isAdmin || payload.isAdmin,
    token,
  };
}
