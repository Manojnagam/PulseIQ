
const mongoose = require('mongoose');
const User = require('./models/User');
const dotenv = require('dotenv');

dotenv.config({ path: './src/.env' });

const listUsers = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const users = await User.find({});
    console.log('Users found:', users.length);
    users.forEach(u => {
        console.log(`Role: ${u.role}, Name: ${u.name}, Email: ${u.email}, Password: (hidden)`);
    });
    process.exit();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

listUsers();
