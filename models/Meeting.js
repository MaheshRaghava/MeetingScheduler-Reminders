// models/Meeting.js
const mongoose = require('mongoose');

const MeetingSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  datetime: { type: Date, required: true },
  duration: { type: Number, required: true, default: 60 }, // in minutes
  participants: [{ type: String, required: true }],
  createdBy: { type: String, required: true },
  organizerName: { type: String }, // Add this field for display name
  reminderSent: { type: Boolean, default: false }
}, {
  timestamps: true
});

module.exports = mongoose.model('Meeting', MeetingSchema);