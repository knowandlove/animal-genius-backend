// WebSocket Setup from server/index.ts
      log('Cleaning up game session manager...');
      gameSessionManager.cleanup();
    }
  });

  // WebSocket server cleanup
  cleanupManager.register({
    name: 'websocket-server',
    priority: 30,
    handler: () => {
      const wsServer = (app as any).gameWebSocketServer;
      if (wsServer && typeof wsServer.cleanup === 'function') {
        log('Cleaning up WebSocket server...');
        wsServer.cleanup();
      }
    }
  });

  // Metrics service cleanup
  cleanupManager.register({
    name: 'metrics-service',
    priority: 40,
    handler: () => {
      log('Cleaning up metrics service...');
      metricsService.cleanup();
    }
  });

  // HTTP server cleanup
  cleanupManager.register({
    name: 'http-server',
    priority: 90, // Close near the end
    handler: () => new Promise<void>((resolve, reject) => {
--
    // No need to serve static files from backend

    // Use PORT from environment or default to 5001
    const port = process.env.PORT || 5001;
    
    // Handle WebSocket upgrade - let Vite handle its own WebSocket connections
    server.on('upgrade', (request, socket, head) => {
      log(`WebSocket upgrade request from ${request.url}`);
      
      // Let Vite handle its own WebSocket connections for HMR
      if (request.url?.includes('vite') || request.url?.includes('@vite') || request.headers['sec-websocket-protocol']?.includes('vite-hmr')) {
        // Don't interfere with Vite's WebSocket handling
        return;
      }
      
      // All other WebSocket connections are handled by the GameWebSocketServer
      // which is already attached to the server in routes.ts
    });
    
    server.listen(port, "0.0.0.0", () => {
      log(`serving on port ${port}`);
      log(`WebSocket server also listening on port ${port}`);
      
      // Start authentication performance monitoring
      startPerformanceLogging();
      log('Authentication performance monitoring started');
      
      // Register cleanup handlers
      registerCleanupHandlers(server, app);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    
    // If it's a database connection error, provide more specific guidance
    if (error && typeof error === 'object' && 'code' in error) {
      console.error("Database error code:", error.code);
      console.error("This appears to be a database connection issue. Please check:");
      console.error("1. DATABASE_URL environment variable is set correctly");
      console.error("2. Database is accessible and running");
      console.error("3. Network connectivity to the database");
    }
    
