const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Coach = require('./models/Coach');
const Customer = require('./models/Customer');

dotenv.config();

const checkUser = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const mobile = '7981614593';
        const coach = await Coach.findOne({ mobile });
        if (coach) {
            console.log(`CHECK_RESULT_COACH: FOUND | ID: ${coach._id} | PWD: ${coach.password ? 'YES' : 'NO'}`);
        } else {
            console.log('CHECK_RESULT_COACH: NOT_FOUND');
        }
        
        const customer = await Customer.findOne({ mobile });
        if (customer) {
            console.log(`CHECK_RESULT_CUSTOMER: FOUND | ID: ${customer._id}`);
        } else {
            console.log('CHECK_RESULT_CUSTOMER: NOT_FOUND');
        }

    } catch (error) {
        console.log('CHECK_ERROR:', error.message);
    } finally {
        await mongoose.disconnect();
    }
};

checkUser();
