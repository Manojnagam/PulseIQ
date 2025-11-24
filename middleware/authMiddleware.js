const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const User = require('../models/User');

const protect = asyncHandler(async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];

      // DEV TOKEN BYPASS
      if (token === 'dev-token') {
        // Find the dev user (seeded with mobile 9999999999)
        // We need to find based on the role requested? 
        // Actually devLogin in frontend sets role in localStorage but here we just need A user.
        // The seed script created a coach with 9999999999.
        // Let's just use that for now.
        req.user = await User.findOne({ mobile: '9999999999' }).select('-password');
        if (!req.user) {
             res.status(401);
             throw new Error('Dev user not found. Run seed_dev.js');
        }
        next();
        return;
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        res.status(401);
        throw new Error('Not authorized, user not found');
      }

      next();
    } catch (error) {
      console.error(error);
      res.status(401);
      throw new Error('Not authorized, token failed');
    }
  }

  if (!token) {
    res.status(401);
    throw new Error('Not authorized, no token');
  }
});

module.exports = { protect };
