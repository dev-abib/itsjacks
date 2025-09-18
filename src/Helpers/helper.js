// Dependencies
// External dependencies
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

/**
 * Hashes the user's password for secure storage.
 * @param {string} password - The plain text password of the user.
 * @returns {string} The hashed password.
 */
const hashUserPassword = async (password) => {
  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    return hashedPassword;
  } catch (error) {
    console.error("Password hashing error:", error.message);
  }
};

/**
 * Verifies if the given plain text password matches the stored hashed password.
 * @param {string} password - The plain text password.
 * @param {string} hashedPassword - The hashed password stored in the database.
 * @returns {boolean} True if the passwords match, false otherwise.
 */
const verifyPassword = async (password, hashedPassword) => {
  try {
    return await bcrypt.compare(password, hashedPassword);
  } catch (error) {
    console.error("Password verification error:", error.message);
  }
};

/**
 * Generates a JWT access token for the user's session.
 * @param {object} userData - The user's data to be encoded in the token.
 * @returns {string} The generated JWT access token.
 */
const createSessionToken = async (userData) => {
  try {
    const secretKey = userData?.isReset
      ? process.env.RESET_SECRET_KEY
      : process.env.SECRET_KEY;

    return jwt.sign(
      { userData },
      secretKey,
      { expiresIn: process.env.EXPIRES_IN } 
    );
  } catch (error) {
    console.error("Error generating session token:", error);
  }
};


const createAdminSessionToken = async (adminData) => {
  try {
    return jwt.sign({ adminData }, process.env.ADMIN_SECRET_KEY, {
      expiresIn: process.env.EXPIRES_IN,
    });
  } catch (error) {
    console.error("Error generating admin session token:", error);
  }
};


const verifyAdminSessionToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.ADMIN_SECRET_KEY);
    return {
      valid: true,
      decoded,
    };
  } catch (error) {
    return {
      valid: false,
      error,
    };
  }
};

/**
 * Decodes the provided JWT token without verification, used for extracting user information.
 * @param {object} req - The request object containing headers or cookies.
 * @returns {object|null} The decoded token data or null if decoding fails.
 */

const decodeSessionToken = async (req) => {
  try {
    const { cookie, authorization } = req.headers;

    let tokenFromAuth = null;
    let tokenType = "user"; 

    if (authorization) {
      const bearerRegex = /^Bearer\s+/i;
      if (bearerRegex.test(authorization)) {
        tokenFromAuth = authorization
          .replace(bearerRegex, "")
          .trim()
          .replace(/^@/, "");
        
        if (authorization.includes("admin")) {
          tokenType = "admin";
        }
      }
    }

    let tokenFromCookies = null;

    if (cookie) {
      const found = cookie
        .split("; ")
        .find(
          (c) =>
            c.startsWith("session_token=") ||
            c.startsWith("reset_token=") ||
            c.startsWith("admin_token=")
        );

      if (found) {
        tokenFromCookies = found.split("=")[1];

        if (found.startsWith("reset_token=")) {
          isResetToken = true;
          tokenType = "reset";
        } else if (found.startsWith("admin_token=")) {
          tokenType = "admin";
        } else {
          tokenType = "user";
        }
      }
    }

    const token = tokenFromAuth || tokenFromCookies;

    if (!token) return null;

    let secret;
    switch (tokenType) {
      case "admin":
        secret = process.env.ADMIN_SECRET_KEY;
        break;
      case "reset":
        secret = process.env.RESET_SECRET_KEY;
        break;
      default:
        secret = process.env.SECRET_KEY;
        break;
    }

    const verifiedPayload = jwt.verify(token, secret);

    return verifiedPayload;
  } catch (error) {
    console.error("Error verifying session token:", error.message);
    return null;
  }
};



const aleaRNGFactory = require("number-generator/lib/aleaRNGFactory");

// otp generator function
const otpGenerator = () => {
  return aleaRNGFactory(new Date()).uInt32().toString().slice(0, 4);
};

module.exports = { otpGenerator };

module.exports = {
  createSessionToken,
  hashUserPassword,
  verifyPassword,
  decodeSessionToken,
  otpGenerator,
  createAdminSessionToken,
  verifyAdminSessionToken,
};
