try {
      // API路由
      if (pathname.startsWith('/api/')) {
        return await handleApiRequest(request, env); // 注意：这里加了 await
      }

      // 静态资源
      if (env.ASSETS) {
         return env.ASSETS.fetch(request);
      }
      
      return new Response('Not Found', { status: 404, headers });
    } catch (error: any) {
      // 🔴 调试关键：把真实错误打印到控制台和前端，方便我们看清真相
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
