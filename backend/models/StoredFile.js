const mongoose = require('mongoose');

// Uploaded files (photos, resumes, certificates) are stored in MongoDB instead of on disk.
// Free hosts like Render wipe the local disk on every restart/redeploy, so disk uploads
// would silently disappear. Files are capped at 8MB by multer, well under Mongo's 16MB doc limit.
const storedFileSchema = new mongoose.Schema({
  kind: { type: String, enum: ['photo', 'resume', 'certificate'], required: true },
  filename: { type: String, required: true, unique: true }, // the name used in /uploads/<kind>s/<filename>
  originalName: String,
  mimetype: String,
  size: Number,
  owner: { type: mongoose.Schema.Types.ObjectId },
  data: { type: Buffer, required: true }
}, { timestamps: true });

module.exports = mongoose.model('StoredFile', storedFileSchema);
