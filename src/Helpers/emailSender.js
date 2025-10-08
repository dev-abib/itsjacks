const nodemailer = require("nodemailer");
const { PasswordResetTemplate, AccountVerificationTemplate } = require("./email.template");

const mailSender = async ({ type, name, emailAdress, subject, otp }) => {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      port: parseInt(process.env.MAIL_PORT),
      secure: process.env.MAIL_ENCRYPTION === "SSL",
      auth: {
        user: process.env.MAIL_USERNAME,
        pass: process.env.MAIL_PASSWORD,
      },
    });

    let html;

    if (type === "otp") {
      html = PasswordResetTemplate(name, otp, emailAdress);
    }

    if (type === "verify-account") {
      html = AccountVerificationTemplate(name, otp, emailAdress);
    }

    const mailOptions = {
      from: `"${process.env.MAIL_FROM_NAME}" <${process.env.MAIL_FROM_ADDRESS}>`,
      to: emailAdress,
      subject,
      html,
    };

    const info = await transporter.sendMail(mailOptions);
    return info;
  } catch (error) {
    console.error(
      "Email sending failed:",
      error || error.code || error.message
    );
    throw error;
  }
};

module.exports = { mailSender };
