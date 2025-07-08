// Simple script to list all registered routes
const express = require('express');
const app = express();

// Import the routes registration
import('../server/routes.js').then(({ registerRoutes }) => {
  registerRoutes(app).then(() => {
    console.log('\nRegistered Routes:');
    console.log('==================');
    
    function print(path, layer) {
      if (layer.route) {
        layer.route.stack.forEach(function (route) {
          if (route.method) {
            console.log(`${route.method.toUpperCase().padEnd(8)} ${path}`);
          }
        });
      } else if (layer.name === 'router' && layer.handle.stack) {
        layer.handle.stack.forEach(function (handler) {
          if (handler.route) {
            const fullPath = path + handler.route.path;
            handler.route.stack.forEach(function (route) {
              if (route.method) {
                console.log(`${route.method.toUpperCase().padEnd(8)} ${fullPath}`);
              }
            });
          }
        });
      }
    }

    app._router.stack.forEach(function (middleware) {
      if (middleware.route) {
        print(middleware.route.path, middleware);
      } else if (middleware.name === 'router') {
        console.log(`\n--- Router at ${middleware.regexp} ---`);
        middleware.handle.stack.forEach(function (handler) {
          if (handler.route) {
            print(handler.route.path, handler);
          }
        });
      }
    });
    
    process.exit(0);
  });
});