const express = require('express');
const { protect } = require('../middleware/auth');
const ctrl = require('../controllers/contentController');

const router = express.Router();
router.use(protect);

router.get('/notices', ctrl.listNotices);
router.get('/assignments', ctrl.listAssignments);
router.get('/placements', ctrl.listPlacements);

module.exports = router;
