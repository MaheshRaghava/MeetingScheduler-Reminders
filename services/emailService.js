const nodemailer = require('nodemailer');
const ical = require('ical-generator'); 
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const sendVerificationEmail = async (email, code) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: 'Verify Your Email - Meeting Scheduler',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
          <h2 style="color: #6573FF;">Email Verification</h2>
          <p>Thank you for registering with Meeting Scheduler!</p>
          <p>Your verification code is:</p>
          <div style="background: #f4f4f4; padding: 15px; border-radius: 5px; text-align: center; font-size: 24px; font-weight: bold; margin: 20px 0;">
            ${code}
          </div>
          <p>This code will expire in 24 hours.</p>
          <p>If you didn't request this, please ignore this email.</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Email sending error:', error);
    throw error;
  }
};

async function sendMeetingInvite(meeting) {
  try {
    const endTime = new Date(meeting.datetime.getTime() + (meeting.duration || 60) * 60000);

    const calendar = ical({
      name: 'Meeting Invitation',
      events: [{
        start: meeting.datetime,
        end: endTime,
        summary: meeting.title,
        description: meeting.description,
        organizer: { 
          name: meeting.organizerName || meeting.createdBy, 
          email: meeting.createdBy 
        },
        attendees: meeting.participants.map(email => ({ email }))
      }]
    });

    const formattedDate = meeting.datetime.toLocaleString('en-US', {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    const results = await Promise.allSettled(
      meeting.participants.map(recipientEmail => 
        transporter.sendMail({
          from: `"Meeting Scheduler" <${process.env.EMAIL_USER}>`,
          to: recipientEmail,
          subject: `Meeting Invitation: ${meeting.title}`,
          text: `Dear ${recipientEmail},\n\n` +
                `You have been invited to a meeting. Here are the details:\n\n` +
                `Title: ${meeting.title}\n` +
                `Time: ${formattedDate}\n` +
                `Organizer: ${meeting.createdBy}\n` +
                `Description: ${meeting.description || "No description provided"}\n\n` +
                `Thank you,\n` +
                `${meeting.organizerName || meeting.createdBy}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; line-height: 1.6;">
              <p>Dear ${recipientEmail},</p>
              <p>You have been invited to a meeting. Here are the details:</p>
              
              <div style="margin: 15px 0; padding-left: 15px;">
                <p><strong>Title:</strong> ${meeting.title}</p>
                <p><strong>Time:</strong> ${formattedDate}</p>
                <p><strong>Organizer:</strong> ${meeting.createdBy}</p>
                <p><strong>Description:</strong> ${meeting.description || "No description provided"}</p>
              </div>
              
              <p>Thank you,</p>
              <p>${meeting.organizerName || meeting.createdBy}</p>
            </div>
          `,
          attachments: [{
            filename: 'meeting.ics',
            content: calendar.toString()
          }]
        })
      )
    );

    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`Failed to send to ${meeting.participants[index]}:`, result.reason.message);
      }
    });

    return results;
  } catch (error) {
    console.error('Meeting invite error:', error);
    throw error;
  }
}

module.exports = {
  sendVerificationEmail,
  sendMeetingInvite,
  transporter
};