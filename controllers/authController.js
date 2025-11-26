const asyncHandler = require('express-async-handler');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Customer = require('../models/Customer');
const Coach = require('../models/Coach');
const Manager = require('../models/Manager');

// In-memory OTP store (Use Redis in production)
const otpStore = new Map();

const generateOTP = () => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

// @desc    Signup with Password
// @route   POST /api/auth/signup
// @access  Public
const signup = asyncHandler(async (req, res) => {
  const { mobile, password, role, name, uplineMobile, lineLevel, downlineCoaches } = req.body;

  if (!mobile || !password || !role) {
    res.status(400);
    throw new Error('Please provide all fields');
  }

  let user = await User.findOne({ mobile });

  if (user) {
    // If user exists and has a password
    if (user.password) {
      if (user.role === role) {
        res.status(400);
        throw new Error('User already exists. Please login.');
      }
      // If roles differ (e.g. Coach -> Manager), allow upgrade and update password
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(password, salt);
    } else {
      // OTP User setting password for first time
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(password, salt);
    }
    
    if (user.role !== role) {
        user.role = role; 
    }
    await user.save();
  } else {
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create User
    user = await User.create({
      mobile,
      password: hashedPassword,
      role,
      isVerified: true,
    });
  }

  // Resolve Upline if provided
  let uplineId = null;
  if (uplineMobile) {
    const uplineUser = await User.findOne({ mobile: uplineMobile });
    if (uplineUser) {
      uplineId = uplineUser._id;
    }
  }

  // Create role-specific profile
  if (role === 'customer') {
    // Check if a customer profile already exists for this mobile number (created by coach)
    let profile = await Customer.findOne({ mobile });
    
    if (profile) {
        // Link existing profile to this new user
        profile.user = user._id;
        if (name) profile.name = name;
        await profile.save();
    } else {
        // Create new profile
        await Customer.create({ 
            user: user._id, 
            name: name || 'New Customer',
            mobile: mobile,
            status: 'lead', // Default to lead so they appear in CRM
            pipelineStage: 'New'
        });
    }
  } else if (role === 'coach') {
    const profile = await Coach.findOne({ user: user._id });
    if (!profile) {
      // 1. Create the new Coach profile
      const newCoach = await Coach.create({ 
        user: user._id, 
        name: name || 'New Coach',
        mobile: mobile, // Ensure mobile is saved in Coach profile for stitching
        uplineCoachMobile: uplineMobile,
        upline: uplineId // This might be null if upline not found yet
      });

      // 2. Auto-Stitching (Orphan Logic)
      // Find other coaches who listed THIS new coach's mobile as their upline
      // and update their 'upline' field to point to this new user.
      const orphans = await Coach.find({ uplineCoachMobile: mobile, upline: null });
      
      if (orphans.length > 0) {
        console.log(`[Auto-Stitch] Found ${orphans.length} orphans for ${mobile}`);
        for (const orphan of orphans) {
          orphan.upline = user._id; // Link to the User ID of the new coach
          await orphan.save();
        }
      }
      
      // 3. If upline was NOT found by ID but mobile was provided, try to find by Coach mobile
      // (In case uplineUser logic above missed it or if we want to be double sure)
      if (!uplineId && uplineMobile) {
         const uplineCoach = await Coach.findOne({ mobile: uplineMobile });
         if (uplineCoach) {
             newCoach.upline = uplineCoach.user;
             await newCoach.save();
         }
      }
    }
  } else if (role === 'manager') {
    const profile = await Manager.findOne({ user: user._id });
    if (!profile) {
      await Manager.create({ 
        user: user._id, 
        name: name || 'New Manager',
        upline: uplineId,
        // lineLevel removed from top level as it's now per-coach
        candidateDownlines: downlineCoaches || [] // Expecting array of { mobile, lineLevel }
      });
    }
  }

  // Get name from role-specific profile
  let profileName = null;
  if (role === 'manager') {
    const manager = await Manager.findOne({ user: user._id });
    profileName = manager?.name || name || null;
  } else if (role === 'coach') {
    const coach = await Coach.findOne({ user: user._id });
    profileName = coach?.name || name || null;
  } else if (role === 'customer') {
    const customer = await Customer.findOne({ user: user._id });
    profileName = customer?.name || name || null;
  }

  res.status(201).json({
    _id: user._id,
    mobile: user.mobile,
    role: user.role,
    name: profileName,
    token: generateToken(user._id),
  });
});

// @desc    Login with Password
// @route   POST /api/auth/login
// @access  Public
const login = asyncHandler(async (req, res) => {
  const { mobile, password, role } = req.body;

  if (!mobile || !password || !role) {
    res.status(400);
    throw new Error('Please provide mobile, password, and role');
  }

  // Check for user
  const user = await User.findOne({ mobile }).select('+password');

  if (user && (await bcrypt.compare(password, user.password))) {
    // Verify role matches
    if (user.role !== role) {
      res.status(401);
      throw new Error(`Incorrect role. This number is registered as ${user.role}`);
    }

    // Get name from role-specific profile
    let name = null;
    if (role === 'manager') {
      const manager = await Manager.findOne({ user: user._id });
      name = manager?.name || null;
    } else if (role === 'coach') {
      const coach = await Coach.findOne({ user: user._id });
      name = coach?.name || null;
    } else if (role === 'customer') {
      const customer = await Customer.findOne({ user: user._id });
      name = customer?.name || null;
    }

    res.json({
      _id: user._id,
      mobile: user.mobile,
      role: user.role,
      name: name,
      token: generateToken(user._id),
    });
  } else {
    res.status(401);
    throw new Error('Invalid credentials');
  }
});

// @desc    Send OTP
// @route   POST /api/auth/send-otp
// @access  Public
const sendOtp = asyncHandler(async (req, res) => {
  const { mobile, role } = req.body;

  if (!mobile || !role) {
    res.status(400);
    throw new Error('Please provide mobile number and role');
  }

  const otp = generateOTP();
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

  // Store OTP
  otpStore.set(mobile, { otp, expiresAt, role });

  // Simulate sending OTP (Log to console)
  console.log(`[OTP SERVICE] OTP for ${mobile} (${role}): ${otp}`);

  res.status(200).json({
    message: 'OTP sent successfully',
    mobile,
  });
});

// @desc    Verify OTP & Login/Signup (Legacy/Alternative)
// @route   POST /api/auth/verify-otp
// @access  Public
const verifyOtp = asyncHandler(async (req, res) => {
  const { mobile, otp } = req.body;

  if (!mobile || !otp) {
    res.status(400);
    throw new Error('Please provide mobile and OTP');
  }

  const storedData = otpStore.get(mobile);

  if (!storedData) {
    res.status(400);
    throw new Error('OTP not found or expired');
  }

  if (storedData.otp !== otp) {
    res.status(400);
    throw new Error('Invalid OTP');
  }

  if (Date.now() > storedData.expiresAt) {
    otpStore.delete(mobile);
    res.status(400);
    throw new Error('OTP expired');
  }

  // OTP Verified - Clear it
  otpStore.delete(mobile);

  // Find or Create User
  let user = await User.findOne({ mobile });

  if (!user) {
    // Create new user
    user = await User.create({
      mobile,
      role: storedData.role,
      isVerified: true,
    });

    // Create role-specific profile
    if (storedData.role === 'customer') {
      await Customer.create({ user: user._id, name: 'New Customer' });
    } else if (storedData.role === 'coach') {
      await Coach.create({ user: user._id, name: 'New Coach' });
    } else if (storedData.role === 'manager') {
      await Manager.create({ user: user._id, name: 'New Manager' });
    }
  } else {
    // Verify role matches
    if (user.role !== storedData.role) {
      res.status(400);
      throw new Error(`Mobile number registered as ${user.role}, cannot login as ${storedData.role}`);
    }
  }

  // Get name from role-specific profile
  let name = null;
  if (user.role === 'manager') {
    const manager = await Manager.findOne({ user: user._id });
    name = manager?.name || null;
  } else if (user.role === 'coach') {
    const coach = await Coach.findOne({ user: user._id });
    name = coach?.name || null;
  } else if (user.role === 'customer') {
    const customer = await Customer.findOne({ user: user._id });
    name = customer?.name || null;
  }

  res.json({
    _id: user._id,
    mobile: user.mobile,
    role: user.role,
    name: name,
    token: generateToken(user._id),
  });
});

module.exports = { sendOtp, verifyOtp, login, signup };
