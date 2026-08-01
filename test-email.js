const nodemailer = require('nodemailer');
require('dotenv').config();

async function test() {
  console.log('Testing with:', process.env.SMTP_HOST, process.env.SMTP_PORT, process.env.SMTP_USER);
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  try {
    const info = await transporter.sendMail({
      from: `"Test" <${process.env.SMTP_USER}>`,
      to: process.env.SMTP_USER, // Send to self
      subject: 'Test Email',
      text: 'This is a test email',
    });
    console.log('Success:', info.messageId);
  } catch (error) {
    console.error('Error:', error.message);
  }
}
test();
