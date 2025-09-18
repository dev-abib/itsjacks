const { mailSender } = require("../Helpers/emailSender");
const {
  createAdminSessionToken,
  verifyPassword,
  verifyAdminSessionToken,
  hashUserPassword,
  createSessionToken,
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


module.exports = {
  registerUserController,
  loginUserController,
};
