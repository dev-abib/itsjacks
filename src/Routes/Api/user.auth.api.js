// external dependencies
const express = require("express");
const {
  registerUserController,
  loginUserController,
  getUserData,
  changePassword,
  verifyEmail,
} = require("../../Controller/user.controller");
const { uploadImages } = require("../../middleware/multer.middleware");
const { authguard } = require("../../middleware/authGuard");

// extracting router from express
const { Router } = express;
const router = Router();

//  register user
router
  .route("/register")
  .post(uploadImages.single("profilePicture"), registerUserController);

// login user
router.route("/login").post(loginUserController);

// get me
router.route("/get-me").get(authguard, getUserData);

// change password
router.route("/change-password").put(authguard, changePassword);

// verify email
router.route("/verify-email").post(verifyEmail)

module.exports = router;
