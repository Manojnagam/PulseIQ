
const mongoose = require('mongoose');
const User = require('./models/User');

const connectDB = async () => {
  try {
    await mongoose.connect('mongodb://localhost:27017/pulseiq', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
};

const getCreds = async () => {
  await connectDB();
  const users = await User.find({});
  console.log('---CREDENTIALS---');
  users.forEach(u => {
      console.log(`${u.role}|${u.mobile}|password123`); 
  });
  console.log('---END---');
  process.exit();
};

getCreds();
