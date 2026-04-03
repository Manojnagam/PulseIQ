const mongoose = require('mongoose');
const Contest = require('./models/Contest');
require('dotenv').config({ path: './src/.env' });

const verifyEnrollment = async () => {
  try {
    await mongoose.connect('mongodb://localhost:27017/pulseiq');
    
    // Get the contest ID from ids.json if possible, or just find the active one
    const contest = await Contest.findOne({ isActive: true });
    
    if (!contest) {
        console.log('No active contest found');
        process.exit(1);
    }

    console.log('Contest:', contest.title);
    console.log('Participants:', contest.participants.length);
    
    if (contest.participants.length > 0) {
        const p = contest.participants[contest.participants.length - 1];
        console.log('Last Participant:', p.customer);
        console.log('Proof URL:', p.startMetrics.proofUrl);
        console.log('Proof Type:', p.startMetrics.proofType);
    } else {
        console.log('No participants found.');
    }
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

verifyEnrollment();
