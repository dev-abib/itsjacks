const express = require("express");
const { authguard } = require("../../middleware/authGuard");
const { uploadImages } = require("../../middleware/multer.middleware");


const {
  createPost,
  toggleLikePost,
  incrementShareCount,
  getAllPosts,
} = require("../../Controller/social.post.controller");



const router = express.Router();

// Create post (multiple images allowed)
router
  .route("/create-post")
  .post(authguard, uploadImages.array("images", 5), createPost);

// Like / Unlike post
router.route("/:postId/like-unlike").put(authguard, toggleLikePost);

// Increment share count
router.route("/:postId/share-count").put(authguard, incrementShareCount);

// Get all posts
router.route("/get-all-posts").get(authguard, getAllPosts);

module.exports = router;
