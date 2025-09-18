// external dependencies
const express = require("express");




const { loginAdminController } = require("../../Controller/admin.auth.controller");

// extracting router from express
const { Router } = express;
const router = Router();



// login admin
router.route("/login-admin").post(loginAdminController);

// get admin







module.exports = router;
