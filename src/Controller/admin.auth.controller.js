const { mailSender } = require("../Helpers/emailSender");
const {
  createAdminSessionToken,
  verifyPassword,
  verifyAdminSessionToken,
  decodeSessionToken,
} = require("../Helpers/helper");
const { uploadCloudinary, deleteCloudinaryAsset } = require("../Helpers/uploadCloudinary");
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
    profilePicture: isExistingUser.profilePicture,
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
    telephoneNumber: isExistedAdmin.telephoneNumber,
    profilePicture: isExistedAdmin.profilePicture,
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

// update admin data
const updateAdminData = asyncHandler(async (req, res, next) => {
  const { name, email, telephoneNumber } = req.body;
  const profilePicture = req.file;
  
  const decodedData = await decodeSessionToken(req);

  if (!decodedData) {
    return next(new apiError(401, "Unauthorized request", null, false));
  }

  if (email && !emailChecker(email)) {
    return next(new apiError(400, "Invalid email format", null, false));
  }

  const { adminId } = decodedData.adminData || {};
  const isExistedAdmin = await Admin.findById(adminId);

  if (!isExistedAdmin) {
    return next(new apiError(401, "Unauthorized request", null, false));
  }

  if (profilePicture) {
    try {
      if (isExistedAdmin.profilePicture) {
        let isDeleted = await deleteCloudinaryAsset(
          isExistedAdmin.profilePicture
        );
      }

      const uploadResult = await uploadCloudinary(
        profilePicture.buffer,
        "adminProfilePic"
      );

      if (!uploadResult?.secure_url) {
        return next(new apiError(500, "Profile picture upload failed"));
      }

      isExistedAdmin.profilePicture = uploadResult.secure_url;
    } catch (error) {
      console.error("Cloudinary error:", error);
      return next(new apiError(500, "Error updating profile picture"));
    }
  }

  isExistedAdmin.name = name || isExistedAdmin.name;
  isExistedAdmin.telephoneNumber =
    telephoneNumber || isExistedAdmin.telephoneNumber;
  isExistedAdmin.email = email || isExistedAdmin.email;

  const savedAdmin = await isExistedAdmin.save();
  

  const responseData = {
    _id: savedAdmin._id,
    name: savedAdmin.name,
    email: savedAdmin.email,
    telephoneNumber: savedAdmin.telephoneNumber,
    profilePicture: savedAdmin.profilePicture,
  };

  return res
    .status(200)
    .json(
      new apiSuccess(
        200,
        "Admin data updated successfully",
        responseData,
        false
      )
    );
});

const updateAdminPassword = asyncHandler(async (req, res, next) => {
  const { currentPassword, password, confirmPassword } = req.body;

  const decodedData = await decodeSessionToken(req);

  if (!decodedData) {
    return next(new apiError(401, "Unauthorized request", null, false));
  }

  if (password !== confirmPassword) {
    return next(
      new apiError(
        400,
        "Password and confirm password didn't match",
        null,
        false
      )
    );
  }

  const { adminId } = decodedData.adminData || {};
  const isExistedAdmin = await Admin.findById(adminId);

  if (!isExistedAdmin) {
    return next(new apiError(401, "Unauthorized request", null, false));
  }

  const isVerifiedPass = await bcrypt.compare(
    currentPassword,
    isExistedAdmin.password
  );

  if (!isVerifiedPass) {
    return next(
      new apiError(
        401,
        "Invalid credentials , please try again later",
        null,
        false
      )
    );
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  isExistedAdmin.password = hashedPassword;
  await isExistedAdmin.save();

  return res
    .status(200)
    .json(
      new apiSuccess(200, "Admin password updated successfully", null, false)
    );
});

module.exports = {
  loginAdminController,
  verifyAdmin,
  getAllUserData,
  updateAdminData,
  updateAdminPassword,
};
