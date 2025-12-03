const express = require('express');
const router = express.Router();
const FoodItem = require('../models/FoodItem');
const Coach = require('../models/Coach');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

// @desc    Get all food items for the logged-in coach (or their customers)
// @route   GET /api/foods
// @access  Private
router.get('/', protect, async (req, res) => {
    try {
        // If user is a coach, get their created foods
        // If user is a customer, get foods created by their coach (assuming customer has a coachId field or we find it via relationship)
        // For simplicity in this iteration:
        // - Coaches see their own foods
        // - Customers see foods from their assigned coach
        
        let coachId;

        if (req.user.role === 'coach') {
            const coach = await Coach.findOne({ user: req.user._id });
            if (coach) coachId = coach._id;
        } else if (req.user.role === 'customer') {
            // Assuming the customer model has a 'coach' field which is the coach's ID
            // We might need to fetch the customer to get the coach ID if it's not in req.user
            // But usually req.user is populated from the token/DB. 
            // Let's assume req.user.coach is populated or available.
            // If not, we might need to look it up.
            // Let's check the Customer model later. For now, let's try to use req.user.coach
             coachId = req.user.coach;
        }

        // Fallback if no coachId found (e.g. admin or error)
        if (!coachId && req.user.role === 'customer') {
             // Try to find the customer's coach if not in req.user
             const Customer = require('../models/Customer');
             const customer = await Customer.findOne({ user: req.user._id });
             coachId = customer ? customer.coach : null;
        }

        if (!coachId) {
            return res.status(404).json({ message: 'Coach not found for this user' });
        }

        const foods = await FoodItem.find({ coachId }).sort({ createdAt: -1 });
        res.json(foods);
    } catch (error) {
        console.error("FOOD_ROUTE_ERROR:", error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
});

// @desc    Add a new food item
// @route   POST /api/foods
// @access  Private (Coach only)
router.post('/', protect, authorize('coach'), async (req, res) => {
    try {
        const { name, category, type, image, description } = req.body;

        const coach = await Coach.findOne({ user: req.user._id });
        if (!coach) {
            res.status(404);
            throw new Error('Coach profile not found');
        }

        const food = new FoodItem({
            name,
            category,
            type,
            image,
            description,
            coachId: coach._id
        });

        const createdFood = await food.save();
        res.status(201).json(createdFood);
    } catch (error) {
        console.error("FOOD_ROUTE_ERROR:", error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
});

// @desc    Update a food item
// @route   PUT /api/foods/:id
// @access  Private (Coach only)
router.put('/:id', protect, authorize('coach'), async (req, res) => {
    try {
        const { name, category, type, image, description } = req.body;
        const food = await FoodItem.findById(req.params.id);

        if (!food) {
            return res.status(404).json({ message: 'Food not found' });
        }

        // Make sure user owns the food item
        const coach = await Coach.findOne({ user: req.user._id });
        if (!coach || food.coachId.toString() !== coach._id.toString()) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        food.name = name || food.name;
        food.category = category || food.category;
        food.type = type || food.type;
        food.image = image || food.image;
        food.description = description || food.description;

        const updatedFood = await food.save();
        res.json(updatedFood);
    } catch (error) {
        console.error("FOOD_ROUTE_ERROR:", error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
});

// @desc    Delete a food item
// @route   DELETE /api/foods/:id
// @access  Private (Coach only)
router.delete('/:id', protect, authorize('coach'), async (req, res) => {
    try {
        const food = await FoodItem.findById(req.params.id);

        if (!food) {
            return res.status(404).json({ message: 'Food not found' });
        }

        // Make sure user owns the food item
        const coach = await Coach.findOne({ user: req.user._id });
        if (!coach || food.coachId.toString() !== coach._id.toString()) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        await food.deleteOne();
        res.json({ message: 'Food removed' });
    } catch (error) {
        console.error("FOOD_ROUTE_ERROR:", error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
});

module.exports = router;
