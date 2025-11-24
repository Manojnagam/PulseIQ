const mongoose = require('mongoose');
const User = require('./models/User');
const Coach = require('./models/Coach');
require('dotenv').config({ path: './src/.env' });

const connectDB = async () => {
  try {
    await mongoose.connect('mongodb://localhost:27017/pulseiq', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB Connected');
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
};

const seedDevUser = async () => {
  await connectDB();

  const mobile = '9999999999';
  
  // Check if exists
  let user = await User.findOne({ mobile });
  if (!user) {
    console.log('Creating Dev User...');
    user = await User.create({
      mobile: mobile,
      password: 'password123', 
      role: 'coach',
      isVerified: true
    });
  } else {
    console.log('Dev User already exists');
  }

  // Check Coach profile
  let coach = await Coach.findOne({ user: user._id });
  if (!coach) {
    console.log('Creating Coach Profile...');
    await Coach.create({
      user: user._id,
      name: 'Dev Coach',
      level: 'Level 1',
    });
  } else {
    console.log('Coach Profile already exists');
  }

  console.log('Seeding Complete');
  process.exit();
};

seedDevUser();
