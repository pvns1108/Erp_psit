const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { UAParser } = require('ua-parser-js');

function signToken(id, role) {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
}

// Generates a readable student ID like PSIT/CSE/26045
function generateStudentId(department, year) {
  const deptCode = (department || 'GEN').slice(0, 3).toUpperCase();
  const yr = String(year || new Date().getFullYear()).slice(-2);
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `PSIT/${deptCode}/${yr}${rand}`;
}

// Generates a temporary password like Ps@7f3k9d
function generateTempPassword() {
  const raw = crypto.randomBytes(6).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
  return 'Psit@' + raw.slice(0, 6);
}

function generateResetToken() {
  const token = crypto.randomBytes(32).toString('hex');
  const hashed = crypto.createHash('sha256').update(token).digest('hex');
  return { token, hashed };
}

// Parses request metadata for login tracking
function parseRequestMeta(req) {
  const ua = req.headers['user-agent'] || '';
  const parser = new UAParser(ua);
  const result = parser.getResult();
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  return {
    ip,
    browser: result.browser.name ? `${result.browser.name} ${result.browser.version || ''}`.trim() : 'Unknown',
    os: result.os.name ? `${result.os.name} ${result.os.version || ''}`.trim() : 'Unknown',
    deviceType: result.device.type || 'desktop',
    userAgentRaw: ua
  };
}

module.exports = {
  signToken,
  generateStudentId,
  generateTempPassword,
  generateResetToken,
  parseRequestMeta
};
