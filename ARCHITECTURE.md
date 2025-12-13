# 项目架构总结

## 系统概览

```
┌─────────────────────────────────────────────────────────────┐
│                    User Browser (前端)                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────┐  ┌──────────────────┐                 │
│  │  index.html      │  │  blog-login.html │  blog-admin.html│
│  │  (Blog Pages)    │  │  (Auth)          │  (Admin Panel)  │
│  └──────────────────┘  └──────────────────┘                 │
│         │                      │                 │           │
└─────────────────────────────────────────────────────────────┘
         │                      │                 │
         └──────────────────────┼─────────────────┘
                                │
                    HTTPS REST API Calls
                                │
         ┌──────────────────────────────────────┐
         │  API Routing & HTTP Handler          │
         │  (src/index.ts)                      │
         └──────────────────────────────────────┘
                        │
         ┌──────────────────────────────────────┐
         │  Cloudflare Pages Edge Server        │
         │  (TypeScript/JavaScript Worker)      │
         └──────────────────────────────────────┘
                        │
         ┌──────────────────────────────────────┐
         │  Request Processing Layer            │
         │  ├── Authentication (auth.ts)        │
         │  ├── API Handlers (handlers.ts)      │
         │  ├── Markdown Processing (markdown) │
         │  └── Database Operations             │
         └──────────────────────────────────────┘
                        │
         ┌──────────────────────────────────────┐
         │  Cloudflare D1 Database              │
         │  (SQLite)                            │
         │  ├── Users Table                     │
         │  ├── Posts Table                     │
         │  └── Comments Table                  │
         └──────────────────────────────────────┘
```

## 数据流图

### 1. 用户注册流程

```
用户填写表单
    ↓
前端验证
    ↓
POST /api/register
    ↓
后端验证 (username/email 唯一性)
    ↓
密码加密 (Base64 - 生产环境应使用 bcrypt)
    ↓
插入 users 表
    ↓
返回用户信息 (status: 201)
    ↓
前端重定向到登录
```

### 2. 用户登录流程

```
用户输入凭证
    ↓
POST /api/login (isAdmin: false)
    ↓
从 users 表查询用户
    ↓
验证密码
    ↓
生成 JWT Token
    ↓
返回 token + 用户信息
    ↓
前端保存到 localStorage
    ↓
重定向到首页
```

### 3. 管理员登录流程

```
用户勾选管理员选项
    ↓
POST /api/login (isAdmin: true)
    ↓
验证用户名 == ADMIN_USERNAME (从环境变量)
    ↓
验证密码 == ADMIN_PASSWORD (从环境变量)
    ↓
生成 admin JWT Token
    ↓
返回 token (isAdmin: true)
    ↓
重定向到 /blog-admin.html
```

### 4. 发布文章流程

```
管理员在编辑器中输入 Markdown
    ↓
提交表单到 POST /api/posts
    ↓
解析 Markdown (提取 frontmatter 元数据)
    ↓
转换 Markdown → HTML (marked 库)
    ↓
生成 URL-friendly slug
    ↓
保存到 posts 表
    ↓
返回文章 ID
    ↓
刷新文章列表
```

### 5. 文章浏览流程

```
前端 GET /api/posts
    ↓
数据库查询发布的文章
    ↓
返回文章摘要列表
    ↓
前端渲染文章卡片
    ↓
用户点击文章卡片
    ↓
GET /api/posts/:slug
    ↓
查询文章详情
    ↓
views 计数器 +1
    ↓
返回完整 HTML 内容
    ↓
前端渲染文章页面
```

### 6. 评论流程

```
用户填写评论信息
    ↓
POST /api/comments
    ↓
保存到 comments 表 (status: 'pending')
    ↓
返回成功消息
    ↓
前端显示"等待审核"提示
    ↓
├─→ 管理员进入评论管理
    │   ↓
    │   查看待审核评论列表
    │   ↓
    │   PATCH /api/comments/:id/approve (status: 'approved'|'rejected')
    │   ↓
    │   更新数据库
    │
└─→ 已批准的评论显示在文章页面
```

## API 端点详解

### 认证端点

#### POST /api/login
```
请求:
{
  "username": "user",
  "password": "password",
  "isAdmin": false
}

响应 (成功):
{
  "success": true,
  "token": "eyJhbGc...",
  "user": {
    "id": 1,
    "username": "user",
    "isAdmin": false
  }
}

响应 (失败):
{
  "error": "用户不存在" | "密码错误"
}
```

#### POST /api/register
```
请求:
{
  "username": "newuser",
  "email": "user@example.com",
  "password": "password123"
}

响应 (成功):
{
  "success": true,
  "user": {
    "id": 1,
    "username": "newuser",
    "email": "user@example.com"
  }
}

响应 (失败):
{
  "error": "用户名或邮箱已存在"
}
```

### 文章端点

#### GET /api/posts
获取所有发布的文章列表

#### GET /api/posts/:slug
获取单篇文章详情并增加浏览次数

#### POST /api/posts
创建新文章 (需要认证)

### 评论端点

#### GET /api/comments/:postId
获取已批准的评论列表

#### POST /api/comments
提交新评论 (需要 postId)

#### GET /api/comments/pending
获取待审核评论 (仅限管理员)

#### PATCH /api/comments/:id/approve
审核评论 (仅限管理员)

## 数据库架构

### users 表
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### posts 表
```sql
CREATE TABLE posts (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  content TEXT NOT NULL,                 -- HTML 内容
  markdown_content TEXT NOT NULL,        -- 原始 Markdown
  author_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  published BOOLEAN DEFAULT 0,           -- 0=草稿, 1=已发布
  views INTEGER DEFAULT 0,
  FOREIGN KEY (author_id) REFERENCES users(id)
);
```

### comments 表
```sql
CREATE TABLE comments (
  id INTEGER PRIMARY KEY,
  post_id INTEGER NOT NULL,
  user_id INTEGER,                       -- 可选 (已登录用户)
  author_name TEXT NOT NULL,
  author_email TEXT,
  content TEXT NOT NULL,
  status TEXT DEFAULT 'pending',         -- pending, approved, rejected
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES posts(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

## 认证流程

### JWT Token 结构
```
Header: {
  "alg": "HS256",
  "typ": "JWT"
}

Payload: {
  "userId": 1,
  "username": "user",
  "isAdmin": false,
  "iat": 1704067200,
  "exp": 1704672000
}

Signature: HMAC-SHA256(header + payload + secret)
```

### 管理员认证
- 环境变量存储: `ADMIN_USERNAME`, `ADMIN_PASSWORD`
- 无需数据库查询
- 登录时直接对比凭证
- 返回 isAdmin=true 的 token

### 普通用户认证
- 数据库存储: users 表
- 密码使用 Base64 编码 (生产环境应用 bcrypt)
- 登录时查询数据库
- 返回 isAdmin=false 的 token

## 前端架构

### 页面结构

```
index.html
├── 头部导航
├── 主内容区
│   ├── 首页视图
│   │   ├── Hero Section
│   │   └── 文章网格
│   └── 文章详情视图
│       ├── 文章标题
│       ├── 文章元数据
│       ├── 文章内容 (Markdown 转 HTML)
│       └── 评论区
└── 页脚

blog-login.html
├── 登录模式
│   ├── 用户名/密码输入
│   ├── 管理员模式切换
│   └── 注册链接
└── 注册模式
    ├── 用户名/邮箱/密码输入
    └── 登录链接

blog-admin.html
├── 侧边栏导航
├── 主内容区
│   ├── 仪表盘视图
│   │   ├── 统计卡片
│   │   └── 快速操作
│   ├── 评论管理视图
│   │   └── 待审核评论表格
│   ├── 文章管理视图
│   │   ├── 发布新文章表单
│   │   └── 文章列表
│   ├── 用户管理视图
│   │   └── 用户列表
│   └── 系统设置视图
│       └── 基本设置表单
└── 用户信息栏
```

## 样式系统

### Apple 设计风格元素
- **字体**: -apple-system, BlinkMacSystemFont ("San Francisco")
- **颜色**: 简洁的配色 + 紫色渐变主色
- **圆角**: 12px 统一圆角 (温和而不尖锐)
- **间距**: 充分的内外边距 (8px, 16px, 24px, 32px, 40px)
- **阴影**: 细微且分层的阴影 (depth)
- **动画**: 流畅的过渡效果 (0.3s cubic-easing)
- **响应式**: 移动优先设计

### 色彩系统
```
主色: #667eea - #764ba2 (紫色渐变)
背景: #f5f5f7 - #ffffff (浅灰到白色)
文本: #333 (深灰) - #999 (中灰) - #ccc (浅灰)
边框: #e0e0e0 (轻边框)
```

## 部署架构

```
GitHub Repo
    ↓ (webhook)
Cloudflare Pages
    ↓
1. 检出代码
2. npm install
3. npm run build
4. TypeScript 编译
5. 生成 dist/index.js
6. 部署到全球 CDN
    ↓
User Request (任何地区)
    ↓
最近的边界服务器
    ↓
执行 Worker 代码
    ↓
查询 D1 数据库
    ↓
返回响应
```

## 性能考虑

### 缓存策略
- 静态 HTML/CSS/JS: 浏览器缓存
- API 响应: 不缓存 (实时数据)
- 数据库查询: 优化索引

### 优化建议
1. **CDN**: 利用 Cloudflare 全球 CDN
2. **数据库**: 使用索引加速查询
3. **压缩**: gzip 压缩 API 响应
4. **渐进加载**: 文章列表分页
5. **图片**: 使用 Cloudflare Image Optimization

## 安全考虑

### 已实现
- JWT 认证和授权
- SQL 参数化查询 (D1 自动)
- CORS 配置
- 环境变量保护敏感信息

### 建议增强
- 升级密码加密 (bcrypt/argon2)
- 添加速率限制
- 实施 CSRF 保护
- 验证和净化用户输入
- 添加审计日志

---

**完整的架构设计让系统具有高度的可扩展性和可维护性！** 🏗️
