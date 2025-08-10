const express = require('express');
const router = express.Router();
const Meeting = require('../models/Meeting');
const authenticateToken = require('../middleware/authMiddleware');
const { sendMeetingInvite } = require('../services/emailService');

// GET /api/meetings - Return only meetings created by the logged-in user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userEmail = req.user.email;
    const { filter } = req.query;
    const now = new Date();

    // Only show meetings created by this user (changed from $or query)
    let query = { createdBy: userEmail };

    // Apply time filters if specified
    if (filter === 'upcoming') query.datetime = { $gt: now };
    if (filter === 'past') query.datetime = { $lte: now };

    const meetings = await Meeting.find(query).sort({ datetime: 1 });
    res.json(meetings);
  } catch (err) {
    console.error('Error fetching meetings:', err);
    res.status(500).json({ 
      error: 'Server error while fetching meetings',
      details: err.message 
    });
  }
});

// POST /api/meetings - Create new meeting (no changes needed)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { title, description, datetime, participants, duration } = req.body;
    const createdBy = req.user.email;
    const organizerName = req.user.name;

    // Validation
    if (!title?.trim()) return res.status(400).json({ error: 'Meeting title is required' });
    if (!datetime) return res.status(400).json({ error: 'Meeting date/time is required' });
    if (!Array.isArray(participants)) return res.status(400).json({ error: 'Participants must be an array' });

    // Create meeting
    const meeting = new Meeting({
      title: title.trim(),
      description: description?.trim() || '',
      datetime,
      duration: duration || 60,
      participants: participants.map(p => p.trim()),
      createdBy,
      organizerName,
      reminderSent: false
    });

    await meeting.save();

    // Send invites (emailService.js already handles excluding creator)
    const emailResults = await sendMeetingInvite(meeting);

    res.status(201).json({
      meeting,
      emailsSent: emailResults.filter(r => r.status === 'fulfilled').length,
      emailsFailed: emailResults.filter(r => r.status === 'rejected').length
    });

  } catch (err) {
    console.error('Error creating meeting:', err);
    res.status(500).json({ 
      error: 'Server error while creating meeting',
      details: err.message
    });
  }
});

module.exports = router;
