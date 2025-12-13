# 宝塔面板部署指南

## ⚠️ 重要说明

这个项目设计用于 **Cloudflare Pages** 部署（无服务器架构），而不是传统服务器部署。使用宝塔面板部署需要进行**架构调整**。

## 方案对比

| 方案 | 优点 | 缺点 | 推荐指数 |
|-----|------|------|--------|
| **Cloudflare Pages** (原设计) | 无服务器、自动扩展、全球 CDN、免费 | 需要 GitHub 账号 | ⭐⭐⭐⭐⭐ |
| **宝塔面板** (修改设计) | 完全控制、本地数据、性价比高 | 需要服务器成本、需改造代码 | ⭐⭐⭐ |

---

## 方案一：仍使用 Cloudflare Pages（推荐）

### 为什么不需要宝塔面板？
- Cloudflare Pages 自动处理所有服务器
- 代码推送到 GitHub 自动部署
- 包含免费的 SSL/HTTPS
- D1 数据库完全由 Cloudflare 管理
- **完全免费**

### 步骤
1. 代码推送到 GitHub
2. 连接 Cloudflare Pages
3. 配置环境变量
4. 自动部署完成

**详见**: `DEPLOYMENT.md`

---

## 方案二：改造为传统 Node.js + 宝塔部署

如果您必须使用宝塔面板，需要进行以下改造。

### 第 1 步：准备工作

#### 1.1 租用服务器
```
推荐配置:
- 操作系统: Ubuntu 20.04 LTS / CentOS 7.x
- CPU: 2核+
- 内存: 2GB+
- 硬盘: 50GB+ SSD
- 带宽: 1Mbps+
```

#### 1.2 安装宝塔面板

```bash
# Ubuntu/Debian
wget -O install.sh http://download.bt.cn/install/install-ubuntu_6.0.sh
sudo bash install.sh ed8484bec

# CentOS
wget -O install.sh http://download.bt.cn/install/install_6.0.sh
sudo bash install.sh ed8484bec
```

访问：`http://你的服务器IP:8888` 登录宝塔面板

### 第 2 步：环境配置

#### 2.1 通过宝塔安装运行环境

进入宝塔面板 → **软件商店**

1. **安装 Node.js**
   - 搜索 "Node.js"
   - 选择版本 18+ 或 20+
   - 点击安装

2. **安装 Nginx**
   - 搜索 "Nginx"
   - 选择版本 1.20+
   - 点击安装

3. **安装 MySQL** (可选，如果不想用 SQLite)
   - 搜索 "MySQL"
   - 选择版本 5.7 或 8.0
   - 点击安装

#### 2.2 验证安装

```bash
node --version      # v18.0.0+
npm --version       # 9.0.0+
nginx -v            # nginx/1.20.0+
```

### 第 3 步：改造项目代码

#### 3.1 修改数据库配置

由于无法直接使用 D1，有两个选择：

**选项 A：使用本地 SQLite**

修改 `src/index.ts`，使用 `better-sqlite3`:

```typescript
import Database from 'better-sqlite3';

const db = new Database('./blog.db');

// 在请求处理中使用本地数据库
export default {
  async fetch(request: Request): Promise<Response> {
    // ... 现有代码 ...
    const stmt = db.prepare('SELECT * FROM posts WHERE published = 1');
    const posts = stmt.all();
    // ...
  }
}
```

**选项 B：使用 MySQL** (推荐用于宝塔)

修改 `package.json`:

```json
{
  "dependencies": {
    "mysql2/promise": "^3.6.0"
  }
}
```

修改 `src/utils/db.ts`:

```typescript
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: 'localhost',
  user: 'blog_user',
  password: 'secure_password',
  database: 'blog_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

export async function getDbConnection() {
  return await pool.getConnection();
}
```

#### 3.2 创建 Express 应用包装器

创建 `src/server.ts`:

```typescript
import express from 'express';
import { Router } from 'express';
import * as handlers from './api/handlers.js';

const app = express();
app.use(express.json());

// 允许所有 CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

// 静态文件
app.use(express.static('public'));

// API 路由
const router = Router();

router.post('/api/login', async (req, res) => {
  try {
    const result = await handlers.handleLogin({
      method: 'POST',
      path: '/api/login',
      body: req.body,
      auth: parseAuth(req),
      db: req.db,
      env: process.env
    });
    res.status(result.status).json(result.body);
  } catch (error) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// ... 其他路由 ...

app.use('/', router);

// 错误处理
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: '服务器错误' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});

function parseAuth(req) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace('Bearer ', '');
  return {
    isAdmin: req.headers['x-admin-key'] !== undefined,
    token
  };
}
```

#### 3.3 更新 package.json

```json
{
  "name": "blog-platform",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/server.js",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "pm2:start": "pm2 start dist/server.js --name blog",
    "pm2:stop": "pm2 stop blog",
    "pm2:restart": "pm2 restart blog"
  },
  "dependencies": {
    "express": "^4.18.2",
    "mysql2": "^3.6.0",
    "marked": "^11.1.1",
    "jsonwebtoken": "^9.1.2",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "typescript": "^5.3.3",
    "@types/express": "^4.17.21",
    "@types/node": "^20.10.5",
    "tsx": "^4.7.0"
  }
}
```

### 第 4 步：在宝塔中创建网站

#### 4.1 创建 Node.js 项目

进入宝塔面板 → **网站**

1. 点击 **添加网站**
2. 选择 **Node.js**
3. 填写信息：
   ```
   域名: yourblog.com
   项目路径: /www/wwwroot/blog
   端口: 3000
   启动文件: dist/server.js
   ```
4. 点击 **提交**

#### 4.2 上传代码

**方式 1：通过 Git**

```bash
# 在宝塔终端
cd /www/wwwroot/blog
git clone https://github.com/yourusername/blog-platform.git .
```

**方式 2：通过宝塔文件管理器**

1. 将本地项目压缩
2. 上传到 `/www/wwwroot/blog`
3. 解压

#### 4.3 安装依赖

进入宝塔终端：

```bash
cd /www/wwwroot/blog
npm install
npm run build
```

### 第 5 步：配置环境变量

#### 5.1 创建 .env 文件

```bash
# 在宝塔文件管理器中创建 .env
cat > /www/wwwroot/blog/.env << EOF
# 管理员配置
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_password

# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_USER=blog_user
DB_PASSWORD=secure_password
DB_NAME=blog_db

# JWT 密钥
JWT_SECRET=your_jwt_secret_here

# 端口
PORT=3000

# 环境
NODE_ENV=production
EOF
```

#### 5.2 创建数据库用户 (宝塔)

1. 进入宝塔 → **数据库**
2. 点击 **添加数据库**
3. 填写：
   ```
   数据库名: blog_db
   用户名: blog_user
   密码: secure_password
   ```

#### 5.3 导入 Schema

在宝塔数据库管理中：

1. 选择 `blog_db`
2. 点击 **SQL 命令**
3. 将 `schema.sql` 的内容粘贴
4. 执行

### 第 6 步：配置 Nginx 反向代理

进入宝塔 → **网站** → 选择网站 → **配置文件**

添加以下配置：

```nginx
upstream blog {
    server 127.0.0.1:3000;
    keepalive 64;
}

server {
    listen 80;
    server_name yourblog.com www.yourblog.com;

    # 重定向 HTTP 到 HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourblog.com www.yourblog.com;

    # SSL 证书（宝塔会自动配置）
    ssl_certificate /www/server/panel/vhost/cert/yourblog.com/yourblog.com.crt;
    ssl_certificate_key /www/server/panel/vhost/cert/yourblog.com/yourblog.com.key;

    # 日志
    access_log /www/wwwlogs/yourblog.com.log;
    error_log /www/wwwlogs/yourblog.com.error.log;

    # 静态文件缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        proxy_pass http://blog;
        proxy_cache_valid 200 30d;
        expires 30d;
    }

    # API 路由
    location /api/ {
        proxy_pass http://blog;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 其他路由
    location / {
        proxy_pass http://blog;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
    }
}
```

### 第 7 步：启动应用

#### 7.1 使用宝塔面板启动

进入宝塔 → **网站** → 选择网站 → **启动/重启**

#### 7.2 使用 PM2（推荐）

进入宝塔终端：

```bash
# 安装 PM2
npm install -g pm2

# 启动应用
cd /www/wwwroot/blog
pm2 start dist/server.js --name "blog" --watch

# 保存配置
pm2 save

# 设置开机自启
pm2 startup
```

查看状态：
```bash
pm2 status
pm2 logs blog
```

### 第 8 步：配置 SSL 证书

#### 8.1 通过宝塔申请免费证书

1. 进入宝塔 → **网站** → 选择网站 → **SSL**
2. 选择 **Let's Encrypt**
3. 点击 **申请**
4. 自动续期

#### 8.2 强制 HTTPS

编辑网站配置文件，添加重定向：

```nginx
server {
    listen 80;
    return 301 https://$server_name$request_uri;
}
```

### 第 9 步：性能优化

#### 9.1 启用 Gzip 压缩

在 Nginx 配置中添加：

```nginx
gzip on;
gzip_vary on;
gzip_min_length 1000;
gzip_comp_level 6;
gzip_types text/plain text/css text/xml text/javascript 
            application/json application/javascript application/xml+rss;
```

#### 9.2 启用缓存

```nginx
location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
    expires 365d;
    add_header Cache-Control "public, immutable";
}
```

#### 9.3 数据库优化

在宝塔数据库中：

```sql
-- 创建索引
CREATE INDEX idx_posts_published ON posts(published);
CREATE INDEX idx_posts_created ON posts(created_at DESC);
CREATE INDEX idx_comments_post ON comments(post_id);
CREATE INDEX idx_users_username ON users(username);

-- 查询优化分析
ANALYZE TABLE posts;
ANALYZE TABLE comments;
ANALYZE TABLE users;
```

### 第 10 步：监控和维护

#### 10.1 宝塔面板监控

- **监控**: 实时查看 CPU、内存、磁盘使用
- **日志**: 查看 Nginx 和应用日志
- **防火墙**: 配置宝塔防火墙规则

#### 10.2 PM2 监控

```bash
# 实时监控
pm2 monit

# 查看详细信息
pm2 show blog

# 导出监控数据
pm2 web
```

访问 `http://localhost:8888/pm2`

#### 10.3 备份

进入宝塔 → **文件** → 设置定时备份

备份内容：
- `/www/wwwroot/blog` (网站文件)
- 数据库 `blog_db`

---

## 常见问题解决

### 1. 应用无法启动

**检查步骤**：
```bash
# 进入项目目录
cd /www/wwwroot/blog

# 检查依赖
npm list

# 检查构建输出
ls -la dist/

# 手动运行应用
node dist/server.js

# 查看 PM2 日志
pm2 logs blog --tail 100
```

### 2. 数据库连接错误

```bash
# 检查 MySQL 是否运行
mysql -u root -p

# 测试连接
mysql -h localhost -u blog_user -p blog_db

# 检查 .env 配置
cat /www/wwwroot/blog/.env
```

### 3. 端口被占用

```bash
# 检查 3000 端口
lsof -i :3000

# 杀死进程
kill -9 <PID>

# 更改端口在 .env 中
PORT=3001
```

### 4. Nginx 配置错误

```bash
# 检查语法
nginx -t

# 重启 Nginx
systemctl restart nginx

# 查看错误日志
tail -f /var/log/nginx/error.log
```

### 5. 权限问题

```bash
# 设置正确的权限
chown -R www:www /www/wwwroot/blog
chmod -R 755 /www/wwwroot/blog

# 确保 node_modules 可读
chmod -R 755 /www/wwwroot/blog/node_modules
```

---

## 对比：Cloudflare Pages vs 宝塔部署

| 特性 | Cloudflare Pages | 宝塔部署 |
|------|------------------|---------|
| 成本 | 免费 | 服务器成本 |
| 部署难度 | 非常简单 | 中等 |
| 性能 | 全球 CDN | 取决于服务器 |
| 可靠性 | 99.99% | 需自己维护 |
| 自动扩展 | ✅ | ❌ |
| 数据库选择 | 仅 D1 | MySQL/SQLite/等 |
| 维护成本 | 无 | 需要运维 |

---

## 推荐方案

1. **如果您有域名且经常使用**: **Cloudflare Pages** ✅ (强烈推荐)
2. **如果您想完全控制**: **宝塔 + MySQL** ✅
3. **如果您有 VPS 但没有宝塔**: **Docker + 手动部署** ✅

---

**选择适合您的部署方案，享受博客系统！** 🚀

更多帮助请参考: `DEPLOYMENT.md` 和 `QUICK_START.md`
