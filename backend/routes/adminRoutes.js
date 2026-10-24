const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect, adminOnly } = require('../middleware/auth');
const { uploadCsvMemory } = require('../middleware/upload');
const ctrl = require('../controllers/adminController');

const router = express.Router();
router.use(protect, adminOnly); // every admin route requires an admin token

router.get('/stats', ctrl.getStats);

router.post('/students',
  [body('name').notEmpty(), body('email').isEmail(), body('department').notEmpty()],
  validate, ctrl.createStudent);
router.get('/students', ctrl.listStudents);
router.get('/students/:id', ctrl.getStudent);
router.put('/students/:id', ctrl.updateStudent);
router.delete('/students/:id', ctrl.deleteStudent);
router.put('/students/:id/suspend', ctrl.suspendStudent);
router.put('/students/:id/reset-password', ctrl.resetStudentPassword);

router.get('/credentials/export', ctrl.exportCredentials);

router.post('/students/bulk-results', uploadCsvMemory.single('file'), ctrl.bulkUploadResults);
router.post('/students/bulk-attendance', uploadCsvMemory.single('file'), ctrl.bulkUploadAttendance);

router.post('/notices', [body('title').notEmpty()], validate, ctrl.postNotice);
router.delete('/notices/:id', ctrl.deleteNotice);
router.post('/assignments', [body('title').notEmpty()], validate, ctrl.postAssignment);
router.post('/placements', [body('company').notEmpty()], validate, ctrl.postPlacement);

router.get('/login-history', ctrl.getLoginHistory);

module.exports = router;
