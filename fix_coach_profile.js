const mongoose = require('mongoose');
const User = require('./models/User');
const Coach = require('./models/Coach');
const dotenv = require('dotenv');

dotenv.config();

const fixProfile = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        const mobile = '7981614593'; 
        const user = await User.findOne({ mobile });

        if (!user) {
            console.log('User not found! Cannot fix.');
            process.exit(1);
        }

        // Check by User ID first
        let coach = await Coach.findOne({ user: user._id });
        if (coach) {
            console.log('Coach profile already linked to user:', coach._id);
            process.exit();
        }

        // Check by Mobile
        coach = await Coach.findOne({ mobile });
        
        if (coach) {
            console.log('Found Coach profile with matching mobile but different/null User ID:', coach._id);
            console.log('Old User ID:', coach.user);
            
            // Update the user link
            coach.user = user._id;
            coach.name = 'Manoj Nagam'; // Ensure name is set
            coach.uplineCoachName = 'LakshmideviNagam';
            coach.uplineCoachMobile = '9908039069';
            
             // Resolve upline ID if possible
            const uplineUser = await User.findOne({ mobile: '9908039069' });
            if (uplineUser) {
                coach.upline = uplineUser._id;
            }

            await coach.save();
            console.log('Linked Coach profile to User:', user._id);
        } else {
            console.log('Creating NEW coach profile...');
            
            // Resolve upline
            const uplineMobile = '9908039069';
            let uplineId = null;
            const uplineUser = await User.findOne({ mobile: uplineMobile });
            if (uplineUser) {
                uplineId = uplineUser._id;
            }

            const newCoach = await Coach.create({
                user: user._id,
                name: 'Manoj Nagam',
                mobile: mobile,
                uplineCoachMobile: uplineMobile,
                uplineCoachName: 'LakshmideviNagam',
                upline: uplineId,
                wellnessCenterName: 'Manoj Nagam Wellness'
            });
            console.log('Created Coach Profile:', newCoach._id);
        }

        process.exit();
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

fixProfile();
