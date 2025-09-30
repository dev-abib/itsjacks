// external dependencies
const express = require("express");

const {
  loginAdminController,
  verifyAdmin,
  getAllUserData,
} = require("../../Controller/admin.auth.controller");
const { authguard } = require("../../middleware/authGuard");

// extracting router from express
const { Router } = express;
const router = Router();

// login admin
router.route("/admin-login").post(loginAdminController);

// get admin
router.route("/get/admin").get(verifyAdmin);

router.route("/get-all-user-data").get(authguard, getAllUserData);

module.exports = router;
