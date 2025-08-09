const express = require('express');
const router = express.Router();
const Meeting = require('../models/Meeting');
const authenticateToken = require('../middleware/authMiddleware');
const { sendMeetingInvite } = require('../services/emailService');

// GET /api/meetings - return filtered meetings
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userEmail = req.user.email;
    const { filter } = req.query;
    const now = new Date();

    let query = {
      $or: [
        { createdBy: userEmail },
        { participants: userEmail }
      ]
    };

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

// POST /api/meetings - create new meeting with robust email handling
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { title, description, datetime, participants, duration } = req.body;
    const createdBy = req.user.email;
    const organizerName = req.user.name; // Get organizer name from user

    // Validation
    if (!title?.trim()) return res.status(400).json({ error: 'Meeting title is required' });
    if (!datetime) return res.status(400).json({ error: 'Meeting date/time is required' });
    if (!Array.isArray(participants)) return res.status(400).json({ error: 'Participants must be an array' });

    // Create meeting with all required fields
    const meeting = new Meeting({
      title: title.trim(),
      description: description?.trim() || '',
      datetime,
      duration: duration || 60, // Default to 60 minutes if not provided
      participants: participants.map(p => p.trim()),
      createdBy,
      organizerName, // Include organizer name
      reminderSent: false
    });

    await meeting.save();

    // Send invites using the centralized email service
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
      details: err.message,
      solution: 'Check server logs for detailed error information'
    });
  }
});

module.exports = router;