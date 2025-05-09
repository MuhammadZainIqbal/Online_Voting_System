const jwt = require('jsonwebtoken');

/**
 * Middleware to authenticate JWT tokens
 */
const authMiddleware = {
  /**
   * Verify JWT token for protected routes
   */
  verifyToken(req, res, next) {
    // Get token from header
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ message: 'No token provided, access denied' });
    }
    
    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Add user info to request
      req.user = decoded;
      next();
    } catch (error) {
      return res.status(401).json({ message: 'Invalid token, access denied' });
    }
  },
  
  /**
   * Verify the user is an admin
   */
  verifyAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied, admin privileges required' });
    }
    next();
  },
  
  /**
   * Verify the user is a voter
   */
  verifyVoter(req, res, next) {
    if (!req.user || req.user.role !== 'voter') {
      return res.status(403).json({ message: 'Access denied, voter privileges required' });
    }
    next();
  }
};

module.exports = authMiddleware;