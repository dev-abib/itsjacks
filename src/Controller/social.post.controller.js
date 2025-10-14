const { Post } = require("../Schema/post.schema");
const { user } = require("../Schema/user.schema");
const { asyncHandler } = require("../Utils/asyncHandler");
const { apiError } = require("../Utils/api.error");
const { apiSuccess } = require("../Utils/api.success");
const { decodeSessionToken } = require("../Helpers/helper");
const { uploadCloudinary } = require("../Helpers/uploadCloudinary");
const webPush = require("web-push");

/**
 * @desc Create new post
 */
const createPost = asyncHandler(async (req, res, next) => {
  const { description, eventTime, postType } = req.body;
  const files = req.files;

  // Decode session token
  const decodedData = await decodeSessionToken(req);
  if (!decodedData) return next(new apiError(401, "Unauthorized", null, false));

  const role = decodedData?.userData?.role;

  // Validate post type
  if (!["community-post", "event"].includes(postType)) {
    return next(new apiError(400, "Invalid post type", null, false));
  }

  // Only creators can create events
  if (role !== "creator" && postType === "event") {
    return next(
      new apiError(400, "Only a creator can create an event post", null, false)
    );
  }

  // If post type is event, eventTime is required
  if (role === "creator" && postType === "event" && !eventTime) {
    return next(
      new apiError(
        400,
        "To create an event, you must provide an event time.",
        null,
        false
      )
    );
  }

  // Validate eventTime
  if (postType === "event" && isNaN(new Date(eventTime))) {
    return next(new apiError(400, "Invalid event time provided.", null, false));
  }

  // Validate file upload
  if (!files || files.length === 0) {
    return next(
      new apiError(400, "At least one image is required", null, false)
    );
  }

  // Handle image upload to Cloudinary
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

  // Create post in the database
  const newPost = await Post.create({
    description,
    images: uploadedImages,
    author: decodedData.userData.userId,
    eventTime: eventTime ? new Date(eventTime) : null,
    postType: postType,
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

  // Find the post by ID
  const post = await Post.findById(postId).populate("author"); 

  if (!post) return next(new apiError(404, "Post not found", null, false));

  const isLiked = post.likes.includes(userId);

  // Get the post owner's ID to send the notification to
  const postOwnerId = post.author._id; 

  if (isLiked) {
    // If already liked, unlike the post
    post.likes.pull(userId);
    post.likeCount -= 1;
  } else {
    // If not liked, like the post
    post.likes.push(userId);
    post.likeCount += 1;
  }

  // Save the updated post
  await post.save();

  // If the user is liking the post, send a notification to the post owner
  if (!isLiked) {
    // Find the post owner
    const postOwner = await user.findById(postOwnerId); // Fetch the post owner to send the notification
    if (postOwner && postOwner.notificationToken) {
      const payload = JSON.stringify({
        title: "Post Liked",
        message: `${decodedData.userData.fullName} liked your post!`,
        url: `/posts/${postId}`,
      });

      try {
        // Send notification to the post owner
        await webPush.sendNotification(postOwner.notificationToken, payload);
        console.log(`Notification sent to user ${postOwnerId}`);
      } catch (error) {
        console.error(
          `Failed to send notification to user ${postOwnerId}:`,
          error
        );
      }
    }
  }

  // Send the response to the client
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

  // Count only community-posts
  const totalPosts = await Post.countDocuments({ postType: "community-post" });

  // Fetch only community-posts
  const posts = await Post.find({ postType: "community-post" })
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
    return next(new apiError(401, "Unauthorized", null, false));
  }

  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit) || 10, 100);
  const skip = (page - 1) * limit;

  const userId = decodedData.userData.userId;

  const totalPosts = await Post.countDocuments({
    author: userId,
    postType: "community-post",
  });

  const myPosts = await Post.find({
    author: userId,
    postType: "community-post",
  })
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

const rateEvent = asyncHandler(async (req, res, next) => {
  let decodedData;
  const { rating } = req.body;
  const { id } = req.params;

  // Check if the rating is provided and valid
  if (!rating || !["1", "2", "3", "4", "5"].includes(rating)) {
    return next(
      new apiError(400, "Rating must be between 1 and 5", null, false)
    );
  }

  try {
    decodedData = await decodeSessionToken(req);
  } catch (error) {
    return res.status(401).json(new apiError(401, "Unauthorized", null, false));
  }

  // Find the event (Post) by ID
  const post = await Post.findById(id);

  if (!post) {
    return next(new apiError(400, "No event found with this ID", null, false));
  }

  if (post.postType !== "event") {
    return next(
      new apiError(400, "Selected post is not an event.", null, false)
    );
  }

  // Check if event has already happened
  const now = new Date();
  if (now < post.createdAt) {
    return next(
      new apiError(
        400,
        "You can only rate an event after it has started.",
        null,
        false
      )
    );
  }

  // Check if the user has already rated this event
  const existingRatingIndex = post.ratingInfo.findIndex(
    (ratingObj) =>
      ratingObj.user.toString() === decodedData.userData.userId.toString()
  );

  if (existingRatingIndex > -1) {
    // Update existing rating
    post.ratingInfo[existingRatingIndex].rating = rating;
  } else {
    // Add new rating
    post.ratingInfo.push({
      user: decodedData.userData.userId,
      rating,
    });
  }

  // Recalculate approximate rating (average)
  const totalRatings = post.ratingInfo.length;
  const sumRatings = post.ratingInfo.reduce(
    (sum, ratingObj) => sum + parseInt(ratingObj.rating),
    0
  );
  post.approxRating = sumRatings / totalRatings;

  // Save updated post
  await post.save();

  return res
    .status(200)
    .json(new apiSuccess(200, "Rating added successfully", post, true));
});

const getEvents = asyncHandler(async (req, res, next) => {
  let decodedData;
  const { isOld } = req.query;
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit) || 10, 100);
  const skip = (page - 1) * limit;

  try {
    decodedData = await decodeSessionToken(req);
  } catch (error) {
    return next(new apiError(401, "Unauthorized", null, false));
  }

  const now = new Date();

  let filter = { postType: "event" };

  if (isOld === "true") {
    filter.createdAt = { $gt: now };
  } else if (isOld === "false") {
    filter.createdAt = { $lte: now };
  }

  const totalPosts = await Post.countDocuments(filter);

  const events = await Post.find(filter)
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

  return res
    .status(200)
    .json(
      new apiSuccess(
        200,
        "Events fetched successfully",
        { events, pagination },
        true
      )
    );
});

const getMyEvents = asyncHandler(async (req, res, next) => {
  let decodedData;
  try {
    decodedData = await decodeSessionToken(req);
  } catch (error) {
    return next(new apiError(401, "Unauthorized", null, false));
  }

  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit) || 10, 100);
  const skip = (page - 1) * limit;

  const userId = decodedData.userData.userId;

  // Count total number of events
  const totalPosts = await Post.countDocuments({
    author: userId,
    postType: "event",
  });

  // Fetch the actual posts (events)
  const myPosts = await Post.find({
    author: userId,
    postType: "event",
  })
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
      "Events fetched successfully",
      {
        myPosts,
        pagination,
      },
      true
    )
  );
});

const saveEventTime = asyncHandler(async (req, res, next) => {
  let decodedData;
  try {
    decodedData = await decodeSessionToken(req);
  } catch (error) {
    return next(new apiError(401, "Unauthorized", null, false));
  }

  const { eventId } = req.params;
  const userId = decodedData.userData.userId;

  // Find the event by ID
  const updatedEvent = await Post.findById(eventId);
  if (!updatedEvent) {
    return next(new apiError(404, "Event not found", null, false));
  }

  // Use $addToSet to prevent duplicates in savedBy array
  const result = await Post.findByIdAndUpdate(
    eventId,
    { $addToSet: { savedBy: userId } },
    { new: true }
  );

  if (!result) {
    return next(new apiError(500, "Error saving the event", null, false));
  }

  return res
    .status(200)
    .json(
      new apiSuccess(
        200,
        "Successfully added event to your calendar",
        { result },
        true
      )
    );
});

const getMySavedEventTime = asyncHandler(async (req, res, next) => {
  let decodedData;
  try {
    decodedData = await decodeSessionToken(req);
  } catch (error) {
    return next(new apiError(401, "Unauthorized", null, false));
  }

  const userId = decodedData.userData.userId;

  const savedEvents = await Post.find({ savedBy: userId }).select("eventTime");

  if (!savedEvents.length) {
    return next(new apiError(404, "no saved events currently", null, false));
  }

  const eventDates = savedEvents.map((event) => ({
    eventDate: event.eventTime.toISOString().split("T")[0],
  }));


  res
    .status(200)
    .json(
      new apiSuccess(
        200,
        "All event dates retrive successfully",
        eventDates,
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
  rateEvent,
  getEvents,
  getMyEvents,
  saveEventTime,
  getMySavedEventTime,

};
