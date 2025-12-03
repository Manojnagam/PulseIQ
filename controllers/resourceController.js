const asyncHandler = require('express-async-handler');
const Resource = require('../models/Resource');
const Manager = require('../models/Manager');
const Coach = require('../models/Coach');

// @desc    Create a new resource
// @route   POST /api/resources
// @access  Private (Manager)
const createResource = asyncHandler(async (req, res) => {
  const { title, type, url, description } = req.body;

  const manager = await Manager.findOne({ user: req.user._id });
  if (!manager) {
    res.status(404);
    throw new Error('Manager profile not found');
  }

  const resource = await Resource.create({
    title,
    type,
    url,
    description,
    uploadedBy: manager._id,
  });

  res.status(201).json(resource);
});

// @desc    Get resources for a manager (My Resources)
// @route   GET /api/resources/manager
// @access  Private (Manager)
const getManagerResources = asyncHandler(async (req, res) => {
  const manager = await Manager.findOne({ user: req.user._id });
  if (!manager) {
    res.status(404);
    throw new Error('Manager profile not found');
  }

  const resources = await Resource.find({ uploadedBy: manager._id }).sort({ createdAt: -1 });
  res.json(resources);
});

// @desc    Get resources for a coach (From Upline Manager)
// @route   GET /api/resources/coach
// @access  Private (Coach)
// @desc    Get resources for a coach (From Upline Manager)
// @route   GET /api/resources/coach
// @access  Private (Coach)
const getCoachResources = asyncHandler(async (req, res) => {
  const coach = await Coach.findOne({ user: req.user._id });
  if (!coach) {
    res.status(404);
    throw new Error('Coach profile not found');
  }

  // Traverse up the hierarchy to find the first manager
  let currentUplineUserId = coach.upline;
  let managerId = null;

  while (currentUplineUserId) {
    // Check if this user is a manager
    const manager = await Manager.findOne({ user: currentUplineUserId });
    if (manager) {
      managerId = manager._id;
      break;
    }

    // If not a manager, check if it's a coach to continue traversing
    const uplineCoach = await Coach.findOne({ user: currentUplineUserId });
    if (uplineCoach && uplineCoach.upline) {
      currentUplineUserId = uplineCoach.upline;
    } else {
      // End of chain or broken link
      break;
    }
  }

  // If a manager is found, fetch their resources.
  // If no manager is found (e.g., top-level coach or orphaned), 
  // we fallback to fetching system-wide resources (where uploadedBy is null or we just return all).
  // For this implementation, we'll return all resources if no specific manager is found 
  // to ensure content availability in the demo.
  let query = {};
  if (managerId) {
    query = { uploadedBy: managerId };
  }

  const resources = await Resource.find(query).sort({ createdAt: -1 });
  res.json(resources);
});

// @desc    Delete a resource
// @route   DELETE /api/resources/:id
// @access  Private (Manager)
const deleteResource = asyncHandler(async (req, res) => {
  const resource = await Resource.findById(req.params.id);

  if (!resource) {
    res.status(404);
    throw new Error('Resource not found');
  }

  const manager = await Manager.findOne({ user: req.user._id });
  if (!manager || resource.uploadedBy.toString() !== manager._id.toString()) {
    res.status(401);
    throw new Error('Not authorized');
  }

  await resource.deleteOne();
  res.json({ message: 'Resource removed' });
});

module.exports = {
  createResource,
  getManagerResources,
  getCoachResources,
  deleteResource,
};
