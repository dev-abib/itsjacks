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
const {
  uploadCloudinary,
  deleteCloudinaryAsset,
} = require("../Helpers/uploadCloudinary");
const { Admin } = require("../Schema/admin.schema");
const { Post } = require("../Schema/post.schema");
const { report } = require("../Schema/report.post.schem");
const { user } = require("../Schema/user.schema");

const { apiError } = require("../Utils/api.error");
const { apiSuccess } = require("../Utils/api.success");
const { asyncHandler } = require("../Utils/asyncHandler");
const { emailChecker, passwordChecker } = require("../Utils/check");

// register user controller
const registerUserController = asyncHandler(async (req, res, next) => {
  const { fullName, email, role, password, confirmPassword } = req.body;

  if (!email) return next(new apiError(400, "Email field is required"));

  if (!emailChecker(email))
    return next(new apiError(400, "Invalid Email format"));

  if (!password) return next(new apiError(400, "Password field is required"));

  if (!passwordChecker(confirmPassword))
    return next(
      new apiError(
        400,
        "Invalid  password format. Password must be 8–32 characters long, contain at least one uppercase letter, one lowercase letter, one number, and one special character (e.g., @, $, !, %, *, ?, &, #, +)."
      )
    );

  if (!confirmPassword)
    return next(new apiError(400, "Confirm password is required"));

  if (!passwordChecker(confirmPassword))
    return next(
      new apiError(
        400,
        "Invalid confirm password format. Password must be 8–32 characters long, contain at least one uppercase letter, one lowercase letter, one number, and one special character (e.g., @, $, !, %, *, ?, &, #, +)."
      )
    );

  if (password !== confirmPassword)
    return next(new apiError(400, "Passwords do not match"));

  const isExistingUser = await user.findOne({ email });
  if (isExistingUser) return next(new apiError(400, "Account already exists"));

  const hashedPassword = await hashUserPassword(password);

  let savedUser = null;

  const newUser = new user({
    fullName,
    email,
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
  };

  const otp = await otpGenerator();

  savedUser.otp = otp;
  savedUser.otpExpiresAt = new Date(Date.now() + 2 * 60 * 1000);
  await savedUser.save();

  const isMailSend = await mailSender({
    type: "verify-account",
    name: savedUser.fullName || "User",
    emailAdress: email,
    subject: "Your One-Time Password (OTP)",
    otp,
  });

  if (!isMailSend) {
    return next(new apiError(500, "Failed to send OTP email", null, false));
  }

  return res
    .status(200)
    .json(
      new apiSuccess(
        200,
        "User registered successfully. An OTP has been sent to your email address — please check your inbox.",
        responseData,
        true
      )
    );
});

// verify account
const verifyAccount = asyncHandler(async (req, res, next) => {
  const { email, otp } = req.body;

  if (!email)
    return next(new apiError(400, "Email field is required", null, false));

  if (!otp)
    return next(new apiError(400, "OTP field is required", null, false));

  if (!emailChecker(email))
    return next(new apiError(400, "Invalid Email format", null, false));

  const isExisteduser = await user.findOne({ email });

  if (!isExisteduser)
    return next(new apiError(404, "User not found", null, false));

  console.log(otp, isExisteduser.otp, "thsiis the ot");

  if (isExisteduser.otp !== otp)
    return next(new apiError(400, "Invalid OTP", null, false));

  if (new Date() > isExisteduser.otpExpiresAt)
    return next(new apiError(400, "OTP expired", null, false));

  isExisteduser.refreshToken = null;
  isExisteduser.otp = null;
  isExisteduser.otpExpiresAt = null;
  isExisteduser.isOtpVerified = true;
  await isExisteduser.save();

  return res
    .status(200)
    .json(
      new apiSuccess(200, "Account verified successfully", null, true, null)
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

  if (
    isExistingUser.isOtpVerified === null ||
    isExistingUser.isOtpVerified === undefined ||
    isExistingUser.isOtpVerified !== true
  ) {
    return next(
      new apiError(400, "Before login , please verify you account", null, false)
    );
  }

  const data = {
    name: isExistingUser.fullName,
    email: isExistingUser.email,
    userId: isExistingUser._id,
    role: isExistingUser.role,
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

  // Fetch all posts (events) created by the user
  const posts = await Post.find({ author: decodedData.userData.userId });

  // Calculate the sum of ratings for the posts
  let totalRatings = 0;
  let totalRatingsCount = 0;

  posts.forEach((post) => {
    totalRatingsCount += post.ratingInfo.length;
    totalRatings += post.ratingInfo.reduce(
      (ratingSum, ratingObj) => ratingSum + parseFloat(ratingObj.rating), // Use parseFloat here for decimals
      0
    );
  });

  // Calculate the average rating
  let averageRating = 0;
  if (totalRatingsCount > 0) {
    averageRating = totalRatings / totalRatingsCount; // This will give you a decimal result
  }

  // Update the creator rating on the user document
  isExistingUser.creator_rating = averageRating;
  await isExistingUser.save();

  const { password, resetToken, refreshToken, ...safeUserData } =
    isExistingUser.toObject();

  return res
    .status(200)
    .json(
      new apiSuccess(
        200,
        "Successfully retrieved user",
        { ...safeUserData, creator_rating: isExistingUser.creator_rating },
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

  const isExisteduser = await user.findOne({ email: email });

  if (!isExisteduser)
    return next(new apiError(404, "User not found", null, false));

  const otp = await otpGenerator();

  isExisteduser.otp = otp;
  isExisteduser.otpExpiresAt = new Date(Date.now() + 2 * 60 * 1000);
  await isExisteduser.save();

  try {
    await mailSender({
      type: "otp",
      name: isExisteduser.fullName || "User",
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

// resend otp controller
const resendOtp = asyncHandler(async (req, res, next) => {
  const { email } = req.body;

  if (!email)
    return next(new apiError(400, "Email field is required", null, false));

  if (!emailChecker(email))
    return next(new apiError(400, "Invalid Email format", null, false));

  const isExisteduser = await user.findOne({ email });

  if (!isExisteduser)
    return next(new apiError(404, "User not found", null, false));

  // check if OTP was sent recently (optional rate limit)
  if (
    isExisteduser.otpExpiresAt &&
    new Date() < new Date(isExisteduser.otpExpiresAt)
  ) {
    const remainingMs =
      new Date(isExisteduser.otpExpiresAt).getTime() - Date.now();
    if (remainingMs > 1 * 60 * 1000) {
      return next(
        new apiError(
          429,
          "Please wait before requesting another OTP (1 minute interval)",
          null,
          false
        )
      );
    }
  }

  // generate new otp
  const otp = await otpGenerator();

  // update user
  isExisteduser.otp = otp;
  isExisteduser.otpExpiresAt = new Date(Date.now() + 2 * 60 * 1000);
  await isExisteduser.save();

  try {
    await mailSender({
      type: "otp",
      name: isExisteduser.fullName || "User",
      emailAdress: email,
      subject: "Your New One-Time Password (OTP)",
      otp,
    });

    return res
      .status(200)
      .json(
        new apiSuccess(200, "New OTP sent successfully", { email }, true, null)
      );
  } catch (error) {
    console.error("Resend OTP failed:", error.message);
    return next(new apiError(500, "Failed to resend OTP email", null, false));
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

  const isExisteduser = await user.findOne({ email });

  if (!isExisteduser)
    return next(new apiError(404, "User not found", null, false));

  if (isExisteduser.otp !== otp)
    return next(new apiError(400, "Invalid OTP", null, false));

  if (new Date() > isExisteduser.otpExpiresAt)
    return next(new apiError(400, "OTP expired", null, false));

  const token = await createSessionToken({
    name: isExisteduser.fullName,
    email: isExisteduser.email,
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

  const isExisteduser = await user.findOne({
    email: decodedData.userData.email,
  });

  if (!user) return next(new apiError(404, "User not found", null, false));

  isExisteduser.password = await hashUserPassword(password);
  isExisteduser.resetToken = null;
  await isExisteduser.save();

  return res
    .status(200)
    .json(new apiSuccess(200, "Password reset successfully", null, true, null));
});

const updateUser = asyncHandler(async (req, res, next) => {
  const decodedData = await decodeSessionToken(req);
  if (!decodedData) return next(new apiError(401, "Unauthorized", null, false));

  const isExisteduser = await user.findById(decodedData?.userData?.userId);
  if (!isExisteduser)
    return next(new apiError(404, "User not found", null, false));

  const { fullName } = req.body;
  const profilePicture = req.file;

  if (fullName) isExisteduser.fullName = fullName.trim();

  if (profilePicture) {
    try {
      if (isExisteduser.profilePicture) {
        let isDeleted = await deleteCloudinaryAsset(
          isExisteduser.profilePicture
        );
      }

      const uploadResult = await uploadCloudinary(
        profilePicture.buffer,
        "profilePic"
      );

      if (!uploadResult?.secure_url) {
        return next(new apiError(500, "Profile picture upload failed"));
      }

      isExisteduser.profilePicture = uploadResult.secure_url;
    } catch (error) {
      console.error("Cloudinary error:", error);
      return next(new apiError(500, "Error updating profile picture"));
    }
  }

  const updatedUser = await isExisteduser.save();

  return res.status(200).json(
    new apiSuccess(
      200,
      "User updated successfully",
      {
        fullName: updatedUser.fullName,
        email: updatedUser.email,
        profilePic: updatedUser.profilePic,
      },
      true
    )
  );
});

const deleteUserAccount = asyncHandler(async (req, res, next) => {
  const decodedData = await decodeSessionToken(req);
  if (!decodedData) return next(new apiError(401, "Unauthorized", null, false));

  const userId = decodedData?.userData?.userId;
  const isExistedUser = await user.findById(userId);
  if (!isExistedUser)
    return next(new apiError(404, "User not found", null, false));

  try {
    if (isExistedUser.profilePicture) {
      await deleteCloudinaryAsset(isExistedUser.profilePicture);
    }

    const userPosts = await Post.find({ author: userId });
    for (const post of userPosts) {
      // Delete post images from Cloudinary
      if (post.images && post.images.length > 0) {
        for (const img of post.images) {
          await deleteCloudinaryAsset(img);
        }
      }
      await Post.findByIdAndDelete(post._id);
    }

    await Post.updateMany(
      {},
      {
        $pull: {
          likes: userId,
          savedBy: userId,
          "ratingInfo.user": userId,
        },
      }
    );

    await user.findByIdAndDelete(userId);

    return res
      .status(200)
      .json(
        new apiSuccess(
          200,
          "User account and all related data deleted successfully",
          null,
          true
        )
      );
  } catch (error) {
    console.error("Error deleting user data:", error);
    return next(
      new apiError(500, "Failed to delete user and related data", null, false)
    );
  }
});

// log out user
const logoutUser = asyncHandler(async (req, res, next) => {
  const decodedData = await decodeSessionToken(req);
  if (!decodedData) {
    return next(
      new apiError(401, "Unauthorized - Invalid or missing token", null, false)
    );
  }

  const isExistedUser = await user.findById(decodedData?.userData?.userId);
  if (!isExistedUser) {
    return next(new apiError(404, "User not found", null, false));
  }

  isExistedUser.refreshToken = null;
  await isExistedUser.save();

  return res
    .status(200)
    .json(new apiSuccess(200, "Logged out successfully", null, true));
});

// get single user
const getSingleuser = asyncHandler(async (req, res, next) => {
  const { userId } = req.params;

  const isExistedUser = await user.findById(userId);

  if (!isExistedUser) {
    return next(
      new apiError(404, "this account didn't exist or removed", null, false)
    );
  }

  return res
    .status(200)
    .json(
      new apiSuccess(
        200,
        "Successfully retrived user information",
        isExistedUser,
        false
      )
    );
});

// get sinlge user all post
const getUserAllPost = asyncHandler(async (req, res, next) => {
  const { userId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  // Check if user exists
  const isExistedUser = await user.findById(userId);
  if (!isExistedUser) {
    return next(
      new apiError(404, "This account didn't exist or removed", null, false)
    );
  }

  // Fetch paginated posts
  const posts = await Post.find({ author: userId })
    .skip(skip)
    .limit(limit)
    .sort({ createdAt: -1 })
    .lean(); // lean() to get plain JS objects

  // Fetch report info for each post
  const postIds = posts.map((post) => post._id);
  const reports = await report.aggregate([
    { $match: { postId: { $in: postIds } } },
    { $group: { _id: "$postId", reportCount: { $sum: 1 } } },
  ]);

  // Map report counts to posts
  const reportMap = {};
  reports.forEach((r) => {
    reportMap[r._id.toString()] = r.reportCount;
  });

  const postsWithReports = posts.map((post) => ({
    ...post,
    reportCount: reportMap[post._id.toString()] || 0,
    isReported: (reportMap[post._id.toString()] || 0) > 0,
  }));

  const totalPosts = await Post.countDocuments({ author: userId });
  const totalPages = Math.ceil(totalPosts / limit);

  return res.status(200).json(
    new apiSuccess(
      200,
      "Successfully retrieved user posts",
      {
        posts: postsWithReports,
        pagination: {
          totalPosts,
          totalPages,
          currentPage: page,
          pageSize: limit,
        },
      },
      false
    )
  );
});



module.exports = {
  registerUserController,
  loginUserController,
  getUserData,
  changePassword,
  verifyEmail,
  verifyOtp,
  resetPassword,
  updateUser,
  deleteUserAccount,
  logoutUser,
  verifyAccount,
  resendOtp,
  getSingleuser,
  getUserAllPost,
};

