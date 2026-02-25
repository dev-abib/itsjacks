const { mailSender } = require("../Helpers/emailSender");
const {
  createAdminSessionToken,
  verifyPassword,
  decodeSessionToken,
} = require("../Helpers/helper");
const {
  uploadCloudinary,
  deleteCloudinaryAsset,
} = require("../Helpers/uploadCloudinary");
const { Admin } = require("../Schema/admin.schema");
const { companyAddressModel } = require("../Schema/company.address.schema");
const { dynamicPageModel } = require("../Schema/dynamic.page.schema");
const { Post } = require("../Schema/post.schema");
const { report } = require("../Schema/report.post.schem");
const { siteSettingModel } = require("../Schema/site.settings.schema");
const { socailSiteModel } = require("../Schema/social.media.schema");
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
  // 1. Auth check (assuming admin only – add admin middleware if not already)
  const decoded = await decodeSessionToken(req);
  if (!decoded) {
    return next(new apiError(401, "Unauthorized"));
  }

  // 2. Query params with sane defaults
  const {
    page = 1,
    limit = 10,
    search = "",
    sortBy = "createdAt",
    sortOrder = "desc",
  } = req.query;

  const pageNum = Math.max(1, Number(page));
  const perPage = Math.min(50, Math.max(5, Number(limit))); // reasonable bounds
  const skip = (pageNum - 1) * perPage;

  // 3. Search filter
  const searchFilter = search.trim()
    ? {
        $or: [
          { fullName: { $regex: search.trim(), $options: "i" } },
          { email: { $regex: search.trim(), $options: "i" } },
        ],
      }
    : {};

  // 4. Sorting
  const allowedSortFields = [
    "fullName",
    "email",
    "createdAt",
    "updatedAt",
    "role",
  ];
  const sortField = allowedSortFields.includes(sortBy) ? sortBy : "createdAt";
  const sortDir = sortOrder === "asc" ? 1 : -1;
  const sort = { [sortField]: sortDir };

  // 5. Aggregation – get counts + paginated data in one go
  const pipeline = [
    { $match: searchFilter },

    // Facet – counts + paginated slice
    {
      $facet: {
        metadata: [
          {
            $group: {
              _id: null,
              totalUsers: { $sum: 1 },
              totalCreators: {
                $sum: { $cond: [{ $eq: ["$role", "creator"] }, 1, 0] },
              },
              totalStudents: {
                $sum: { $cond: [{ $eq: ["$role", "student"] }, 1, 0] },
              },
              verifiedCreators: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $eq: ["$role", "creator"] },
                        { $eq: ["$isVerifiedAccount", true] },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
              bannedUsers: {
                $sum: { $cond: [{ $eq: ["$isBanned", true] }, 1, 0] },
              },
            },
          },
        ],

        users: [
          { $sort: sort },
          { $skip: skip },
          { $limit: perPage },
          {
            $project: {
              password: 0,
              resetToken: 0,
              refreshToken: 0,
              otp: 0,
              otpExpiresAt: 0,
              __v: 0,
            },
          },
        ],
      },
    },

    // Unwind metadata (single document)
    { $unwind: "$metadata" },
  ];

  const result = await user.aggregate(pipeline);

  if (!result.length) {
    return res.status(200).json(
      new apiSuccess(200, "No users found", {
        meta: {
          totalUsers: 0,
          totalCreators: 0,
          totalStudents: 0,
          verifiedCreators: 0,
          bannedUsers: 0,
          filteredCount: 0,
          currentPage: pageNum,
          totalPages: 0,
          perPage,
        },
        data: [],
      })
    );
  }

  const { metadata, users } = result[0];

  return res.status(200).json(
    new apiSuccess(200, "Users retrieved", {
      meta: {
        totalUsers: metadata.totalUsers,
        totalCreators: metadata.totalCreators,
        totalStudents: metadata.totalStudents,
        verifiedCreators: metadata.verifiedCreators,
        bannedUsers: metadata.bannedUsers,
        filteredCount: metadata.totalUsers,
        currentPage: pageNum,
        totalPages: Math.ceil(metadata.totalUsers / perPage),
        perPage,
        sortBy: sortField,
        sortOrder: sortDir === 1 ? "asc" : "desc",
      },
      data: users,
    })
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

const updateSocialSiteData = asyncHandler(async (req, res, next) => {
  const { facebook, instagram, youtube, twitter, linkdein } = req.body;
  console.log(req.body);

  const existingSocialSite = await socailSiteModel.findOne();

  if (existingSocialSite) {
    existingSocialSite.facebook = facebook || existingSocialSite.facebook;
    existingSocialSite.instagram = instagram || existingSocialSite.instagram;
    existingSocialSite.youtube = youtube || existingSocialSite.youtube;
    existingSocialSite.twitter = twitter || existingSocialSite.twitter;
    existingSocialSite.linkdein = linkdein || existingSocialSite.linkdein;

    await existingSocialSite.save();

    return res
      .status(200)
      .json(
        new apiSuccess(
          200,
          "Social site data updated successfully",
          existingSocialSite,
          false
        )
      );
  }

  const created = await socailSiteModel.create({
    facebook,
    instagram,
    youtube,
    twitter,
    linkdein,
  });

  return res
    .status(201)
    .json(
      new apiSuccess(201, "Smtp settings created successfully", created, false)
    );
});

const getSocialSiteData = asyncHandler(async (req, res, next) => {
  const data = await socailSiteModel.findOne();

  if (!data) {
    return next(new apiError(404, "Socail site data not found"));
  }

  return res
    .status(200)
    .json(
      new apiSuccess(200, "Socail site data fetched successfully", data, false)
    );
});

const upInseertCompanyAddress = asyncHandler(async (req, res, next) => {
  const {
    addressLine,
    city,
    state,
    zipCode,
    phoneNumber,
    descreptionTxt,
    accountTitle,
    addresstTitle,
  } = req.body;

  const comapanyAddress = await companyAddressModel.findOne();

  if (!comapanyAddress) {
    const newComapnyAddress = new companyAddressModel({
      accountTitle,
      addressLine,
      city,
      state,
      zipCode,
      phoneNumber,
      descreptionTxt,
      addresstTitle,
    });

    const saveCompanyAddress = await newComapnyAddress.save();

    return res
      .status(200)
      .json(
        new apiSuccess(
          200,
          "Successfully created company address data",
          saveCompanyAddress,
          true,
          false
        )
      );
  } else {
    comapanyAddress.accountTitle = accountTitle || comapanyAddress.accountTitle;
    comapanyAddress.addressLine = addressLine || comapanyAddress.addressLine;
    comapanyAddress.city = city || comapanyAddress.city;
    comapanyAddress.state = state || comapanyAddress.state;
    comapanyAddress.zipCode = zipCode || comapanyAddress.zipCode;
    comapanyAddress.phoneNumber = phoneNumber || comapanyAddress.phoneNumber;
    comapanyAddress.descreptionTxt =
      descreptionTxt || comapanyAddress.descreptionTxt;
    comapanyAddress.addresstTitle =
      addresstTitle || comapanyAddress.addresstTitle;

    await comapanyAddress.save();

    return res
      .status(200)
      .json(
        new apiSuccess(
          200,
          "Successfully updated company address data",
          null,
          true,
          false
        )
      );
  }
});

const getCompanyAddressData = asyncHandler(async (req, res, next) => {
  const comapanyAddress = await companyAddressModel.findOne();

  if (!comapanyAddress) {
    return next(new apiError(404, "company address not found", null, false));
  }

  return res
    .status(200)
    .json(
      new apiSuccess(
        200,
        "successfully get company data",
        comapanyAddress,
        false
      )
    );
});

const updateSiteSettings = asyncHandler(async (req, res, next) => {
  const {
    title,
    name,
    phoneNumber,
    syestemDetails,
    address,
    email,
    openingHour,
    copyrightTxt,
    infoNumber,
    infoMsg,
    infCompany,
  } = req.body;

  try {
    // Find the existing settings from the database
    const existingSettings = await siteSettingModel.findOne();

    // If settings exist, update them
    if (existingSettings) {
      existingSettings.title = title || existingSettings.title;
      existingSettings.name = name || existingSettings.name;
      existingSettings.phoneNumber =
        phoneNumber || existingSettings.phoneNumber;
      existingSettings.syestemDetails =
        syestemDetails || existingSettings.syestemDetails;
      existingSettings.address = address || existingSettings.address;
      existingSettings.email = email || existingSettings.email;
      existingSettings.openingHour =
        openingHour || existingSettings.openingHour;
      existingSettings.copyrightTxt =
        copyrightTxt || existingSettings.copyrightTxt;
      existingSettings.infoNumber = infoNumber || existingSettings.infoNumber;
      existingSettings.infoMsg = infoMsg || existingSettings.infoMsg;
      existingSettings.infCompany = infCompany || existingSettings.infCompany;

      // Save the updated settings
      await existingSettings.save();

      return res
        .status(200)
        .json(
          new apiSuccess(
            200,
            "Site settings updated successfully",
            existingSettings,
            false
          )
        );
    }

    // If no existing settings, create a new one
    const created = await siteSettingModel.create({
      title,
      name,
      phoneNumber,
      syestemDetails,
      address,
      email,
      openingHour,
      copyrightTxt,
      infoNumber,
      infoMsg,
      infCompany,
    });

    return res
      .status(201)
      .json(
        new apiSuccess(
          201,
          "Site settings created successfully",
          created,
          false
        )
      );
  } catch (error) {
    // Catch any unexpected errors
    console.error(error);
    return res.status(500).json({
      message: "An error occurred while updating the site settings.",
      error: error.message,
    });
  }
});

const getSiteSettings = asyncHandler(async (req, res, next) => {
  const data = await siteSettingModel.findOne();

  if (!data) {
    return next(new apiError(404, "Site settings not found"));
  }

  return res
    .status(200)
    .json(new apiSuccess(200, "Site settings fetched", data, false));
});

// delete user account
const adminDeleteUser = asyncHandler(async (req, res, next) => {
  const decodedData = await decodeSessionToken(req);
  if (!decodedData) return next(new apiError(401, "Unauthorized", null, false));

  // Only admin can delete users
  const adminId = decodedData?.adminData?.adminId;
  if (!adminId)
    return next(new apiError(403, "Forbidden: Admin only", null, false));

  const { userId } = req.params; // The user to delete
  const isExistedUser = await user.findById(userId);
  if (!isExistedUser)
    return next(new apiError(404, "User not found", null, false));

  try {
    // Delete profile picture
    if (isExistedUser.profilePicture) {
      await deleteCloudinaryAsset(isExistedUser.profilePicture);
    }

    // Delete all posts by this user
    const userPosts = await Post.find({ author: userId });
    for (const post of userPosts) {
      if (post.images && post.images.length > 0) {
        for (const img of post.images) {
          await deleteCloudinaryAsset(img);
        }
      }
      await Post.findByIdAndDelete(post._id);
    }

    // Remove references from other posts
    await Post.updateMany(
      {},
      {
        $pull: {
          likes: userId,
          savedBy: userId,
          ratingInfo: { user: userId }, // ✅ fixed
        },
      }
    );

    // Delete user account
    await user.findByIdAndDelete(userId);

    return res
      .status(200)
      .json(
        new apiSuccess(
          200,
          "User account and all related data deleted successfully by admin",
          null,
          true
        )
      );
  } catch (error) {
    console.error("Admin deletion error:", error);
    return next(
      new apiError(500, "Failed to delete user and related data", null, false)
    );
  }
});

// get all reports
const getAllReports = asyncHandler(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const search = req.query.search || "";
  const sortBy = req.query.sortBy || "createdAt";
  const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;

  // Build search filter
  const searchFilter = {};
  if (search) {
    searchFilter.$or = [
      { reasons: { $regex: search, $options: "i" } },
      { "senderId.email": { $regex: search, $options: "i" } },
    ];
  }

  // Count total reports with search
  const totalReports = await report.countDocuments(searchFilter);

  // Fetch reports with dynamic sort, populate sender & post
  const reports = await report
    .find(searchFilter)
    .populate({ path: "postId", select: "description author images postType" })
    .populate({ path: "senderId", select: "name email profilePicture" })
    .skip(skip)
    .limit(limit)
    .sort({ [sortBy]: sortOrder });

  const totalPages = Math.ceil(totalReports / limit);

  return res.status(200).json(
    new apiSuccess(
      200,
      "Successfully retrieved all reports",
      {
        reports,
        pagination: {
          totalReports,
          totalPages,
          currentPage: page,
          pageSize: limit,
        },
      },
      false
    )
  );
});
// get user all reports
const getReportsAgainstUser = asyncHandler(async (req, res, next) => {
  const { userId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  // Verify the user exists
  const isExistedUser = await user.findById(userId);
  if (!isExistedUser) {
    return next(new apiError(404, "User not found", null, false));
  }

  // Find all posts authored by this user
  const userPosts = await Post.find({ author: userId }).select("_id");
  const postIds = userPosts.map((post) => post._id);

  // Fetch reports against these posts
  const reports = await report
    .find({ postId: { $in: postIds } })
    .populate({ path: "postId", select: "description images postType" })
    .populate({ path: "senderId", select: "name email profilePicture" })
    .skip(skip)
    .limit(limit)
    .sort({ createdAt: -1 });

  const totalReports = await report.countDocuments({
    postId: { $in: postIds },
  });
  const totalPages = Math.ceil(totalReports / limit);

  return res.status(200).json(
    new apiSuccess(
      200,
      "Successfully retrieved reports submitted against this user",
      {
        totalReports,
        reports,
        pagination: {
          totalPages,
          currentPage: page,
          pageSize: limit,
        },
      },
      false
    )
  );
});

// delete report
const deleteReport = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const reportToDelete = await report.findById(id);
  if (!reportToDelete)
    return next(new apiError(404, "Report not found", null, false));

  try {
    await report.findByIdAndDelete(id);

    return res
      .status(200)
      .json(new apiSuccess(200, "Report deleted successfully", null, true));
  } catch (err) {
    console.error("Delete report error:", err);
    return next(new apiError(500, "Failed to delete report", null, false));
  }
});

// get all post
const getAllPosts = asyncHandler(async (req, res, next) => {
  const decodedData = await decodeSessionToken(req);
  if (!decodedData || !decodedData.adminData?.adminId) {
    return next(new apiError(401, "Unauthorized: Admin only", null, false));
  }

  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit) || 10, 100);
  const skip = (page - 1) * limit;
  const sortBy = req.query.sortBy || "createdAt";
  const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;

  const filter = {}; // no filtering, fetch all posts

  const totalPosts = await Post.countDocuments(filter);

  const posts = await Post.find(filter)
    .populate("author", "fullName email profilePicture")
    .sort({ [sortBy]: sortOrder })
    .skip(skip)
    .limit(limit);

  const postsFormatted = posts.map((post) => ({
    ...post.toObject(),
    likeCount: post.likes.length,
    saveCount: post.savedBy.length,
    ratingCount: post.ratingInfo.length,
  }));

  const pagination = {
    currentPage: page,
    limit,
    totalPages: Math.ceil(totalPosts / limit),
    totalPosts,
    hasNextPage: page * limit < totalPosts,
    hasPrevPage: page > 1,
    nextPage: page * limit < totalPosts ? page + 1 : null,
    prevPage: page > 1 ? page - 1 : null,
  };

  return res
    .status(200)
    .json(
      new apiSuccess(
        200,
        "All posts fetched successfully",
        { posts: postsFormatted, pagination },
        true
      )
    );
});

// delete posts
const deletePost = asyncHandler(async (req, res, next) => {
  const decodedData = await decodeSessionToken(req);
  if (!decodedData || !decodedData.adminData?.adminId) {
    return next(new apiError(401, "Unauthorized: Admin only", null, false));
  }

  const { postId } = req.params;
  const post = await Post.findById(postId);
  if (!post) {
    return next(new apiError(404, "Post not found", null, false));
  }

  // Delete images from Cloudinary
  if (post.images && post.images.length > 0) {
    for (const img of post.images) {
      try {
        await deleteCloudinaryAsset(img);
      } catch (err) {
        console.error("Failed to delete image from Cloudinary:", err);
      }
    }
  }

  // Delete post from DB
  await Post.findByIdAndDelete(postId);

  return res
    .status(200)
    .json(
      new apiSuccess(200, "Post deleted successfully by admin", null, true)
    );
});

// Create a new dynamic page
const createDynamicPage = asyncHandler(async (req, res, next) => {
  const decodedData = await decodeSessionToken(req);
  if (!decodedData || !decodedData.adminData?.adminId) {
    return next(new apiError(401, "Unauthorized: Admin only", null, false));
  }

  const { pageTitle, pageDescreption } = req.body;
  if (!pageTitle || !pageDescreption) {
    return next(
      new apiError(400, "Title and Description are required", null, false)
    );
  }

  const newPage = await dynamicPageModel.create({ pageTitle, pageDescreption });

  return res
    .status(201)
    .json(
      new apiSuccess(201, "Dynamic page created successfully", newPage, true)
    );
});

// Get all dynamic pages with search, sorting, and pagination
const getAllDynamicPages = asyncHandler(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  const search = req.query.search || "";
  const sortBy = req.query.sortBy || "createdAt";
  const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;

  const searchFilter = search
    ? { pageTitle: { $regex: search, $options: "i" } }
    : {};

  const totalPagesCount = await dynamicPageModel.countDocuments(searchFilter);

  const pages = await dynamicPageModel
    .find(searchFilter)
    .skip(skip)
    .limit(limit)
    .sort({ [sortBy]: sortOrder });

  const totalPages = Math.ceil(totalPagesCount / limit);

  return res.status(200).json(
    new apiSuccess(
      200,
      "Dynamic pages retrieved successfully",
      {
        pages,
        pagination: {
          totalPages: totalPages,
          currentPage: page,
          pageSize: limit,
        },
      },
      true
    )
  );
});

// Get a single dynamic page by ID
const getDynamicPageById = asyncHandler(async (req, res, next) => {
  const { pageId } = req.params;
  const page = await dynamicPageModel.findById(pageId);
  if (!page) {
    return next(new apiError(404, "Dynamic page not found", null, false));
  }
  return res
    .status(200)
    .json(new apiSuccess(200, "Page retrieved successfully", page, true));
});

// Update a dynamic page
const updateDynamicPage = asyncHandler(async (req, res, next) => {
  const decodedData = await decodeSessionToken(req);
  if (!decodedData || !decodedData.adminData?.adminId) {
    return next(new apiError(401, "Unauthorized: Admin only", null, false));
  }

  const { pageId } = req.params;
  const { pageTitle, pageDescreption } = req.body;

  const page = await dynamicPageModel.findById(pageId);
  if (!page) {
    return next(new apiError(404, "Dynamic page not found", null, false));
  }

  page.pageTitle = pageTitle || page.pageTitle;
  page.pageDescreption = pageDescreption || page.pageDescreption;

  await page.save();

  return res
    .status(200)
    .json(new apiSuccess(200, "Dynamic page updated successfully", page, true));
});

// Delete a dynamic page
const deleteDynamicPage = asyncHandler(async (req, res, next) => {
  const decodedData = await decodeSessionToken(req);
  if (!decodedData || !decodedData.adminData?.adminId) {
    return next(new apiError(401, "Unauthorized: Admin only", null, false));
  }

  const { pageId } = req.params;
  const page = await dynamicPageModel.findById(pageId);
  if (!page) {
    return next(new apiError(404, "Dynamic page not found", null, false));
  }

  await dynamicPageModel.findByIdAndDelete(pageId);

  return res
    .status(200)
    .json(new apiSuccess(200, "Dynamic page deleted successfully", null, true));
});

const getDynamicPageBySlug = asyncHandler(async (req, res, next) => {
  const { slug } = req.params;

  // Replace hyphens with spaces to match the title
  const title = slug.replace(/-/g, " ");

  // Find page by title (case-insensitive)
  const page = await dynamicPageModel.findOne({
    pageTitle: new RegExp(`^${title}$`, "i"),
  });

  if (!page) {
    return next(new apiError(404, "Dynamic page not found", null, false));
  }

  return res
    .status(200)
    .json(new apiSuccess(200, "Page retrieved successfully", { page }, true));
});

const verifyUserAccount = asyncHandler(async (req, res, next) => {
  const { userId } = req.params;

  const User = await user.findById(userId);
  if (!user) {
    return next(
      new apiError(404, "User not found, account deleted or removed by admin")
    );
  }

  const isVerified = !User.isVerifiedAccount;
  User.isVerifiedAccount = isVerified;
  await User.save();

  await mailSender({
    type: "verify-account",
    name: User.fullName,
    emailAdress: User.email,
    data: { isVerified },
    subject: `Your Account Has Been ${isVerified ? "Verified" : "Unverified"}`,
  });

  return res
    .status(200)
    .json(
      new apiSuccess(
        200,
        `Account ${isVerified ? "verified" : "verification removed"} successfully`
      )
    );
});

const banUnbannedUser = asyncHandler(async (req, res, next) => {
  const { userId } = req.params;

  const User = await user.findById(userId);
  if (!User) return next(new apiError(404, "User not found"));

  const willBeBanned = !User.isBanned;
  User.isBanned = willBeBanned;
  await User.save();

  const emailType = willBeBanned ? "account-banned" : "account-unbanned";
  const subject = willBeBanned
    ? "Account Suspension Notice"
    : "Account Reinstated";

  try {
    await mailSender({
      type: emailType,
      emailAddress: User.email, 
      data: {
        name: User.fullName || "User",
        email: User.email,
      },
      subject,
    });
  } catch (mailErr) {
    console.error("Email failed, but ban updated", mailErr);
    // still succeed — don't fail the request just because email didn't send
  }

  return res
    .status(200)
    .json(
      new apiSuccess(
        200,
        `User successfully ${willBeBanned ? "banned" : "unbanned"}`
      )
    );
});

module.exports = {
  loginAdminController,
  verifyAdmin,
  getAllUserData,
  updateAdminData,
  updateAdminPassword,
  updateSocialSiteData,
  getSocialSiteData,
  upInseertCompanyAddress,
  getCompanyAddressData,
  updateSiteSettings,
  getSiteSettings,
  adminDeleteUser,
  getAllReports,
  getReportsAgainstUser,
  deleteReport,
  getAllPosts,
  deletePost,
  createDynamicPage,
  getAllDynamicPages,
  getDynamicPageById,
  updateDynamicPage,
  deleteDynamicPage,
  getDynamicPageBySlug,
  verifyUserAccount,
  banUnbannedUser,
};
