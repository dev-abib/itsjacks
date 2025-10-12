const { Post } = require("../Schema/post.schema");
const { user } = require("../Schema/user.schema");
const { asyncHandler } = require("../Utils/asyncHandler");
const { apiError } = require("../Utils/api.error");
const { apiSuccess } = require("../Utils/api.success");
const { decodeSessionToken } = require("../Helpers/helper");
const { uploadCloudinary } = require("../Helpers/uploadCloudinary");

/**
 * @desc Create new post
 */
const createPost = asyncHandler(async (req, res, next) => {
  const decodedData = await decodeSessionToken(req);
  if (!decodedData) return next(new apiError(401, "Unauthorized", null, false));

  const { description } = req.body;
  const files = req.files;

  if (!files || files.length === 0)
    return next(
      new apiError(400, "At least one image is required", null, false)
    );

  let uploadedImages = [];
  try {
    for (const file of files) {
      const uploadResult = await uploadCloudinary(file.buffer, "postImages");
      if (uploadResult?.secure_url) {
        uploadedImages.push(uploadResult.secure_url);
      }
    }
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    return next(new apiError(500, "Failed to upload post images", null, false));
  }

  const newPost = await Post.create({
    description,
    images: uploadedImages,
    author: decodedData.userData.userId,
  });

  return res
    .status(201)
    .json(new apiSuccess(201, "Post created successfully", newPost, true));
});

/**
 * @desc Like or Unlike post
 */
const toggleLikePost = asyncHandler(async (req, res, next) => {
  const decodedData = await decodeSessionToken(req);
  if (!decodedData) return next(new apiError(401, "Unauthorized", null, false));

  const { postId } = req.params;
  const userId = decodedData.userData.userId;

  const post = await Post.findById(postId);
  if (!post) return next(new apiError(404, "Post not found", null, false));

  const isLiked = post.likes.includes(userId);

  if (isLiked) {
    post.likes.pull(userId);
    post.likeCount -= 1;
  } else {
    post.likes.push(userId);
    post.likeCount += 1;
  }

  await post.save();

  return res
    .status(200)
    .json(
      new apiSuccess(
        200,
        isLiked ? "Post unliked successfully" : "Post liked successfully",
        { likeCount: post.likeCount },
        true
      )
    );
});

/**
 * @desc Increment share count
 */
const incrementShareCount = asyncHandler(async (req, res, next) => {
  const { postId } = req.params;

  const post = await Post.findById(postId);
  if (!post) return next(new apiError(404, "Post not found", null, false));

  post.shareCount += 1;
  await post.save();

  return res
    .status(200)
    .json(
      new apiSuccess(
        200,
        "Share count updated",
        { shareCount: post.shareCount },
        true
      )
    );
});

/**
 * @desc Get all posts
 */
const getAllPosts = asyncHandler(async (req, res, next) => {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit) || 10, 100);
  const skip = (page - 1) * limit;

  const totalPosts = await Post.countDocuments();

  const posts = await Post.find()
    .populate("author", "fullName email profilePicture")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

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

  return res.status(200).json(
    new apiSuccess(
      200,
      "Posts fetched successfully",
      {
        posts,
        pagination,
      },
      true
    )
  );
});

const getMyPosts = asyncHandler(async (req, res, next) => {
  let decodedData;
  try {
    decodedData = await decodeSessionToken(req);
  } catch (error) {
    return res.status(401).json(new apiError(401, "Unauthorized", null, false));
  }

  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit) || 10, 100);
  const skip = (page - 1) * limit;

  const userId = decodedData.userData.userId;

  const totalPosts = await Post.countDocuments({ author: userId });

  const myPosts = await Post.find({ author: userId })
    .populate("author", "fullName email profilePicture")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

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

  return res.status(200).json(
    new apiSuccess(
      200,
      "Posts fetched successfully",
      {
        myPosts,
        pagination,
      },
      true
    )
  );
});


module.exports = {
  createPost,
  toggleLikePost,
  incrementShareCount,
  getAllPosts,
  getMyPosts,
};
