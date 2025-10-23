const { Post } = require("../Schema/post.schema");
const { user } = require("../Schema/user.schema");
const { asyncHandler } = require("../Utils/asyncHandler");
const { apiError } = require("../Utils/api.error");
const { apiSuccess } = require("../Utils/api.success");
const { decodeSessionToken } = require("../Helpers/helper");
const {
  uploadCloudinary,
  deleteCloudinaryAsset,
} = require("../Helpers/uploadCloudinary");
const { ObjectId } = require("mongodb");
const { Notification } = require("../Schema/notification.schema");

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

  // Find the post by ID, populate the author's data
  const post = await Post.findById(postId).populate("author");
  if (!post) return next(new apiError(404, "Post not found", null, false));

  const isLiked = post.likes.includes(userId);

  const likedUser = await user.findById(userId);
  if (!likedUser) return next(new apiError(404, "User not found", null, false));

  // Get the post owner's ID to send the notification to
  const postOwnerId = post.author._id;

  if (isLiked) {
    post.likes.pull(userId); // Remove the like
    post.likeCount -= 1;
  } else {
    post.likes.push(userId); // Add the like
    post.likeCount += 1;

    // Create the like notification
    const notification = new Notification({
      user: postOwnerId, // The user who will receive the notification
      message: `${likedUser.fullName} liked your post: ${post.description}`,
      type: "like",
      post: postId,
    });

    await notification.save();

    // Emit the notification to the post owner via Socket.IO
    if (req.io && req.io.users && req.io.users[postOwnerId]) {
      const userSocketId = req.io.users[postOwnerId];
      req.io.to(userSocketId).emit("notification", notification.message);
    }
  }

  // Save the updated post
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
  const decodedData = await decodeSessionToken(req);
  if (!decodedData) return next(new apiError(401, "Unauthorized", null, false));

  const userId = decodedData.userData.userId;

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

  const postsWithLikeStatus = posts.map((post) => {
    const likedByUser = post.likes.includes(userId);
    const isLiked = likedByUser ? true : false;

    return {
      ...post.toObject(),
      isLiked,
    };
  });

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
        posts: postsWithLikeStatus,
        pagination,
      },
      true
    )
  );
});

// get my posts controller
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

  // Add `isLiked` field to each post to indicate if the user liked the post
  const myPostsWithLikeStatus = myPosts.map((post) => {
    const likedByUser = post.likes.includes(userId); // Check if user has liked the post
    const isLiked = likedByUser ? true : false; // Define isLiked

    return {
      ...post.toObject(),
      isLiked,
    };
  });

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
        myPosts: myPostsWithLikeStatus,
        pagination,
      },
      true
    )
  );
});

// rate event controller
const rateEvent = asyncHandler(async (req, res, next) => {
  let decodedData;
  const { rating } = req.body; // Rating can be a decimal like 4.1, 4.5, etc.
  const { id } = req.params;

  // Validate the rating input to allow decimal numbers between 1 and 5
  if (!rating || isNaN(rating) || rating < 1 || rating > 5) {
    return next(
      new apiError(400, "Rating must be a number between 1 and 5", null, false)
    );
  }

  // Decode session token to get the user ID
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

  // Check if the event has started
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

  // Check if the user has already rated the event
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

  // Recalculate the approximate rating (average) considering decimal values
  const totalRatings = post.ratingInfo.length;
  const sumRatings = post.ratingInfo.reduce(
    (sum, ratingObj) => sum + parseFloat(ratingObj.rating), // Ensure we're using floating-point values
    0
  );
  post.approxRating = sumRatings / totalRatings;

  // Save the updated post
  await post.save();

  // Create the rate event notification
  const postOwnerId = post.author._id;
  const User = await user.findById(decodedData.userData.userId);

  const notification = new Notification({
    user: postOwnerId,
    message: `${User.fullName} rated your event "${post.description}" with a rating of ${rating}.`,
    type: "rating",
    post: id,
  });

  await notification.save();

  // Emit the notification to the post owner using Socket.IO
  if (req.io && req.io.users && req.io.users[postOwnerId]) {
    const userSocketId = req.io.users[postOwnerId];
    req.io.to(userSocketId).emit("notification", notification.message);
  }

  // Return success response
  return res
    .status(200)
    .json(new apiSuccess(200, "Rating added successfully", post, true));
});


// get events controller
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

  const userId = decodedData.userData.userId;
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

  const eventsWithLikeStatus = events.map((event) => {
    const likedByUser = event.likes.includes(userId);
    const isLiked = likedByUser ? true : false;

    return {
      ...event.toObject(),
      isLiked,
    };
  });

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
        { events: eventsWithLikeStatus, pagination },
        true
      )
    );
});

// get my events controller
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

  const myPostsWithLikeStatus = myPosts.map((event) => {
    const likedByUser = event.likes.includes(userId);
    const isLiked = likedByUser ? true : false;

    return {
      ...event.toObject(),
      isLiked, // Add the isLiked field
    };
  });

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
        myPosts: myPostsWithLikeStatus,
        pagination,
      },
      true
    )
  );
});

// save event controller
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

// get my saved event time controller
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

// delete post / event
const deletePostEvent = asyncHandler(async (req, res, next) => {
  const decodedData = await decodeSessionToken(req);
  if (!decodedData) return next(new apiError(401, "Unauthorized", null, false));

  const { role, userId } = decodedData?.userData;
  const { postId } = req.params;

  // Find the post in the database
  const isExistedPost = await Post.findById(postId);
  if (!isExistedPost) {
    return next(new apiError(404, "Post not found", null, false));
  }

  // Validate ObjectId format
  if (!ObjectId.isValid(isExistedPost.author) || !ObjectId.isValid(userId)) {
    return next(new apiError(400, "Invalid ObjectId format", null, false));
  }

  // Check if the post author is the same as the user trying to delete it
  if (isExistedPost.author.toString() !== userId.toString()) {
    console.log(isExistedPost.author, userId, "let's match it");
    return next(new apiError(401, "You can't delete this post", null, false));
  }

  // If the post has images, delete them from Cloudinary
  if (isExistedPost.images && isExistedPost.images.length > 0) {
    try {
      for (const imageUrl of isExistedPost.images) {
        const result = await deleteCloudinaryAsset(imageUrl);
        console.log("Image deleted from Cloudinary:", result);
      }
    } catch (err) {
      console.error("Failed to delete images from Cloudinary:", err);
      return next(
        new apiError(500, "Failed to delete post images", null, false)
      );
    }
  }

  // Delete the post from the database
  await Post.findByIdAndDelete(postId);

  // Return success response
  return res
    .status(200)
    .json(new apiSuccess(200, "Post deleted successfully", null, true));
});

// update post / event
const updatePostEvent = asyncHandler(async (req, res, next) => {
  const { description, eventTime, postType } = req.body;
  const files = req.files;

  // Decode session token
  const decodedData = await decodeSessionToken(req);
  if (!decodedData) return next(new apiError(401, "Unauthorized", null, false));

  const { role, userId } = decodedData?.userData;
  const { postId } = req.params;

  // Find the post in the database
  const isExistedPost = await Post.findById(postId);
  if (!isExistedPost) {
    return next(new apiError(404, "Post not found", null, false));
  }

  // Validate ObjectId format
  if (!ObjectId.isValid(isExistedPost.author) || !ObjectId.isValid(userId)) {
    return next(new apiError(400, "Invalid ObjectId format", null, false));
  }

  // Check if the post author is the same as the user trying to update it
  if (isExistedPost.author.toString() !== userId.toString()) {
    return next(new apiError(401, "You can't update this post", null, false));
  }

  if (postType) {
    // Validate post type
    if (!["community-post", "event"].includes(postType)) {
      return next(new apiError(400, "Invalid post type", null, false));
    }
  }

  // Only creators can update event posts
  if (role !== "creator" && postType === "event") {
    return next(
      new apiError(400, "Only a creator can update an event post", null, false)
    );
  }

  // Validate eventTime
  if (postType === "event") {
    const parsedEventTime = new Date(eventTime);
    if (isNaN(parsedEventTime)) {
      return next(
        new apiError(400, "Invalid event time provided.", null, false)
      );
    }
    isExistedPost.eventTime = parsedEventTime;
  } else {
    isExistedPost.eventTime = null;
  }

  // Handle image upload to Cloudinary (if any new images are uploaded)
  let uploadedImages = isExistedPost.images || [];
  const oldImages = isExistedPost.images || [];

  // If new files are uploaded, delete old images from Cloudinary and update the database
  if (files && files.length > 0) {
    try {
      // First, delete old images from Cloudinary
      for (const imageUrl of oldImages) {
        const result = await deleteCloudinaryAsset(imageUrl);
        console.log("Old image deleted from Cloudinary:", result);

        // Rebuild the images array without the deleted image
        uploadedImages = uploadedImages.filter((image) => image !== imageUrl);
      }

      // Upload new images to Cloudinary
      for (const file of files) {
        const uploadResult = await uploadCloudinary(file.buffer, "postImages");
        if (uploadResult?.secure_url) {
          uploadedImages.push(uploadResult.secure_url);
        }
      }
    } catch (err) {
      console.error("Cloudinary upload error:", err);
      return next(
        new apiError(500, "Failed to upload post images", null, false)
      );
    }
  }

  if (uploadedImages.length === 0 && oldImages.length === 0) {
    return next(
      new apiError(400, "At least one image is required", null, false)
    );
  }

  isExistedPost.description = description || isExistedPost.description;
  isExistedPost.postType = postType || isExistedPost.postType;
  isExistedPost.images = uploadedImages.length > 0 ? uploadedImages : oldImages;

  // Save the post with the updated images
  const updatedPost = await isExistedPost.save();

  if (!updatedPost) {
    return next(new apiError(500, "Failed to update post", null, false));
  }

  return res
    .status(200)
    .json(new apiSuccess(200, "Post updated successfully", updatedPost, true));
});

// get notification controller
const getNotification = asyncHandler(async (req, res, next) => {
  const decodedData = await decodeSessionToken(req);
  if (!decodedData) return next(new apiError(401, "Unauthorized", null, false));

  const { userId } = decodedData.userData;

  try {
    const notifications = await Notification.find({ user: userId })
      .populate("post", "description")
      .sort({ createdAt: -1 });

    if (!notifications) {
      return next(new apiError(404, "No notifications found", null, false));
    }

    return res
      .status(200)
      .json(
        new apiSuccess(
          200,
          "Notifications fetched successfully",
          notifications,
          true
        )
      );
  } catch (error) {
    return next(new apiError(500, "Internal Server Error", null, false));
  }
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
  deletePostEvent,
  updatePostEvent,
  getNotification,
};
