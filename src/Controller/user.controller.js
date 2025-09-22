const { mailSender } = require("../Helpers/emailSender");
const {
  createAdminSessionToken,
  verifyPassword,
  verifyAdminSessionToken,
  hashUserPassword,
  createSessionToken,
  otpGenerator,
  decodeSessionToken,
} = require("../Helpers/helper");
const { uploadCloudinary } = require("../Helpers/uploadCloudinary");
const { Admin } = require("../Schema/admin.schema");
const { user } = require("../Schema/user.schema");

const { apiError } = require("../Utils/api.error");
const { apiSuccess } = require("../Utils/api.success");
const { asyncHandler } = require("../Utils/asyncHandler");
const { emailChecker, passwordChecker } = require("../Utils/check");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");

// register user controller
const registerUserController = asyncHandler(async (req, res, next) => {
  const { fullName, email, role, password, confirmPassword } = req.body;

  const profilePicture = req.file;

  if (!profilePicture)
    return next(new apiError(400, "Government ID is required"));

  if (!email) return next(new apiError(400, "Email field is required"));

  if (!emailChecker(email))
    return next(new apiError(400, "Invalid Email format"));

  if (!password) return next(new apiError(400, "Password field is required"));

  if (!passwordChecker(password))
    return next(new apiError(400, "Invalid password format"));

  if (!confirmPassword)
    return next(new apiError(400, "Confirm password is required"));

  if (!passwordChecker(confirmPassword))
    return next(new apiError(400, "Invalid confirm password format"));

  if (password !== confirmPassword)
    return next(new apiError(400, "Passwords do not match"));

  const isExistingUser = await user.findOne({ email });
  if (isExistingUser) return next(new apiError(400, "Account already exists"));

  const hashedPassword = await hashUserPassword(password);

  // ✅ Upload government ID
  const uploadResult = await uploadCloudinary(
    profilePicture.buffer,
    "profilePic",
    {
      mimetype: profilePicture.mimetype,
      originalname: profilePicture.originalname,
    }
  );

  if (!uploadResult?.secure_url)
    return next(new apiError(500, "Failed to upload Government ID"));

  let savedUser = null;

  const newUser = new user({
    fullName,
    email,
    profilePicture: uploadResult.secure_url,
    role,
    password: hashedPassword,
  });

  savedUser = await newUser.save();

  if (!savedUser)
    return next(
      new apiError(500, "Unable to create account after multiple attempts")
    );

  const token = await createSessionToken({
    name: savedUser.name,
    email: savedUser.email,
    userId: savedUser._id,
    role: savedUser.role,
  });

  if (token)
    await user.findByIdAndUpdate(savedUser._id, { refreshToken: token });

  const responseData = {
    name: savedUser.name,
    email: savedUser.email,
    role: savedUser.role,
    token,
  };

  return res
    .status(200)
    .json(
      new apiSuccess(200, "Successfully registereduser.", responseData, true)
    );
});

// login user controller
const loginUserController = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email)
    return next(new apiError(400, "Email field is required", null, false));

  if (!emailChecker(email))
    return next(new apiError(400, "Invalid Email format", null, false));

  if (!password)
    return next(new apiError(400, "Password field is required", null, false));

  if (!passwordChecker(password))
    return next(new apiError(400, "Invalid password format", null, false));

  const isExistingUser = await user.findOne({ email });

  if (!isExistingUser)
    return next(new apiError(400, "Invalid email or password", null, false));

  const isVerifiedPass = await verifyPassword(
    password,
    isExistingUser.password
  );

  if (!isVerifiedPass)
    return next(new apiError(400, "Invalid email or password", null, false));

  const data = {
    name: isExistingUser.fullName,
    email: isExistingUser.email,
    userId: isExistingUser._id,
  };

  const token = await createSessionToken(data);
  isExistingUser.token = token;
  await isExistingUser.save();

  const responseData = {
    name: isExistingUser.fullName,
    email: isExistingUser.email,
    role: isExistingUser.role,
    token: token,
  };

  return res
    .status(200)
    .json(
      new apiSuccess(200, "Successfully logged in", responseData, true, null)
    );
});

// get me route controller
const getUserData = asyncHandler(async (req, res, next) => {
  const decodedData = await decodeSessionToken(req);

  if (!decodedData) return next(new apiError(401, "Unauthorized", null, false));

  const isExistingUser = await user.findById(decodedData?.userData?.userId);

  if (!isExistingUser)
    return next(new apiError(404, "User not found", null, false));

  const { password, resetToken, refreshToken, ...safeUserData } =
    isExistingUser.toObject();

  return res
    .status(200)
    .json(
      new apiSuccess(
        200,
        "Successfully retrieved user",
        safeUserData,
        true,
        null
      )
    );
});

// change passowrd controller
const changePassword = asyncHandler(async (req, res, next) => {
  const { prevPassword, password, confirmPassword } = req.body;
  const decodedData = await decodeSessionToken(req);

  if (!decodedData) return next(new apiError(401, "Unauthorized", null, false));

  console.log(decodedData);
  

  if (!prevPassword)
    return next(
      new apiError(400, "Previous password is required", null, false)
    );

  if (!password || !confirmPassword)
    return next(
      new apiError(
        400,
        "New password and confirmation are required",
        null,
        false
      )
    );
  if (password !== prevPassword)
    return next(new apiError(400, "Passwords do not match", null, false));

  const isExisteduser = await user.findById(decodedData.userData.userId);
  if (!user) return next(new apiError(404, "User not found", null, false));
  

  const isVerifiedPassword = await verifyPassword(
    prevPassword,
    isExisteduser.password
  );

  if (!isVerifiedPassword)
    return next(new apiError(401, "Incorrect current password", null, false));

  isExisteduser.password = await hashUserPassword(password);
  await isExisteduser.save();

  return res
    .status(200)
    .json(
      new apiSuccess(200, "Password changed successfully", null, true, null)
    );
});

// verify email controller
const verifyEmail = asyncHandler(async (req, res, next) => {
  const { email } = req.body;

  if (!email)
    return next(new apiError(400, "Email field is required", null, false));

  if (!emailChecker(email))
    return next(new apiError(400, "Invalid Email format", null, false));

  const isExisteduser = await user.findOne({ email });

  if (!isExisteduser)
    return next(new apiError(404, "User not found", null, false));

  const otp = await otpGenerator();

  isExisteduser.otp = otp;
  isExisteduser.otpExpiresAt = new Date(Date.now() + 2 * 60 * 1000);
  await isExisteduser.save();

  try {
    await mailSender({
      type: "otp",
      name: user.name || "User",
      emailAdress: email,
      subject: "Your One-Time Password (OTP)",
      otp,
    });

    return res
      .status(200)
      .json(new apiSuccess(200, "OTP sent successfully", email, true, null));
  } catch (error) {
    console.error("OTP email failed:", error.message);
    return next(new apiError(500, "Failed to send OTP email", null, false));
  }
});

// verify otp controller
const verifyOtp = asyncHandler(async (req, res, next) => {
  const { email, otp } = req.body;

  if (!email)
    return next(new apiError(400, "Email field is required", null, false));

  if (!otp)
    return next(new apiError(400, "OTP field is required", null, false));

  if (!emailChecker(email))
    return next(new apiError(400, "Invalid Email format", null, false));

  const isExisteduser = await userModel.findOne({ email });

  if (!isExisteduser)
    return next(new apiError(404, "User not found", null, false));

  if (isExisteduser.otp !== otp)
    return next(new apiError(400, "Invalid OTP", null, false));

  if (new Date() > isExisteduser.otpExpiresAt)
    return next(new apiError(400, "OTP expired", null, false));

  const token = await createSessionToken({
    name: isExisteduser.name,
    email: isExisteduser.email,
    telePhoneNumber: isExisteduser.telePhoneNumber,
  });

  isExisteduser.resetToken = token;
  isExisteduser.refreshToken = null;
  isExisteduser.otp = null;
  isExisteduser.otpExpiresAt = null;
  await isExisteduser.save();

  return res.status(200).json(
    new apiSuccess(
      200,
      "OTP verified successfully",
      {
        token: token,
      },
      true,
      null
    )
  );
});

// reset passwrod done
const resetPassword = asyncHandler(async (req, res, next) => {
  const { password, confirmPassword } = req.body;

  const decodedData = await decodeSessionToken(req);

  if (!decodedData) return next(new apiError(401, "Unauthorized", null, false));

  if (!password || !confirmPassword)
    return next(
      new apiError(400, "Password and confirmation are required", null, false)
    );

  if (!passwordChecker(password) || !passwordChecker(confirmPassword))
    return next(new apiError(400, "Invalid password format", null, false));

  if (password !== confirmPassword)
    return next(new apiError(400, "Passwords do not match", null, false));

  const user = await userModel.findOne({ email: decodedData.userData.email });

  if (!user) return next(new apiError(404, "User not found", null, false));

  user.password = await hashUserPassword(password);
  user.resetToken = null;
  await user.save();

  return res
    .status(200)
    .json(new apiSuccess(200, "Password reset successfully", null, true, null));
});



module.exports = {
  registerUserController,
  loginUserController,
  getUserData,
  changePassword,
  verifyEmail
};
