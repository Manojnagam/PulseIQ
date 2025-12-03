const mongoose = require('mongoose');
const Contest = require('./models/Contest');
const Customer = require('./models/Customer');
const User = require('./models/User');
const Coach = require('./models/Coach');
require('dotenv').config({ path: './.env' });

const getIds = async () => {
  try {
    await mongoose.connect('mongodb://localhost:27017/pulseiq');
    
    const contest = await Contest.findOne({ isActive: true });
    const clientUser = await User.findOne({ mobile: '8888888888' });
    const client = await Customer.findOne({ user: clientUser._id });
    const coachUser = await User.findOne({ mobile: '9999999999' });
    
    // We need a token for the coach. 
    // Since we can't easily generate a JWT without the secret (which is in .env),
    // we will rely on the fact that we can read .env.
    // Wait, I can generate a token if I have the secret.
    // The secret is in process.env.JWT_SECRET.
    
    const jwt = require('jsonwebtoken');
    const token = jwt.sign({ id: coachUser._id }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });

    const fs = require('fs');
    fs.writeFileSync('ids.json', JSON.stringify({
        contestId: contest._id,
        clientId: client._id,
        token: token
    }));
    console.log('IDs saved to ids.json');
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

getIds();
