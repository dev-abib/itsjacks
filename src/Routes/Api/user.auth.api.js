// external dependencies
const express = require("express");
const {
  registerUserController,
  loginUserController,
} = require("../../Controller/user.controller");
const { uploadImages } = require("../../middleware/multer.middleware");

// extracting router from express
const { Router } = express;
const router = Router();

//  register user
router
  .route("/register")
  .post(uploadImages.single("profilePicture"), registerUserController);

// login user
router.route("/login").post(loginUserController);

// get admin

module.exports = router;
