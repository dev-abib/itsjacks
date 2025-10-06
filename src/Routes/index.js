// external dependencies
const express = require("express");

// interanl dependencies
const adminAuthRoutes = require("./Api/admin.auth.api");
const userAuthRoutes = require("./Api/user.auth.api");
const postRoutes = require("./Api/post.api");

const { apiError } = require("../Utils/api.error");
const { asyncHandler } = require("../Utils/asyncHandler");
const { apiSuccess } = require("../Utils/api.success");

// extracting router from express
const { Router } = express;
const router = Router();

// main get route to check the app
router.route(process.env.API_VERSION).get((req, res) => {
  return res
    .status(200)
    .json(new apiSuccess(200, "Application initialized", true, false));
});

router.use(process.env.API_VERSION, adminAuthRoutes);
router.use(process.env.API_VERSION, userAuthRoutes);
router.use(process.env.API_VERSION, postRoutes);

router.use(
  process.env.API_VERSION,
  asyncHandler(async (req, res, next) => {
    return next(new apiError(404, "Route not found", null, false));
  })
);

module.exports = router;
