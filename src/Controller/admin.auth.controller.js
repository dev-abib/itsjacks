const { mailSender } = require("../Helpers/emailSender");
const {
  createAdminSessionToken,
  verifyPassword,
  verifyAdminSessionToken,
  decodeSessionToken,
} = require("../Helpers/helper");
const { Admin } = require("../Schema/admin.schema");
const { user } = require("../Schema/user.schema");

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

// get all available user controller

const getAllUserData = asyncHandler(async (req, res, next) => {
  const decodedData = await decodeSessionToken(req);
  if (!decodedData) {
    return next(new apiError(401, "Unauthorized", null, false));
  }

  const {
    page = 1,
    search = "",
    sortBy = "createdAt",
    sortOrder = "desc",
  } = req.query;
  const ITEMS_PER_PAGE = 10;
  const skip = (Number(page) - 1) * ITEMS_PER_PAGE;

  // Build search query
  const searchQuery = {
    $or: [
      { fullName: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ],
  };

  // Build sort options
  const validSortFields = ["fullName", "email", "createdAt", "updatedAt"];
  const sortField = validSortFields.includes(sortBy) ? sortBy : "createdAt";
  const sortDirection = sortOrder === "asc" ? 1 : -1;
  const sortOptions = { [sortField]: sortDirection };

  const totalUsersLength = await user.find();
  const total = await user.countDocuments(searchQuery);
  const users = await user
    .find(searchQuery)
    .sort(sortOptions)
    .skip(skip)
    .limit(ITEMS_PER_PAGE);

  if (!users.length) {
    return next(new apiError(404, "No users found", null, false));
  }

  const safeUsers = users.map((user) => {
    const { password, resetToken, refreshToken, otp, ...rest } =
      user.toObject();
    return rest;
  });

  const allUsersLength = totalUsersLength.length;

  return res.status(200).json(
    new apiSuccess(
      200,
      "Successfully retrieved users",
      {
        users: safeUsers,
        allUsersLength: allUsersLength,
        total,
        page: Number(page),
        totalPages: Math.ceil(total / ITEMS_PER_PAGE),
      },
      true,
      null
    )
  );
});

// verify admin
const verifyAdmin = asyncHandler(async (req, res, next) => {
  const decodedData = await decodeSessionToken(req);

  if (!decodedData)
    return next(new apiError(401, "Unauthorized request", null, false));

  const isExistedAdmin = await Admin.findById(decodedData.adminData._id);

  if (!isExistedAdmin) {
    return next(new apiError(401, "Unauthorized request", null, false));
  }

  const responsePayload = {
    name: isExistedAdmin.name,
    email: isExistedAdmin.email,
    adminId: isExistedAdmin._id,
    telePhoneNumber: isExistedAdmin.telePhoneNumber,
    profilePic: isExistedAdmin.profilePic,
    _id: isExistedAdmin._id,
  };

  return res.json(
    new apiSuccess(
      200,
      "successfully get admin data",
      responsePayload,
      true,
      null
    )
  );
});

module.exports = {
  loginAdminController,
  verifyAdmin,
  getAllUserData,
};
