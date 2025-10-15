// external dependencies
const express = require("express");

const {
  loginAdminController,
  verifyAdmin,
  getAllUserData,
  updateAdminData,
  updateAdminPassword,
} = require("../../Controller/admin.auth.controller");
const { authguard } = require("../../middleware/authGuard");
const { uploadImages } = require("../../middleware/multer.middleware");

// extracting router from express
const { Router } = express;
const router = Router();

// login admin
router.route("/admin-login").post(loginAdminController);

// get admin
router.route("/get/admin").get(verifyAdmin);

// get all existing user
router.route("/get-all-user-data").get(authguard, getAllUserData);

// update admin data 
// update admin
router
  .route("/update/admin")
  .put(authguard, uploadImages.single("profilePicture"), updateAdminData);

  router.route("/update/admin-pass").put(updateAdminPassword);


module.exports = router;
