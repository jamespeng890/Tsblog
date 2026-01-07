import { marked } from 'marked';

export interface MarkdownMetadata {
  title: string;
  date: string;
  author?: string;
  tags?: string[];
  slug?: string;
  description?: string;
}

export interface ParsedMarkdown {
  metadata: MarkdownMetadata;
  html: string;
  plainText: string;
}

// 设置marked选项以支持更多特性
marked.setOptions({
  breaks: true,
  gfm: true, // GitHub风格Markdown
});

/**
 * 从Markdown文本中提取YAML前置内容
 */
function extractFrontmatter(content: string): { metadata: Record<string, unknown>; content: string } {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return { metadata: {}, content };
  }

  const [, frontmatterStr, markdownContent] = match;
  const metadata: Record<string, unknown> = {};

  // 简单的YAML解析
  const lines = frontmatterStr.split('\n');
  for (const line of lines) {
    const [key, ...valueParts] = line.split(':');
    if (key && valueParts.length > 0) {
      const value = valueParts.join(':').trim();

      // 处理特殊类型
      if (value === 'true') {
        metadata[key.trim()] = true;
      } else if (value === 'false') {
        metadata[key.trim()] = false;
      } else if (value.startsWith('[') && value.endsWith(']')) {
        // 处理数组
        metadata[key.trim()] = value
          .slice(1, -1)
          .split(',')
          .map((item) => item.trim().replace(/^["']|["']$/g, ''));
      } else {
        metadata[key.trim()] = value.replace(/^["']|["']$/g, '');
      }
    }
  }

  return { metadata, content: markdownContent };
}

/**
 * 将Markdown转换为HTML
 */
export async function markdownToHtml(content: string): Promise<string> {
  return marked(content);
}

/**
 * 提取纯文本（用于摘要）
 */
function extractPlainText(html: string, maxLength: number = 200): string {
  const text = html
    .replace(/<[^>]*>/g, '') // 移除HTML标签
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim();

  if (text.length > maxLength) {
    return text.substring(0, maxLength) + '...';
  }

  return text;
}

/**
 * 生成URL友好的slug
 */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s\u4e00-\u9fa5-]/g, '') // 移除特殊字符，保留中文
    .trim()
    .replace(/[\s_]+/g, '-') // 空格和下划线转换为连字符
    .replace(/-+/g, '-') // 多个连字符转换为单个
    .replace(/^-|-$/g, ''); // 移除首尾的连字符
}

/**
 * 解析完整的Markdown文档
 */
export async function parseMarkdown(content: string): Promise<ParsedMarkdown> {
  const { metadata: rawMetadata, content: markdownContent } = extractFrontmatter(content);

  // 转换HTML
  const html = await markdownToHtml(markdownContent);
  const plainText = extractPlainText(html);

  // 验证必需的元数据
  const title = (rawMetadata.title as string) || '无标题';
  const date = (rawMetadata.date as string) || new Date().toISOString();
  const slug = (rawMetadata.slug as string) || generateSlug(title);

  const metadata: MarkdownMetadata = {
    title,
    date,
    author: (rawMetadata.author as string) || undefined,
    tags: (rawMetadata.tags as string[]) || undefined,
    slug,
    description: (rawMetadata.description as string) || plainText,
  };

  return {
    metadata,
    html,
    plainText,
  };
}

/**
 * 生成HTML页面模板
 */
export function generateHtmlPage(
  title: string,
  content: string,
  styles: string = '',
): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)}</title>
    <style>
        ${DEFAULT_STYLES}
        ${styles}
    </style>
</head>
<body>
    <div class="container">
        <main class="content">
            ${content}
        </main>
    </div>
</body>
</html>`;
}

/**
 * HTML转义 - 防止XSS攻击
 */
export function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}

// 苹果风格的默认样式
const DEFAULT_STYLES = `
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    line-height: 1.6;
    color: #333;
    background: linear-gradient(135deg, #ffffff 0%, #f5f5f7 100%);
    min-height: 100vh;
  }

  .container {
    max-width: 800px;
    margin: 0 auto;
    padding: 40px 20px;
  }

  .content {
    background: white;
    border-radius: 12px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
    padding: 40px;
    animation: slideUp 0.5s ease-out;
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  h1, h2, h3, h4, h5, h6 {
    margin: 24px 0 16px 0;
    font-weight: 600;
    color: #000;
  }

  h1 {
    font-size: 32px;
    border-bottom: 2px solid #f0f0f0;
    padding-bottom: 16px;
  }

  h2 {
    font-size: 24px;
    margin-top: 32px;
  }

  h3 {
    font-size: 20px;
  }

  p {
    margin-bottom: 16px;
    color: #555;
  }

  a {
    color: #0071e3;
    text-decoration: none;
    transition: color 0.2s;
  }

  a:hover {
    color: #0051ba;
    text-decoration: underline;
  }

  code {
    background: #f5f5f7;
    padding: 2px 6px;
    border-radius: 4px;
    font-family: 'Courier New', Courier, monospace;
    font-size: 14px;
    color: #d73a49;
  }

  pre {
    background: #f5f5f7;
    border-left: 4px solid #0071e3;
    border-radius: 8px;
    padding: 16px;
    overflow-x: auto;
    margin-bottom: 16px;
  }

  pre code {
    background: none;
    padding: 0;
    color: #333;
  }

  blockquote {
    border-left: 4px solid #d0d0d0;
    margin-left: 0;
    padding-left: 16px;
    color: #666;
    font-style: italic;
  }

  ul, ol {
    margin-left: 24px;
    margin-bottom: 16px;
  }

  li {
    margin-bottom: 8px;
  }

  img {
    max-width: 100%;
    height: auto;
    border-radius: 8px;
    margin: 16px 0;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 16px;
  }

  th, td {
    border: 1px solid #e0e0e0;
    padding: 12px;
    text-align: left;
  }

  th {
    background: #f5f5f7;
    font-weight: 600;
  }

  hr {
    border: none;
    border-top: 1px solid #e0e0e0;
    margin: 32px 0;
  }
`;
