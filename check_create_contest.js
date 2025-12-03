const mongoose = require('mongoose');
const User = require('./models/User');
const Manager = require('./models/Manager');
const Contest = require('./models/Contest');
require('dotenv').config({ path: './src/.env' });

const checkContest = async () => {
  try {
    await mongoose.connect('mongodb://localhost:27017/pulseiq');
    
    // Find or create manager
    let managerUser = await User.findOne({ role: 'manager' });
    if (!managerUser) {
        console.log('Creating Manager User...');
        managerUser = await User.create({
            mobile: '7777777777',
            password: 'password123',
            role: 'manager',
            isVerified: true
        });
    }

    let manager = await Manager.findOne({ user: managerUser._id });
    if (!manager) {
        console.log('Creating Manager Profile...');
        manager = await Manager.create({
            user: managerUser._id,
            name: 'Test Manager',
            wellnessCenterName: 'Test Center'
        });
    }

    // Check for active contest
    const activeContest = await Contest.findOne({ 
        isActive: true,
        endDate: { $gte: new Date() }
    });

    if (!activeContest) {
        console.log('Creating Active Contest...');
        await Contest.create({
            title: 'Test Contest',
            type: 'weight-loss',
            description: 'Test Description',
            startDate: new Date(),
            endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
            createdBy: manager._id,
            isActive: true
        });
        console.log('Contest created');
    } else {
        console.log('Active contest found:', activeContest.title);
    }
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

checkContest();
