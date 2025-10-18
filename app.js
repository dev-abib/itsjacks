require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const bodyParser = require("body-parser");
const webPush = require("web-push");

const allRoutes = require("./src/Routes/index");
const app = express();
const PORT = process.env.PORT || 8000;

// VAPID keys for push notifications
const publicVapidKey = process.env.PUBLIC_VAPID_KEY;
const privateVapidKey = process.env.PRIVATE_VAPID_KEY;
const vapidEmail = process.env.VAPID_EMAIL;

// Middleware
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(cookieParser());
app.use(bodyParser.json());
app.use(helmet());

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "https://itsjacks-dashboard.vercel.app/",
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true,
  })
);

// Rate limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests from this IP, please try again later.",
});
app.use(limiter);

// Web Push setup
// webPush.setVapidDetails(
//   `mailto:${vapidEmail}`,
//   publicVapidKey,
//   privateVapidKey
// );

// Static files
app.use("/public", express.static("public"));

// Health check
// app.get("/health", (req, res) => {
//   res.status(200).json({ message: "Server is healthy" });
// });

// Routes
app.use(allRoutes);

// Error handler
app.use((err, req, res, next) => {
  const statusCode = err.status || 500;
  res.status(statusCode).json({
    statusCode,
    success: typeof err.success === "boolean" ? err.success : false,
    message: err.message || "Internal Server Error",
    data: err.data || null,
  });
});

// Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Listening on http://localhost:${PORT}`);
});
