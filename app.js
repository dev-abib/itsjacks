const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const bodyParser = require("body-parser");

const allRoutes = require("./src/Routes/index");

const app = express();
const PORT = process.env.PORT || 8080; 

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
      "https://itsjacks-dashboard.vercel.app",
      "https://frapp-dashboard-866790713672.europe-west1.run.app"
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true,
  })
);

// Rate limiter
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use(limiter);

// Routes
app.use(allRoutes);

// Health check route
app.get("/health", (req, res) => res.json({ status: "ok" }));

// Error handler
app.use((err, req, res, next) => {
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Express app running on port ${PORT}`);
});
