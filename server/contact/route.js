const express = require("express");
const { query } = require("../db");

const router = express.Router();
const clean = (value, maximum) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);

router.post("/", async (req, res) => {
  const firstName = clean(req.body.firstName, 100);
  const lastName = clean(req.body.lastName, 100);
  const organization = clean(req.body.organization, 200);
  const email = clean(req.body.email, 254).toLowerCase();
  const phone = clean(req.body.phone, 40);
  const message = clean(req.body.message, 4_000);

  if (!firstName || !email || !message) {
    return res.status(400).json({
      error: "First name, email, and message are required.",
    });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Enter a valid email address." });
  }

  const result = await query(
    `INSERT INTO contact_requests (
       first_name, last_name, organization, email, phone, message
     ) VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, created_at`,
    [
      firstName,
      lastName || null,
      organization || null,
      email,
      phone || null,
      message,
    ],
  );

  return res.status(201).json({
    success: true,
    requestId: String(result.rows[0].id),
    receivedAt: result.rows[0].created_at,
  });
});

module.exports = router;
