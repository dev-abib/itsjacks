// external dependencies
const express = require("express");

const {
  loginAdminController,
  verifyAdmin,
  getAllUserData,
  updateAdminData,
  updateAdminPassword,
  updateSocialSiteData,
  getSocialSiteData,
  upInseertCompanyAddress,
  getCompanyAddressData,
  updateSiteSettings,
  getSiteSettings,
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

router
  .route("/update/admin")
  .put(authguard, uploadImages.single("profilePicture"), updateAdminData);

// update admin pass
router.route("/update/admin-pass").put(authguard,updateAdminPassword);

// update smtp settings

router.route("/update/social-site-data").put(authguard,updateSocialSiteData);

// get smtp settings
router.route("/get/social-site-data").get(authguard , getSocialSiteData);

// up insert company address
router.route("/upsert-company-data").put(authguard,upInseertCompanyAddress);

// get company address data
router.route("/get/company-data").get(authguard,getCompanyAddressData);

// update site settings data
router.route("/update/site-settings").put(authguard, updateSiteSettings);

router.route("/get/site-settings").get(authguard, getSiteSettings);

module.exports = router;
