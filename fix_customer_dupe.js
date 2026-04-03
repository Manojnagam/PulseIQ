const mongoose = require('mongoose');
const User = require('./models/User');
const Customer = require('./models/Customer');
const dotenv = require('dotenv');

dotenv.config();

const fixCustomer = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        const mobile = '7670835537'; 
        const user = await User.findOne({ mobile });

        if (!user) {
            console.log('User not found');
            process.exit(1);
        }

        const customers = await Customer.find({ mobile });
        console.log(`Found ${customers.length} profiles.`);

        if (customers.length < 2) {
            console.log('Less than 2 profiles found. Checking if single profile is linked...');
            if (customers.length === 1) {
                if (customers[0].user && customers[0].user.toString() === user._id.toString()) {
                    console.log('Profile is already linked correctly.');
                } else {
                    console.log('Profile exists but not linked. Linking now...');
                    customers[0].user = user._id;
                    await customers[0].save();
                    console.log('Linked.');
                }
            }
            process.exit();
        }

        // Identify the "Good" profile (has Coach/Data) and "Bad" profile (Just User link)
        let goodProfile = customers.find(c => c.coach && c.pack); // Has coach and pack
        let badProfile = customers.find(c => c.user && c.user.toString() === user._id.toString() && !c.coach); // Linked to user but no coach

        if (!goodProfile) {
             console.log('Could not find a profile with Coach data. Picking the first one with any data.');
             goodProfile = customers.find(c => c.name !== 'New Customer');
        }

        if (!goodProfile || !badProfile) {
            console.log('Could not clearly identify Good/Bad profiles. Manual intervention needed.');
            customers.forEach(c => console.log(c));
            process.exit(1);
        }

        console.log(`Merging Bad Profile (${badProfile._id}) into Good Profile (${goodProfile._id})...`);

        // Link Good Profile to User
        goodProfile.user = user._id;
        await goodProfile.save();

        // Delete Bad Profile
        await badProfile.deleteOne();

        console.log('Merge complete. Good profile is now linked to User.');

        process.exit();
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

fixCustomer();
