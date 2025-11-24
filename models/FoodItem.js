const mongoose = require('mongoose');

const foodItemSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    category: {
        type: String,
        enum: ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Drink', 'Other'],
        default: 'Other'
    },
    type: {
        type: String,
        enum: ['Recommended', 'Avoid', 'Moderate'],
        required: true
    },
    image: {
        type: String, // Base64 or URL
        default: ''
    },
    description: {
        type: String,
        trim: true
    },
    coachId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Coach',
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('FoodItem', foodItemSchema);
