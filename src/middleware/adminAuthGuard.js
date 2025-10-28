// External dependencies
const jwt = require("jsonwebtoken");
const { asyncHandler } = require("../Utils/asyncHandler");
const { apiError } = require("../Utils/api.error");

// Internal dependencies

// Admin auth guard middleware
const adminAuthGuard = asyncHandler(async (req, res, next) => {
  const { cookie, authorization } = req.headers;

  let token = null;

  if (authorization?.startsWith("Bearer ")) {
    const rawToken = authorization.replace(/^Bearer\s+/i, "").trim();
    token = rawToken.startsWith("@") ? rawToken.slice(1) : rawToken;
  }

  if (!token && cookie) {
    token = cookie
      .split("; ")
      .find((c) => c.startsWith("admin_token="))
      ?.split("=")[1];
  }

  if (!token) {
    return next(
      new apiError(401, "Unauthorized. Admin token is missing.", null, false)
    );
  }

  try {
    const decoded = jwt.verify(token, process.env.ADMIN_SECRET_KEY);

    req.admin = decoded;

    next();
  } catch (err) {
    return next(
      new apiError(401, "Invalid or expired admin token.", err.message, false)
    );
  }
});

module.exports = { adminAuthGuard };
