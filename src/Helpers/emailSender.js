const nodemailer = require("nodemailer");
const { PasswordResetTemplate } = require("./email.template");

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
      html = PasswordResetTemplate(name, otp, process.env.MAIL_FROM_ADDRESS);
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
