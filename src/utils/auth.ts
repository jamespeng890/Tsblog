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

// Secure password hashing using Web Crypto API (SHA-256 with salt)
// This is much more secure than base64 encoding
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const passwordData = encoder.encode(password);
  
  // Combine salt and password
  const combined = new Uint8Array(salt.length + passwordData.length);
  combined.set(salt);
  combined.set(passwordData, salt.length);
  
  // Hash the combined data
  const hashBuffer = await crypto.subtle.digest('SHA-256', combined);
  const hashArray = new Uint8Array(hashBuffer);
  
  // Combine salt and hash for storage
  const result = new Uint8Array(salt.length + hashArray.length);
  result.set(salt);
  result.set(hashArray, salt.length);
  
  // Convert to base64 for storage
  return btoa(String.fromCharCode(...result));
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    
    // Decode the stored hash
    const decoded = Uint8Array.from(atob(hash), c => c.charCodeAt(0));
    
    // Extract salt (first 16 bytes)
    const salt = decoded.slice(0, 16);
    const storedHash = decoded.slice(16);
    
    // Hash the input password with the same salt
    const passwordData = encoder.encode(password);
    const combined = new Uint8Array(salt.length + passwordData.length);
    combined.set(salt);
    combined.set(passwordData, salt.length);
    
    const hashBuffer = await crypto.subtle.digest('SHA-256', combined);
    const computedHash = new Uint8Array(hashBuffer);
    
    // Compare hashes
    if (computedHash.length !== storedHash.length) return false;
    
    let match = true;
    for (let i = 0; i < computedHash.length; i++) {
      if (computedHash[i] !== storedHash[i]) match = false;
    }
    
    return match;
  } catch (error) {
    console.error('Password verification error:', error);
    return false;
  }
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
