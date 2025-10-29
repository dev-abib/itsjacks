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
  adminDeleteUser,
  getAllReports,
  getReportsAgainstUser,
  deleteReport,
  getAllPosts,
  deletePost,
  deleteDynamicPage,
  updateDynamicPage,
  getDynamicPageById,
  createDynamicPage,
  getAllDynamicPages,
  getDynamicPageBySlug,
} = require("../../Controller/admin.auth.controller");
const { authguard } = require("../../middleware/authGuard");
const { uploadImages } = require("../../middleware/multer.middleware");
const {
  getSingleuser,
  getUserAllPost,
} = require("../../Controller/user.controller");
const { adminAuthGuard } = require("../../middleware/adminAuthGuard");

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
router.route("/update/admin-pass").put(authguard, updateAdminPassword);

// update smtp settings

router.route("/update/social-site-data").put(authguard, updateSocialSiteData);

// get smtp settings
router.route("/get/social-site-data").get(authguard, getSocialSiteData);

// up insert company address
router.route("/upsert-company-data").put(authguard, upInseertCompanyAddress);

// get company address data
router.route("/get/company-data").get(authguard, getCompanyAddressData);

// update site settings data
router.route("/update/site-settings").put(authguard, updateSiteSettings);

// get site settings data
router.route("/get/site-settings").get(authguard, getSiteSettings);

// get single user
router.route("/get-user/:userId").get(adminAuthGuard, getSingleuser);

// get user all post
router.route("/get-user-all-post/:userId").get(adminAuthGuard, getUserAllPost);

// remove user
router.route("/remove-user/:userId").delete(adminAuthGuard, adminDeleteUser);

// get all reports
router.route("/reports").get(adminAuthGuard, getAllReports);

// get sinle users
router.route("/get-report/:userId").get(adminAuthGuard, getReportsAgainstUser);

// delete report
router.route("/delete-report/:id").delete(adminAuthGuard, deleteReport);

// get all posts
router.route("/get-all-posts-admin").get(adminAuthGuard, getAllPosts);

// delete a post
router.route("/delete-post/:postId").delete(adminAuthGuard, deletePost);

// Get all dynamic pages with search, sort, pagination
router.route("/dynamic-pages").get(adminAuthGuard, getAllDynamicPages);

// Create a new dynamic page
router.route("/dynamic-pages").post(adminAuthGuard, createDynamicPage);

// Get a single dynamic page by ID
router.route("/dynamic-pages/:pageId").get(adminAuthGuard, getDynamicPageById);

// Update a dynamic page
router.route("/dynamic-pages/:pageId").put(adminAuthGuard, updateDynamicPage);

// Delete a dynamic page
router.route("/dynamic-pages/:pageId").delete(adminAuthGuard, deleteDynamicPage);

// get dynamic content by slug
router.route("/dynamic-pages/slug/:slug").get(getDynamicPageBySlug);


module.exports = router; 
