const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'smart-panchayat-secret';

function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'No token provided' });
    }
  
    const token = authHeader.split(' ')[1];
  
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
  
      req.user = {
        id: decoded.id,
        role: decoded.role,
        districtId: decoded.districtId,
        blockId: decoded.blockId,
        panchayatId: decoded.panchayatId
      };
  
      next();
    } catch (err) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  }
  

function requirePanchayatAdmin(req, res, next) {
    if (req.user.role !== 'panchayat_admin') {
      return res.status(403).json({
        success: false,
        error: 'Write access denied'
      });
    }
    next();
  }
  
  module.exports = {
    JWT_SECRET,
    authMiddleware,
    requirePanchayatAdmin
  };
