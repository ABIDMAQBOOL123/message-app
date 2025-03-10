const http = require("http");
const express = require("express");
const path = require("path");
const { Server } = require("socket.io");
const mongoose = require("mongoose");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Connect to MongoDB
mongoose.connect("mongodb://localhost:27017/chatApp", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Define a schema for chat messages
const messageSchema = new mongoose.Schema({
  room: String,
  username: String,
  message: String,
  timestamp: String,
});

// Create a model for chat messages
const Message = mongoose.model("Message", messageSchema);

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
  socket.on("join-room", async (room) => {
    socket.join(room);
    socket.room = room;

    // Retrieve previous messages from the database
    const previousMessages = await Message.find({ room }).sort({ timestamp: 1 });
    previousMessages.forEach((msg) => {
      socket.emit("message", {
        username: msg.username,
        message: msg.message,
        timestamp: msg.timestamp,
      });
    });

    io.to(room).emit("user-connected", "A user has joined the room");
  });

  // Handle user messages
  socket.on("user-message", async (data) => {
    const { room, message, username } = data;
    const timestamp = new Date().toLocaleTimeString();

    // Save the message to the database
    const newMessage = new Message({ room, username, message, timestamp });
    await newMessage.save();

    // Broadcast the message to the room
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