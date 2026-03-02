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
const { report } = require("../Schema/report.post.schem");

/**
 * @desc Create new post
 */
const createPost = asyncHandler(async (req, res, next) => {
  const { description, eventTime, postType, category } = req.body;
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

  if (!category) {
    return next(new apiError(400, "Category filed is required", null, false));
  }

  if (
    !["greek life", "local business", "student clubs", "sport"].includes(
      category
    )
  ) {
    return next(new apiError(400, "Invalid post type", null, false));
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
    category,
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

  // Find the post and its author
  const post = await Post.findById(postId).populate("author");
  if (!post) return next(new apiError(404, "Post not found", null, false));

  const isLiked = post.likes.includes(userId);
  const likedUser = await user.findById(userId);
  if (!likedUser) return next(new apiError(404, "User not found", null, false));

  const postOwnerId = post.author._id;

  if (isLiked) {
    post.likes.pull(userId);
    post.likeCount -= 1;
  } else {
    post.likes.push(userId);
    post.likeCount += 1;

    // Only notify if user is not liking their own post
    if (postOwnerId.toString() !== userId.toString()) {
      // Save notification in DB
      const notification = new Notification({
        user: postOwnerId,
        message: `${likedUser.fullName} liked your post: "${post.description}"`,
        type: "like",
        post: postId,
      });
      await notification.save();

      // Send push via Firebase
      const postOwner = await user.findById(postOwnerId);
      if (postOwner?.fcmToken) {
        await sendFirebaseNotification(
          postOwner.fcmToken,
          "New Like!",
          `${likedUser.fullName} liked your post.`,
          { type: "like", postId }
        );
      }
    }
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
  const { rating } = req.body;
  const { id } = req.params;

  // Validate rating
  if (!rating || isNaN(rating) || rating < 1 || rating > 5) {
    return next(
      new apiError(400, "Rating must be a number between 1 and 5", null, false)
    );
  }

  // Decode session token
  try {
    decodedData = await decodeSessionToken(req);
  } catch (error) {
    return next(new apiError(401, "Unauthorized", null, false));
  }

  const userId = decodedData.userData.userId;

  // Find the event
  const post = await Post.findById(id).populate("author");
  if (!post)
    return next(new apiError(400, "No event found with this ID", null, false));
  if (post.postType !== "event")
    return next(
      new apiError(400, "Selected post is not an event.", null, false)
    );

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

  // Check if the user has already rated
  const existingRatingIndex = post.ratingInfo.findIndex(
    (r) => r.user.toString() === userId.toString()
  );

  if (existingRatingIndex > -1) {
    return next(
      new apiError(400, "You've already rated this event", null, false)
    );
  }

  // Add new rating
  post.ratingInfo.push({ user: userId, rating });

  // Recalculate average rating
  const totalRatings = post.ratingInfo.length;
  const sumRatings = post.ratingInfo.reduce(
    (sum, r) => sum + parseFloat(r.rating),
    0
  );
  post.approxRating = sumRatings / totalRatings;

  // Save updated post
  await post.save();

  // Create notification in DB
  const User = await user.findById(userId); // user who rated
  const postOwnerId = post.author._id;

  const notification = new Notification({
    user: postOwnerId,
    message: `${User.fullName} rated your event "${post.description}" with a rating of ${rating}.`,
    type: "rating",
    post: id,
  });

  await notification.save();

  // Send Firebase push notification
  if (post.author.fcmToken) {
    try {
      await sendFirebaseNotification(
        post.author.fcmToken,
        "Event Rated",
        `${User.fullName} rated your event "${post.description}" with a rating of ${rating}.`,
        { type: "rating", postId: post._id }
      );
    } catch (err) {
      console.error("Firebase notification error:", err);
    }
  }

  return res
    .status(200)
    .json(new apiSuccess(200, "Rating added successfully", post, true));
});

// get events controller
const getEvents = asyncHandler(async (req, res, next) => {
  let decodedData;
  const { isOld, category } = req.query;
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

  // Base filter for events
  let filter = { postType: "event" };

  // Filter by old/upcoming events
  if (isOld === "true") {
    filter.eventTime = { $lte: now };
  } else if (isOld === "false") {
    filter.eventTime = { $gt: now };
  }

  // Filter by category if provided
  if (category) {
    filter.category = category;
  }

  const totalPosts = await Post.countDocuments(filter);

  const events = await Post.find(filter)
    .populate("author", "fullName email profilePicture")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const eventsWithLikeStatus = events.map((event) => {
    const isLiked = event.likes.includes(userId);
    const isRated = event.ratingInfo.some(
      (rating) => rating.user.toString() === userId.toString()
    );
    const isSaved = event.savedBy.includes(userId);

    return {
      ...event.toObject(),
      isLiked,
      isRated,
      isSaved,
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
    const isRated = event.ratingInfo.some(
      (rating) => rating.user.toString() === userId.toString()
    );
    const isSaved = event.savedBy.includes(userId);
    const isLiked = likedByUser ? true : false;

    return {
      ...event.toObject(),
      isLiked,
      isRated,
      isSaved,
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

// get events by user id
const getEventsById = asyncHandler(async (req, res, next) => {
  const { userId } = req.params;

  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit) || 10, 100);
  const skip = (page - 1) * limit;

  // Count total number of events
  const totalPosts = await Post.countDocuments({
    author: userId,
    postType: "event",
  });

  const author = await user
    .findById(userId)
    .select("fullName email profilePicture creator_rating");

  // Fetch the actual posts (events)
  const myPosts = await Post.find({
    author: userId,
    postType: "event",
  })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const myPostsWithLikeStatus = myPosts.map((event) => {
    const likedByUser = event.likes.includes(userId);
    const isRated = event.ratingInfo.some(
      (rating) => rating.user.toString() === userId.toString()
    );
    const isSaved = event.savedBy.includes(userId);
    const isLiked = likedByUser ? true : false;

    return {
      ...event.toObject(),
      isLiked,
      isRated,
      isSaved,
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
        author,
        allEvents: myPostsWithLikeStatus,
        pagination,
      },
      true
    )
  );
});

// save event controller
const saveEventTime = asyncHandler(async (req, res, next) => {
  const decodedData = await decodeSessionToken(req);
  if (!decodedData) return next(new apiError(401, "Unauthorized", null, false));

  const { eventId } = req.params;
  const userId = decodedData.userData.userId;

  const event = await Post.findById(eventId).populate("author");
  if (!event) return next(new apiError(404, "Event not found", null, false));

  const alreadySaved = event.savedBy.includes(userId);
  if (alreadySaved) {
    return res
      .status(200)
      .json(new apiSuccess(200, "Event already saved", { event }, true));
  }

  const updatedEvent = await Post.findByIdAndUpdate(
    eventId,
    { $addToSet: { savedBy: userId }, $inc: { saveCount: 1 } },
    { new: true }
  );

  // Notify event creator if it's not the same user
  const eventOwnerId = event.author._id;
  if (eventOwnerId.toString() !== userId.toString()) {
    const savedUser = await user.findById(userId);

    // Save notification
    const notification = new Notification({
      user: eventOwnerId,
      message: `${savedUser.fullName} saved your event: "${event.description}"`,
      type: "event-reminder",
      post: eventId,
    });
    await notification.save();

    // Send Firebase push
    const eventOwner = await user.findById(eventOwnerId);
    if (eventOwner?.fcmToken) {
      await sendFirebaseNotification(
        eventOwner.fcmToken,
        "Event Saved!",
        `${savedUser.fullName} saved your event.`,
        { type: "event-reminder", postId: eventId }
      );
    }
  }

  return res
    .status(200)
    .json(
      new apiSuccess(
        200,
        "Successfully added event to your calendar",
        { updatedEvent },
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
  const { date } = req.body;

  if (!date) {
    return next(new apiError(400, "Please provide a date", null, false));
  }

  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit) || 10, 100);
  const skip = (page - 1) * limit;

  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  // Fetch all events on this date (don't filter by savedBy)
  const totalPosts = await Post.countDocuments({
    postType: "event",
    eventTime: { $gte: startOfDay, $lte: endOfDay },
  });

  const events = await Post.find({
    postType: "event",
    eventTime: { $gte: startOfDay, $lte: endOfDay },
  })
    .populate("author", "fullName email profilePicture")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  if (!events.length) {
    return next(new apiError(404, "No events found on this date", null, false));
  }

  // Add isSaved property based on whether user has saved the event
  const eventsWithIsSaved = events.map((event) => ({
    ...event.toObject(),
    isSaved: event.savedBy.includes(userId),
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

  res
    .status(200)
    .json(
      new apiSuccess(
        200,
        "Events retrieved successfully",
        { events: eventsWithIsSaved, pagination },
        true
      )
    );
});

// delete post / event
const deletePostEvent = asyncHandler(async (req, res, next) => {
  const decodedData = await decodeSessionToken(req);
  if (!decodedData) return next(new apiError(401, "Unauthorized", null, false));

  const { userId } = decodedData?.userData;
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
    return next(new apiError(401, "You can't delete this post", null, false));
  }

  // If the post has images, delete them from Cloudinary
  if (isExistedPost.images && isExistedPost.images.length > 0) {
    try {
      for (const imageUrl of isExistedPost.images) {
        const result = await deleteCloudinaryAsset(imageUrl);
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
  const {
    description,
    eventTime,
    postType,
    category,
    deleteImages = [],
  } = req.body;
  const files = req.files;

  const decodedData = await decodeSessionToken(req);
  if (!decodedData) return next(new apiError(401, "Unauthorized", null, false));

  const { role, userId } = decodedData?.userData;
  const { postId } = req.params;

  // Parse deleteImages if string
  let deleteImagesArray = deleteImages;
  if (typeof deleteImages === "string") {
    try {
      deleteImagesArray = JSON.parse(deleteImages);
    } catch (err) {
      return next(
        new apiError(400, "Invalid deleteImages format", null, false)
      );
    }
  }

  // Find the post
  const isExistedPost = await Post.findById(postId);
  if (!isExistedPost)
    return next(new apiError(404, "Post not found", null, false));

  // Validate ObjectId
  if (!ObjectId.isValid(isExistedPost.author) || !ObjectId.isValid(userId)) {
    return next(new apiError(400, "Invalid ObjectId format", null, false));
  }

  // Permission check
  if (isExistedPost.author.toString() !== userId.toString()) {
    return next(new apiError(401, "You can't update this post", null, false));
  }

  // Validate postType
  if (postType && !["community-post", "event"].includes(postType)) {
    return next(new apiError(400, "Invalid post type", null, false));
  }
  if (role !== "creator" && postType === "event") {
    return next(
      new apiError(400, "Only a creator can update an event post", null, false)
    );
  }

  // Handle event time
  if (postType === "event") {
    const parsedEventTime = new Date(eventTime);
    if (isNaN(parsedEventTime))
      return next(
        new apiError(400, "Invalid event time provided.", null, false)
      );
    isExistedPost.eventTime = parsedEventTime;
  } else {
    isExistedPost.eventTime = null;
  }

  let updatedImages = [...(isExistedPost.images || [])];

  // Delete selected images from Cloudinary
  if (Array.isArray(deleteImagesArray) && deleteImagesArray.length > 0) {
    try {
      for (const imageUrl of deleteImagesArray) {
        // Reuse your helper: deleteCloudinaryAsset expects full URL
        const result = await deleteCloudinaryAsset(imageUrl);
        // Remove from local images array
        updatedImages = updatedImages.filter((img) => img !== imageUrl);
      }
    } catch (err) {
      console.error("Error deleting images from Cloudinary:", err);
      return next(
        new apiError(500, "Failed to delete old images", null, false)
      );
    }
  }

  // Upload new files
  if (files && files.length > 0) {
    try {
      for (const file of files) {
        const uploadResult = await uploadCloudinary(file.buffer, "postImages");
        if (uploadResult?.secure_url)
          updatedImages.push(uploadResult.secure_url);
      }
    } catch (err) {
      console.error("Cloudinary upload error:", err);
      return next(
        new apiError(500, "Failed to upload new images", null, false)
      );
    }
  }

  // Ensure at least one image remains
  if (updatedImages.length === 0) {
    return next(
      new apiError(
        400,
        "At least one image is required for the post",
        null,
        false
      )
    );
  }

  // Update post
  isExistedPost.description = description || isExistedPost.description;
  isExistedPost.postType = postType || isExistedPost.postType;
  isExistedPost.category = category || isExistedPost.category;
  isExistedPost.images = updatedImages;

  const updatedPost = await isExistedPost.save();
  console.log("Updated post:", updatedPost);

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

// get single posts
const getSinglePost = asyncHandler(async (req, res, next) => {
  const { postId } = req.params;
  const decodedData = await decodeSessionToken(req);

  if (!decodedData) return next(new apiError(401, "Unauthorized", null, false));

  const { userId } = decodedData.userData;

  // Find the post by postId and populate the author field with the user data
  const isExistedPost = await Post.findById(postId).populate(
    "author",
    "fullName email role profilePicture creator_rating"
  );

  // If post doesn't exist, return an error
  if (!isExistedPost) {
    return next(new apiError(404, "Post doesn't exist", null, false));
  }

  // Check if the post has been liked by the user
  const likedByUser = isExistedPost.likes.includes(userId);
  const isRated = isExistedPost.ratingInfo.some(
    (rating) => rating.user.toString() === userId.toString()
  );

  // Add the isLiked status to the post data
  const postWithLikeStatus = {
    ...isExistedPost.toObject(),
    isLiked: likedByUser,
    isRated,
  };

  return res
    .status(200)
    .json(
      new apiSuccess(
        200,
        "Single post fetched successfully",
        postWithLikeStatus,
        true
      )
    );
});

// remove saved controller
const removeSavedEvent = asyncHandler(async (req, res, next) => {
  let decodedData;
  try {
    decodedData = await decodeSessionToken(req);
  } catch (error) {
    return next(new apiError(401, "Unauthorized", null, false));
  }
  const userId = decodedData.userData.userId;
  const { eventId } = req.params;

  const isExistedEvent = await Post.findById(eventId);

  if (!isExistedEvent) {
    return next(new apiError(404, "Event not found", null, false));
  }

  if (isExistedEvent.postType !== "event") {
    return next(new apiError(400, "This is not a event"));
  }

  const isSaved = isExistedEvent.savedBy.includes(userId);

  if (!isSaved) {
    return next(
      new apiError(400, `You haven't saved the event yet`, null, false)
    );
  }

  isExistedEvent.savedBy.pull(userId);

  await isExistedEvent.save();

  return res
    .status(200)
    .json(new apiSuccess(200, "Event removed from saved list", null, true));
});

// report post controller
const reportPostController = asyncHandler(async (req, res, next) => {
  const decodedData = await decodeSessionToken(req);

  if (!decodedData) return next(new apiError(401, "Unauthorized", null, false));

  const { userId } = decodedData.userData;
  const { reasons } = req.body;

  const { postId } = req.params;

  if (!postId) {
    return next(new apiError(400, "post id is required", null, false));
  }

  if (!reasons) {
    return next(new apiError(400, "Report reasons is required", null, false));
  }

  const reportPost = new report({
    postId: postId,
    senderId: userId,
    reasons: reasons,
  });

  const isSAvedReport = await reportPost.save();

  if (!isSAvedReport) {
    return next(
      new apiError(500, "Something went wrong , try again later", null, false)
    );
  }

  return res
    .status(200)
    .json(new apiSuccess(200, "Report submitted successfully", null, true));
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
  getSinglePost,
  removeSavedEvent,
  reportPostController,
  getEventsById,
};
