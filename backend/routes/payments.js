const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Company: notify admin that manual UPI payment (₹200) was sent (admin verifies & activates manually)
router.post('/notify-manual', requireAuth('company'), (req, res) => {
  const co = db.prepare('SELECT name, phone FROM companies WHERE id = ?').get(req.user.id);
  db.prepare(`INSERT INTO notifications (user_type, user_id, title, body) VALUES ('admin', NULL, ?, ?)`)
    .run('₹200 पेमेंट पडताळणी हवी', `${co.name} (${co.phone}) यांनी ₹200 UPI वर पाठवल्याचं सांगितलं आहे. कृपया तपासून सदस्यत्व सक्रिय करा.`);
  res.json({ ok: true });
});

module.exports = router;
