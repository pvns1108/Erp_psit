const asyncHandler = require('express-async-handler');
const { Notice, Assignment, Placement } = require('../models/Misc');

const listNotices = asyncHandler(async (req, res) => {
  const notices = await Notice.find().sort('-pinned -createdAt').limit(100);
  res.json({ success: true, notices });
});

const listAssignments = asyncHandler(async (req, res) => {
  const assignments = await Assignment.find().sort('-createdAt').limit(100);
  res.json({ success: true, assignments });
});

const listPlacements = asyncHandler(async (req, res) => {
  const placements = await Placement.find().sort('-createdAt').limit(100);
  res.json({ success: true, placements });
});

module.exports = { listNotices, listAssignments, listPlacements };
