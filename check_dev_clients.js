const mongoose = require('mongoose');
const User = require('./models/User');
const Coach = require('./models/Coach');
const Customer = require('./models/Customer');
require('dotenv').config({ path: './src/.env' });

const checkClients = async () => {
  try {
    await mongoose.connect('mongodb://localhost:27017/pulseiq');
    
    const user = await User.findOne({ mobile: '9999999999' });
    if (!user) {
      console.log('Dev user not found');
      process.exit(1);
    }
    
    const coach = await Coach.findOne({ user: user._id });
    if (!coach) {
      console.log('Dev coach profile not found');
      process.exit(1);
    }
    
    const clients = await Customer.find({ upline: coach.user });
    console.log(`Found ${clients.length} clients for coach ${coach.name}`);
    
    if (clients.length === 0) {
      console.log('Creating a test client...');
      const clientUser = await User.create({
        mobile: '8888888888',
        password: 'password123',
        role: 'customer',
        isVerified: true
      });
      
      await Customer.create({
        user: clientUser._id,
        name: 'Test Client',
        upline: coach.user,
        bodyComposition: {
          weight: 70,
          fatPercent: 20
        }
      });
      console.log('Test client created: 8888888888');
    } else {
        console.log('Client ID:', clients[0]._id);
    }
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

checkClients();
