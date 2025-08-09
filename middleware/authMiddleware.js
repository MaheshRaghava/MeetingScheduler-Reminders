const jwt = require('jsonwebtoken');
const User = require('../models/User');

async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      error: 'Access denied: No token provided' 
    });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Find user and check verification status
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ 
        error: 'Invalid token: User not found' 
      });
    }

    // Check if email is verified
    if (!user.verified) {
      return res.status(403).json({
        error: 'Email not verified',
        needsVerification: true,
        email: user.email
      });
    }

    // Attach user to request
    req.user = {
      id: user._id,
      email: user.email,
      name: user.name
    };

    next();
  } catch (err) {
    res.status(403).json({ 
      error: 'Invalid token',
      details: err.message 
    });
  }
}

module.exports = authenticateToken;