const Meeting = require('../models/Meeting');
const { sendMeetingReminder, transporter } = require('./emailService');

async function checkAndSendReminders() {
  try {
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 3600000); // 1 hour from now

    // Find meetings happening within the next hour that haven't had reminders sent
    const meetings = await Meeting.find({
      datetime: { 
        $gte: now,
        $lte: oneHourLater
      },
      reminderSent: false
    });

    // Process all matching meetings
    const results = await Promise.allSettled(
      meetings.map(async (meeting) => {
        try {
          // Create array of all recipients (participants + organizer)
          const allRecipients = [...meeting.participants, meeting.createdBy];
          
          // Send reminders to all recipients
          const emailResults = await Promise.allSettled(
            allRecipients.map(email => 
              sendMeetingReminder({
                email,
                meetingDetails: {
                  title: meeting.title,
                  datetime: meeting.datetime,
                  description: meeting.description
                }
              })
            )
          );

          // Log any failed sends
          emailResults.forEach((result, index) => {
            if (result.status === 'rejected') {
              console.error(`Failed to send reminder to ${allRecipients[index]}:`, result.reason);
            }
          });

          // Only mark as sent if all emails succeeded
          const allSucceeded = emailResults.every(r => r.status === 'fulfilled');
          if (allSucceeded) {
            meeting.reminderSent = true;
            await meeting.save();
          }

          return {
            meetingId: meeting._id,
            status: allSucceeded ? 'success' : 'partial',
            failedRecipients: emailResults
              .filter(r => r.status === 'rejected')
              .map((_, i) => allRecipients[i])
          };
        } catch (err) {
          console.error(`Error processing meeting ${meeting._id}:`, err);
          return {
            meetingId: meeting._id,
            status: 'failed',
            error: err.message
          };
        }
      })
    );

    console.log('Reminder processing complete. Results:', results);
    return results;
  } catch (err) {
    console.error('Reminder service error:', err);
    throw err;
  }
}

function start() {
  // Run immediately on startup
  checkAndSendReminders().catch(console.error);
  
  // Then run every 5 minutes
  setInterval(() => {
    checkAndSendReminders().catch(console.error);
  }, 5 * 60 * 1000); // 5 minutes
  
  console.log('⏰ Reminder service started');
}

module.exports = { 
  start,
  checkAndSendReminders // Export for testing
};