// external dependencies
const express = require("express");
const {
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

// update user
router
  .route("/update-user")
  .put(authguard, uploadImages.single("profilePicture"), updateUser);

// get me
router.route("/get-me").get(authguard, getUserData);

// change password
router.route("/change-password").put(authguard, changePassword);

// verify email
router.route("/verify-email").post(verifyEmail);

// verify email
router.route("/verify-otp").post(verifyOtp);

router.route("/reset-pass").post(authguard, resetPassword);

router.route("/delete-acc").delete(authguard, deleteUserAccount);

router.route("/log-out").post(authguard, logoutUser);

module.exports = router;
