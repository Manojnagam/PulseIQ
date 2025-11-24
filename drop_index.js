require('dotenv').config();
const mongoose = require('mongoose');

const dropIndex = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected');

    const collection = mongoose.connection.collection('customers');
    
    // List indexes to confirm
    const indexes = await collection.indexes();
    console.log('Current Indexes:', indexes);

    // Drop the specific index
    const indexExists = indexes.find(idx => idx.name === 'user_1');
    if (indexExists) {
        await collection.dropIndex('user_1');
        console.log('Index "user_1" dropped successfully');
    } else {
        console.log('Index "user_1" not found. It might have already been dropped.');
    }

    process.exit();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

dropIndex();
