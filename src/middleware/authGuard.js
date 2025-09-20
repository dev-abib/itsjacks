const jwt = require("jsonwebtoken");
const { apiError } = require("../Utils/api.error.js");
const { asyncHandler } = require("../Utils/asyncHandler.js");

const authguard = asyncHandler(async (req, res, next) => {
  const { cookie, authorization } = req.headers;
  
  const token = authorization?.split("Bearer ")[1];
  const cookiesToken = cookie
    ?.split("; ")
    .find((c) => c.startsWith("access_token="))
    ?.split("=")[1];

  if (!token && !cookiesToken) {
    return next(
      new apiError(401, "Unauthorized. Invalid access token.", null, false)
    );
  }

  try {
    if (token) {
      const decoded = jwt.verify(token, process.env.SECRET_KEY);
      if (decoded) return next();
    }

    if (cookiesToken) {
      const decoded = jwt.verify(cookiesToken, process.env.SECRET_KEY);
      if (decoded) return next();
    }

    return next(new apiError(401, "Unauthorized. Invalid token.", null, false));
  } catch (error) {
    return next(new apiError(401, "Unauthorized. Invalid token.", null, false));
  }
});

module.exports = { authguard };
