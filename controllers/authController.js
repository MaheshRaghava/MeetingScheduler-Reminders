const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { sendVerificationEmail } = require('../services/emailService');

// Helper function for error responses
const errorResponse = (res, statusCode, message, details = null) => {
  return res.status(statusCode).json({
    success: false,
    error: message,
    ...(details && { details })
  });
};

exports.signup = async (req, res) => {
  const { name, email, password } = req.body;

  // Validation
  if (!name || !email || !password) {
    return errorResponse(res, 400, 'Please provide name, email, and password');
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return errorResponse(res, 400, 'Please provide a valid email');
  }

  if (password.length < 6) {
    return errorResponse(res, 400, 'Password must be at least 6 characters');
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Check for existing user
    const existingUser = await User.findOne({ email }).session(session);
    if (existingUser) {
      await session.abortTransaction();
      session.endSession();
      return errorResponse(res, 400, 'Email already in use');
    }

    // Hash password and create verification code
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Create user
    const [user] = await User.create([{
      name,
      email,
      password: hashedPassword,
      verificationCode,
      verificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      verified: false
    }], { session });

    // Send verification email
    try {
      await sendVerificationEmail(email, verificationCode);
      await session.commitTransaction();
      
      res.status(201).json({ 
        success: true,
        message: 'Registration successful! Please check your email.',
        email: user.email,
        needsVerification: true
      });
    } catch (emailError) {
      await session.abortTransaction();
      console.error('Email sending failed:', emailError);
      return errorResponse(res, 500, 'Registration completed but failed to send verification email. Please try logging in to resend.');
    }
  } catch (err) {
    await session.abortTransaction();
    console.error('Signup error:', err);
    errorResponse(res, 500, 'Registration failed', 
      process.env.NODE_ENV === 'development' ? err.message : undefined);
  } finally {
    session.endSession();
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return errorResponse(res, 400, 'Please provide email and password');
  }

  try {
    const user = await User.findOne({ email }).select('+password +verified');
    if (!user) {
      return errorResponse(res, 401, 'Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return errorResponse(res, 401, 'Invalid credentials');
    }

    if (!user.verified) {
      return res.status(403).json({
        success: false,
        error: 'Please verify your email first',
        needsVerification: true,
        email: user.email
      });
    }

    const token = jwt.sign(
      { id: user._id, email: user.email, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
    );

    res.json({ 
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    errorResponse(res, 500, 'Login failed',
      process.env.NODE_ENV === 'development' ? err.message : undefined);
  }
};

exports.verifyEmail = async (req, res) => {
  const { email, code } = req.body;

  if (!email || !code) {
    return errorResponse(res, 400, 'Please provide email and verification code');
  }

  try {
    const user = await User.findOne({
      email,
      verificationCode: code,
      verificationExpires: { $gt: new Date() }
    });

    if (!user) {
      return errorResponse(res, 400, 'Invalid or expired verification code');
    }

    user.verified = true;
    user.verificationCode = undefined;
    user.verificationExpires = undefined;
    await user.save();

    res.json({ 
      success: true,
      message: 'Email verified successfully! You can now login.',
      redirectTo: '/login-signup.html'
    });
  } catch (err) {
    console.error('Verification error:', err);
    errorResponse(res, 500, 'Verification failed',
      process.env.NODE_ENV === 'development' ? err.message : undefined);
  }
};

exports.resendVerification = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return errorResponse(res, 400, 'Please provide email');
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return errorResponse(res, 404, 'User not found');
    }

    if (user.verified) {
      return errorResponse(res, 400, 'Email already verified');
    }

    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    user.verificationCode = verificationCode;
    user.verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();

    const emailSent = await sendVerificationEmail(email, verificationCode);
    if (!emailSent) {
      throw new Error('Failed to send verification email');
    }

    res.json({ 
      success: true,
      message: 'New verification code sent to your email'
    });
  } catch (err) {
    console.error('Resend verification error:', err);
    errorResponse(res, 500, 'Failed to resend verification',
      process.env.NODE_ENV === 'development' ? err.message : undefined);
  }
};

exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-password -verificationCode -verificationExpires');
    
    res.json({
      success: true,
      user
    });
  } catch (err) {
    console.error('Get user error:', err);
    errorResponse(res, 500, 'Server error');
  }
};