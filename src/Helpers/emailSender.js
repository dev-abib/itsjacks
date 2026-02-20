// Import necessary modules
const axios = require('axios');
const { PasswordResetTemplate, AccountVerificationTemplate } = require('./email.template');

// Async function to send an email using Brevo's API
const mailSender = async ({ type, name, emailAdress, subject, otp }) => {
  try {
    let html;

    // Determine the HTML template based on the email type (otp or verify-account)
    if (type === 'otp') {
      html = PasswordResetTemplate(name, otp, emailAdress);
    }

    if (type === 'verify-account') {
      html = AccountVerificationTemplate(name, otp, emailAdress);
    }

    // Prepare the email data for Brevo's API
    const emailData = {
      sender: { email: process.env.MAIL_FROM_ADDRESS, name: process.env.MAIL_FROM_NAME },
      to: [{ email: emailAdress }],
      subject: subject,
      htmlContent: html,
    };

    // Send the email using Brevo's API via Axios
    const response = await axios.post(
      'https://api.brevo.com/v3/smtp/email', 
      emailData, 
      {
        headers: {
          'Content-Type': 'application/json',
          'api-key': process.env.BREVO_API_KEY, 
        }
      }
    );


    return response.data;
  } catch (error) {

    console.error('Email sending failed:', error.response ? error.response.data : error.message);
    throw error;  
  }
};


module.exports = { mailSender };