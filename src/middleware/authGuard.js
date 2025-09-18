// External dependencies
const jwt = require("jsonwebtoken");
// Internal dependencies
const { apiError } = require("../utils/apiError.js");
const { asyncHandler } = require("../utils/asyncaHandler.js");

// auth guard mechanism

const authguard = asyncHandler(async (req, res, next) => {
  const { cookie, authorization } = req.headers;
  const removeBearer = authorization?.split("Bearer")[1];
  const token = removeBearer?.split("@")[1];
  const cookiesToken = cookie
    ?.split("; ")
    .find((c) => c.startsWith("access_token="))
    ?.split("=")[1];

  if (!token && !cookiesToken) {
    return next(
      new apiError(401, "Unauthorized. Invalid access token.", null, false)
    );
  }

  if (token) {
    const decoded = jwt.verify(token, process.env.SECRET_KEY);
    if (decoded) {
      next();
    }
  } else if (cookiesToken) {
    const decoded = jwt.verify(cookiesToken, process.env.SECRET_KEY);
    if (decoded) {
      next();
    }
  }
});

module.exports = { authguard };
