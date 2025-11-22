// Quick script to verify admin routes are exported correctly
import adminRoutes from '../routes/adminRoutes.js';

console.log('Admin routes module:', adminRoutes);
console.log('Routes loaded:', typeof adminRoutes);
console.log('Has router methods:', typeof adminRoutes.get === 'function');

// Try to access a route handler
try {
  const routes = adminRoutes.stack || adminRoutes._router?.stack || [];
  console.log('Number of routes registered:', routes.length);
  routes.forEach((route, i) => {
    if (route.route) {
      console.log(`Route ${i + 1}: ${Object.keys(route.route.methods).join(', ').toUpperCase()} ${route.route.path}`);
    }
  });
} catch (err) {
  console.error('Error inspecting routes:', err.message);
}

