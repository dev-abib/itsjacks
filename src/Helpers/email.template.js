const PasswordResetTemplate = (name, otp, email) => {
  return `
  <html lang="en">
    <head>
      <style>
        body {
          font-family: Arial, sans-serif;
          background-color: #f4f4f4;
          margin: 0;
          padding: 20px;
        }
        .container {
          max-width: 600px;
          background-color: #ffffff;
          padding: 30px;
          border-radius: 8px;
          box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
        }
        h2 {
          color: #333333;
          font-size: 24px;
        }
        p {
          font-size: 16px;
          color: #555555;
        }
        .otp {
          font-size: 32px;
          font-weight: bold;
          color: #4A90E2;
          margin: 20px 0;
          text-align: center;
          padding: 15px;
          border: 2px dashed #4A90E2;
          border-radius: 5px;
        }
        .cta-button {
          display: inline-block;
          padding: 12px 25px;
          font-size: 16px;
          color: #ffffff;
          background-color: #4A90E2;
          text-decoration: none;
          border-radius: 5px;
          text-align: center;
          margin-top: 20px;
          transition: background-color 0.3s;
        }
        .cta-button:hover {
          background-color: #357ABD;
        }
        .footer {
          margin-top: 30px;
          font-size: 12px;
          color: #777777;
          text-align: center;
        }
        .footer a {
          color: #4A90E2;
          text-decoration: none;
        }
      </style>
    </head>
    <body>

      <div class="container">
        <h2>Hello ${name},</h2>
        <p>We received a request to reset your password. Please use the following One-Time Password (OTP) to proceed:</p>

        <div class="otp">${otp}</div>

        <p>This OTP is valid for 2 minutes. If you did not request this, please ignore this email.</p>

       <p class="footer">This email was sent to: <strong>${email}</strong>. If you did not request a password reset, please <a href="<%= contactSupportLink %>">contact support</a>.</p>
      </div>

    </body>
  </html>
  `;
};

const AccountVerificationTemplate = (name, otp, email) => {
  return `
  <html lang="en">
    <head>
      <style>
        body {
          font-family: Arial, sans-serif;
          background-color: #f9f9f9;
          margin: 0;
          padding: 20px;
        }
        .container {
          max-width: 600px;
          background-color: #ffffff;
          padding: 30px;
          border-radius: 8px;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
        }
        h2 {
          color: #333333;
          font-size: 24px;
        }
        p {
          font-size: 16px;
          color: #555555;
        }
        .otp {
          font-size: 32px;
          font-weight: bold;
          color: #28a745;
          margin: 20px 0;
          text-align: center;
          padding: 15px;
          border: 2px dashed #28a745;
          border-radius: 5px;
        }
        .cta-button {
          display: inline-block;
          padding: 12px 25px;
          font-size: 16px;
          color: #ffffff;
          background-color: #28a745;
          text-decoration: none;
          border-radius: 5px;
          text-align: center;
          margin-top: 20px;
          transition: background-color 0.3s;
        }
        .cta-button:hover {
          background-color: #1f7a36;
        }
        .footer {
          margin-top: 30px;
          font-size: 12px;
          color: #777777;
          text-align: center;
        }
        .footer a {
          color: #28a745;
          text-decoration: none;
        }
      </style>
    </head>
    <body>

      <div class="container">
        <h2>Welcome ${name},</h2>
        <p>Thank you for signing up! To complete your registration, please verify your email address by entering the OTP below:</p>

        <div class="otp">${otp}</div>

        <p>This OTP is valid for 2 minutes. Please do not share it with anyone.</p>

        <p class="footer">This verification email was sent to: <strong>${email}</strong>.  
        If you didn’t create an account, just simple ignore it.</p>
      </div>
    </body>
  </html>
  `;
};


module.exports = {
  PasswordResetTemplate,
  AccountVerificationTemplate
};
