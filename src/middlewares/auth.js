import { verifyToken } from '../utils/tokens.js';

export function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    const payload = verifyToken(token, process.env.JWT_ACCESS_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(403).json({ message: 'Forbidden: No user in request' });
    }
    
    // Support role aliases for backward compatibility
    const userRole = req.user.role;
    const roleAliases = {
      'firm': 'serviceProvider',
      'company': 'serviceProvider',
    };
    const normalizedRole = roleAliases[userRole] || userRole;
    
    if (!roles.includes(normalizedRole) && !roles.includes(userRole)) {
      console.log(`Role check failed: user role="${userRole}" (normalized="${normalizedRole}"), allowed roles:`, roles);
      return res.status(403).json({ 
        message: 'Forbidden: Insufficient permissions',
        userRole: userRole,
        allowedRoles: roles
      });
    }
    next();
  };
}


