import nodemailer from 'nodemailer'

var mailClient = undefined
// Get SMTP credentials from ENV
if (process.env.SMTP_HOST !== '') {
  mailClient = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_SECURE.toLowerCase() === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}
export default mailClient