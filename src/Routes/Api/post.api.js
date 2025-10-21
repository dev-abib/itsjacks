const express = require("express");
const { authguard } = require("../../middleware/authGuard");
const { uploadImages } = require("../../middleware/multer.middleware");

const {
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
} = require("../../Controller/social.post.controller");

const router = express.Router();

// Create post (multiple images allowed)
router
  .route("/create-post")
  .post(authguard, uploadImages.array("images", 5), createPost);

// Create post (multiple images allowed)
router.route("/delete-post/:postId").delete(authguard, deletePostEvent);

// Like / Unlike post
router.route("/:postId/like-unlike").put(authguard, toggleLikePost);

// Increment share count
router.route("/:postId/share-count").put(authguard, incrementShareCount);

// Get all posts
router.route("/get-all-posts").get(authguard, getAllPosts);

// get my posts
router.route("/get-my-posts").get(authguard, getMyPosts);

// rate event
router.route("/rate-event/:id").post(authguard, rateEvent);

// save event time
router.route("/save-event-time/:eventId").post(authguard, saveEventTime);

// get all events
router.route("/get-all-events").get(authguard, getEvents);

// get my events
router.route("/get-my-events").get(authguard, getMyEvents);

// get my saved events
router.route("/get-my-saved-events").get(authguard, getMySavedEventTime);

// update post/events
router
  .route("/update-event/:postId")
  .put(authguard, uploadImages.array("images", 5), updatePostEvent);

// get my notifications
router.route("/get-notifications").get(authguard, getNotification);

module.exports = router;
