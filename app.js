const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const bodyParser = require("body-parser");
const http = require("http");
const socketIo = require("socket.io");

const allRoutes = require("./src/Routes/index");
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

// CORS setup
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "https://itsjacks-dashboard.vercel.app",
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true,
  })
);

// Rate limiter setup
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests from this IP, please try again later.",
});
app.use(limiter);

// Static files setup
app.use("/public", express.static("public"));

// Routes
app.use(allRoutes);

// Socket.IO connection handling (Place this code below the above setup)
const users = {}; 

app.use((req, res, next) => {
  req.io = io;
  next();
});

io.on("connection", (socket) => {
  console.log("A user connected");

  // Store the socket ID and associated user when the user logs in
  socket.on("register", (userId) => {
    users[userId] = socket.id;
  });

  // Handle notifications: send to specific user
  socket.on("sendNotification", (data) => {
    const { message, userId } = data;
    if (users[userId]) {
      io.to(users[userId]).emit("notification", message);
    }
  });

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



// Start the server
server.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Listening on http://localhost:${PORT}`);
});
