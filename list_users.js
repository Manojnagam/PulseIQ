const mongoose = require('mongoose');
const User = require('./models/User');
const Coach = require('./models/Coach');
require('dotenv').config({ path: './src/.env' }); // Adjust path if needed

const connectDB = async () => {
  try {
    // Hardcoding URI if .env is tricky to load from script location
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

const listUsers = async () => {
  await connectDB();
  const users = await User.find({});
  console.log('Users:', users);
  const coaches = await Coach.find({});
  console.log('Coaches:', coaches);
  process.exit();
};

listUsers();
