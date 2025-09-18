// this file will be the main checker file 

// Email checker function
const emailChecker = (email) => {
  const EmailRegex = /^[\w\.-]+@[a-zA-Z\d\.-]+\.[a-zA-Z]{2,}$/;
  return EmailRegex.test(email);
};

// Password checker function
const passwordChecker = (password) => {
  const PasswordRegex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#+])[A-Za-z\d@$!%*?&#+]{8,32}$/;
  return PasswordRegex.test(password);
};

// Phone number checker function
const numberChecker = (number = "+8801707104399") => {
  // International format, e.g., +880 for Bangladesh, or generic international format
  const TelePhoneRegex = /^(\+?\d{1,3})?\s?\d{8,13}$/;
  return TelePhoneRegex.test(number);
};

module.exports = { emailChecker, passwordChecker, numberChecker };
