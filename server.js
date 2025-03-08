const http = require("http");
const express = require("express");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files from the "public" directory
app.use(express.static(path.resolve("./public")));

// Route for the login page
app.get("/", (req, res) => {
  return res.sendFile(path.join(__dirname, "public", "login.html"));
});

// Route for the chat page
app.get("/chat.html", (req, res) => {
  return res.sendFile(path.join(__dirname, "public", "chat.html"));
});

// Socket.io
io.on("connection", (socket) => {
  console.log("a user connected");

  // Handle joining a room
  socket.on("join-room", (room) => {
    socket.join(room);
    socket.room = room;
    io.to(room).emit("user-connected", "A user has joined the room");
  });

  // Handle user messages
  socket.on("user-message", (data) => {
    const { room, message, username } = data;
    const timestamp = new Date().toLocaleTimeString();
    io.to(room).emit("message", { username, message, timestamp });
  });

  // Handle user disconnect
  socket.on("disconnect", () => {
    if (socket.room) {
      io.to(socket.room).emit("user-disconnected", "A user has left the room");
    }
  });
});

// Start the server
server.listen(9000, () => console.log(`Server Started at PORT:9000`));