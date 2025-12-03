const mongoose = require('mongoose');
const User = require('./models/User');
const Coach = require('./models/Coach');
const Customer = require('./models/Customer');
require('dotenv').config({ path: './src/.env' });

const linkClient = async () => {
  try {
    await mongoose.connect('mongodb://localhost:27017/pulseiq');
    
    const coachUser = await User.findOne({ mobile: '9999999999' });
    const clientUser = await User.findOne({ mobile: '8888888888' });
    
    if (!coachUser || !clientUser) {
      console.log('Coach or Client user not found');
      process.exit(1);
    }
    
    const coach = await Coach.findOne({ user: coachUser._id });
    if (!coach) {
        console.log('Coach profile not found');
        process.exit(1);
    }

    let client = await Customer.findOne({ user: clientUser._id });
    
    if (!client) {
        console.log('Creating Customer profile for 8888888888');
        client = await Customer.create({
            user: clientUser._id,
            name: 'Test Client',
            mobile: '8888888888',
            coach: coach._id, // Use Coach ID
            bodyComposition: {
                weight: 70,
                fatPercent: 20
            }
        });
    } else {
        // Update coach
        client.coach = coach._id;
        await client.save();
    }

    console.log(`Linked client ${client.name} to coach ${coach.name}`);
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

linkClient();
