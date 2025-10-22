const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const bodyParser = require("body-parser");
const http = require("http");
const socketIo = require("socket.io");

const allRoutes = require("./src/Routes/index"); // Your routes file
const { user } = require("./src/Schema/user.schema");
const app = express();
const PORT = process.env.PORT || 8000;

// Create HTTP server to work with Socket.IO
const server = http.createServer(app);

// Initialize Socket.IO
const io = socketIo(server);

// Middleware setup
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
    ], // Allowed origins
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true,
  })
);

// Rate limiter setup
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
});
app.use(limiter);

// Static files setup (optional)
app.use("/public", express.static("public"));

// Passing the io object to all routes
app.use((req, res, next) => {
  req.io = io; // Add io to the request object so that it's available in routes
  next();
});

// Use all your routes here
app.use(allRoutes);

// Socket.IO setup for user connections
const users = {}; // Store socket ids mapped to user IDs

io.on("connection", (socket) => {
  console.log("A user connected");

  // Register user when they log in
  socket.on("register", (userId) => {
    users[userId] = socket.id;
    console.log(user[userId]= socket.id);
    
  });

  // Handle disconnections
  socket.on("disconnect", () => {
    console.log("A user disconnected");
    for (let userId in users) {
      if (users[userId] === socket.id) {
        delete users[userId];
        break;
      }
    }
  });
});

// Error handler (in case of server issues)
app.use((err, req, res, next) => {
  const statusCode = err.status || 500;
  res.status(statusCode).json({
    statusCode,
    success: typeof err.success === "boolean" ? err.success : false,
    message: err.message || "Internal Server Error",
    data: err.data || null,
  });
});

// Export io so it can be used in other parts of the app
module.exports = { io };

// Start the server
server.listen(PORT, () => {
  console.log(`✅ Listening on http://localhost:${PORT}`);
});
