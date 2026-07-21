const express = require('express');
const { protect } = require('../middleware/auth');
const { uploadPhoto, uploadResume, uploadCertificate } = require('../middleware/upload');
const ctrl = require('../controllers/studentController');

const router = express.Router();

router.use(protect); // every route below requires a valid student/admin token

router.get('/me', ctrl.getMe);
router.put('/me', ctrl.updateMe);
router.put('/me/email', ctrl.updateEmail);

router.post('/me/photo', uploadPhoto.single('photo'), ctrl.uploadPhoto);
router.delete('/me/photo', ctrl.removePhoto);

router.post('/me/resume', uploadResume.single('resume'), ctrl.uploadResume);
router.delete('/me/resume', ctrl.deleteResume);
router.get('/me/resume/download', ctrl.downloadResume);

router.post('/me/certificates', uploadCertificate.single('certificate'), ctrl.uploadCertificate);
router.delete('/me/certificates/:certId', ctrl.deleteCertificate);
router.get('/me/certificates/:certId/download', ctrl.downloadCertificate);

router.get('/me/notifications', ctrl.getNotifications);
router.put('/me/notifications/:id/read', ctrl.markNotificationRead);
router.put('/me/notifications/read-all', ctrl.markAllNotificationsRead);

router.get('/me/documents/marksheet/:sem', ctrl.downloadMarksheet);
router.get('/me/documents/transcript', ctrl.downloadTranscript);
router.get('/me/documents/fee-receipt', ctrl.downloadFeeReceipt);
router.get('/me/documents/bonafide', ctrl.downloadBonafide);
router.get('/me/documents/attendance-report', ctrl.downloadAttendanceReport);
router.get('/me/documents/admit-card', ctrl.downloadAdmitCard);
router.get('/me/documents/profile', ctrl.downloadProfilePdf);

module.exports = router;
