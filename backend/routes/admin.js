const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth('admin'));

router.get('/companies', (req, res) => {
  res.json(db.prepare('SELECT id, name, phone, category, location, status, membership_active, membership_expiry FROM companies ORDER BY created_at DESC').all());
});

router.put('/companies/:id/status', (req, res) => {
  const { status } = req.body; // approved | blocked
  db.prepare('UPDATE companies SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ ok: true });
});

router.get('/candidates', (req, res) => {
  res.json(db.prepare('SELECT id, name, phone, category, experience, resume_path, membership_active, membership_expiry FROM candidates ORDER BY created_at DESC').all());
});

router.get('/jobs', (req, res) => {
  res.json(db.prepare(`
    SELECT jobs.*, companies.name as company_name
    FROM jobs JOIN companies ON companies.id = jobs.company_id
    ORDER BY jobs.created_at DESC
  `).all());
});

router.put('/jobs/:id/status', (req, res) => {
  const { status } = req.body; // approved | rejected
  db.prepare('UPDATE jobs SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ ok: true });
});

router.get('/payments', (req, res) => {
  res.json(db.prepare('SELECT * FROM payments ORDER BY created_at DESC').all());
});

// Admin: candidate सदस्यत्व (₹99) manually सक्रिय करा
router.put('/candidates/:id/activate-membership', (req, res) => {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + 30);
  const expiryStr = expiry.toISOString().slice(0, 10);
  db.prepare('UPDATE candidates SET membership_active = 1, membership_expiry = ? WHERE id = ?').run(expiryStr, req.params.id);
  db.prepare('INSERT INTO payments (user_type, user_id, amount, method, status) VALUES (?,?,?,?,?)')
    .run('candidate', req.params.id, 99, 'Manual UPI', 'success');
  res.json({ ok: true, expiry: expiryStr });
});

// Admin: company सदस्यत्व (₹200) manually सक्रिय करा
router.put('/companies/:id/activate-membership', (req, res) => {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + 30);
  const expiryStr = expiry.toISOString().slice(0, 10);
  db.prepare('UPDATE companies SET membership_active = 1, membership_expiry = ? WHERE id = ?').run(expiryStr, req.params.id);
  db.prepare('INSERT INTO payments (user_type, user_id, amount, method, status) VALUES (?,?,?,?,?)')
    .run('company', req.params.id, 200, 'Manual UPI', 'success');
  res.json({ ok: true, expiry: expiryStr });
});

// Admin: candidate चं खातं पूर्णपणे काढून टाका
router.delete('/candidates/:id', (req, res) => {
  const id = req.params.id;
  db.prepare('DELETE FROM applications WHERE candidate_id = ?').run(id);
  db.prepare("DELETE FROM payments WHERE user_type = 'candidate' AND user_id = ?").run(id);
  db.prepare("DELETE FROM notifications WHERE user_type = 'candidate' AND user_id = ?").run(id);
  const info = db.prepare('DELETE FROM candidates WHERE id = ?').run(id);
  if (info.changes === 0) return res.status(404).json({ error: 'उमेदवार सापडला नाही.' });
  res.json({ ok: true });
});

// Admin: company चं खातं पूर्णपणे काढून टाका
router.delete('/companies/:id', (req, res) => {
  const id = req.params.id;
  const jobIds = db.prepare('SELECT id FROM jobs WHERE company_id = ?').all(id).map(j => j.id);
  if (jobIds.length) {
    const placeholders = jobIds.map(() => '?').join(',');
    db.prepare(`DELETE FROM applications WHERE job_id IN (${placeholders})`).run(...jobIds);
  }
  db.prepare('DELETE FROM jobs WHERE company_id = ?').run(id);
  db.prepare("DELETE FROM payments WHERE user_type = 'company' AND user_id = ?").run(id);
  db.prepare("DELETE FROM notifications WHERE user_type = 'company' AND user_id = ?").run(id);
  const info = db.prepare('DELETE FROM companies WHERE id = ?').run(id);
  if (info.changes === 0) return res.status(404).json({ error: 'कंपनी सापडली नाही.' });
  res.json({ ok: true });
});

module.exports = router;
