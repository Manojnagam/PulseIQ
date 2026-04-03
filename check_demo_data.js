
const mongoose = require('mongoose');
const Customer = require('./models/Customer');

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

const checkData = async () => {
  await connectDB();
  const customer = await Customer.findOne({ mobile: '5555555555' });
  console.log('Customer Data:', JSON.stringify(customer, null, 2));
  process.exit();
};

checkData();
