const io = require("socket.io-client");

// Connect to the server
const socket = io("http://localhost:3000");

// Handle connection
socket.on("connect", () => {
  console.log("Connected to the server!");


  socket.emit("register", "68f5a3076c1cd8bcf540a981"); 

  // Listen for server messages or other events
  socket.on("sendNotification", (message) => {
    console.log("Received message:", message);
  });
});

// Handle disconnection
socket.on("disconnect", () => {
  console.log("Disconnected from the server");
});
