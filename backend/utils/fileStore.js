const fs = require('fs');
const path = require('path');
const StoredFile = require('../models/StoredFile');

// Turns a stored path like "/uploads/photos/<filename>" into its filename
function filenameFromPath(p) {
  return p ? path.basename(p) : '';
}

// Deletes a file from MongoDB (and from the old disk location, for files uploaded before the switch)
async function deleteStoredFile(p) {
  if (!p) return;
  const filename = filenameFromPath(p);
  try { await StoredFile.deleteOne({ filename }); } catch (e) { /* best-effort */ }
  fs.unlink(path.join(__dirname, '..', p), () => {});
}

// Sends a stored file. `asAttachment` → download with downloadName; otherwise inline (e.g. <img src>)
async function sendStoredFile(res, p, { asAttachment = false, downloadName } = {}) {
  const filename = filenameFromPath(p);
  const file = filename ? await StoredFile.findOne({ filename }) : null;
  if (file) {
    res.setHeader('Content-Type', file.mimetype || 'application/octet-stream');
    res.setHeader('Content-Length', file.data.length);
    const name = (downloadName || file.originalName || filename).replace(/"/g, '');
    res.setHeader('Content-Disposition', `${asAttachment ? 'attachment' : 'inline'}; filename="${name}"`);
    if (!asAttachment) res.setHeader('Cache-Control', 'private, max-age=86400');
    return res.end(file.data);
  }
  // Fallback: files uploaded to disk by an older version of the app
  const diskPath = path.join(__dirname, '..', p || '');
  if (p && diskPath.startsWith(path.join(__dirname, '..', 'uploads')) && fs.existsSync(diskPath)) {
    return asAttachment ? res.download(diskPath, downloadName) : res.sendFile(diskPath);
  }
  res.status(404);
  throw new Error('File not found — it may have been removed');
}

module.exports = { deleteStoredFile, sendStoredFile };
