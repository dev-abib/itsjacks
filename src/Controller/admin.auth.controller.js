const { mailSender } = require("../Helpers/emailSender");
const {
  createAdminSessionToken,
  verifyPassword,
  verifyAdminSessionToken,
} = require("../Helpers/helper");
const { Admin } = require("../Schema/admin.schema");

const { apiError } = require("../Utils/api.error");
const { apiSuccess } = require("../Utils/api.success");
const { asyncHandler } = require("../Utils/asyncHandler");
const { emailChecker, passwordChecker } = require("../Utils/check");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");

const loginAdminController = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email)
    return next(new apiError(400, "Email field is required", null, false));

  if (!emailChecker(email))
    return next(new apiError(400, "Invalid Email format", null, false));

  if (!password)
    return next(new apiError(400, "Password field is required", null, false));

  if (!passwordChecker(password))
    return next(new apiError(400, "Invalid password format", null, false));

  const isExistingUser = await Admin.findOne({ email });
  if (!isExistingUser)
    return next(new apiError(400, "Invalid email or password", null, false));

  const isVerifiedPass = await verifyPassword(
    password,
    isExistingUser.password
  );
  if (!isVerifiedPass)
    return next(new apiError(400, "Invalid email or password", null, false));

  const tokenPayload = {
    name: isExistingUser.name,
    email: isExistingUser.email,
    adminId: isExistingUser._id,
    telePhoneNumber: isExistingUser.telePhoneNumber,
    profilePic: isExistingUser.profilePic,
    _id: isExistingUser._id,
  };

  const token = await createAdminSessionToken(tokenPayload);

  isExistingUser.refreshToken = token;
  await isExistingUser.save();

  const responseData = {
    name: isExistingUser.name,
    email: isExistingUser.email,
    role: isExistingUser.role,
    token,
  };

  return res
    .status(200)
    .json(
      new apiSuccess(200, "Successfully logged in", responseData, true, null)
    );
});

module.exports = {
  loginAdminController,
};
