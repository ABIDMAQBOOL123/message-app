const http = require("http");
const express = require("express");
const path = require("path");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

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

// Define a schema for users
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  password: String,
  room: String, // Add room field to user schema
});

// Create a model for users
const User = mongoose.model("User", userSchema);

// Serve static files from the "public" directory
app.use(express.static(path.resolve("./public")));
app.use(express.json()); // Parse JSON bodies

// JWT Secret Key
const JWT_SECRET = "your_jwt_secret_key";

// Middleware to verify JWT
const authenticateJWT = (req, res, next) => {
  const token = req.headers["authorization"];
  if (!token) {
    return res.status(401).json({ message: "Access denied. No token provided." });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: "Invalid token." });
    }
    req.user = user;
    next();
  });
};

// Route for user registration
app.post("/register", async (req, res) => {
  const { username, password, room } = req.body;
  if (!username || !password || !room) {
    return res.status(400).json({ message: "Username, password, and room are required." });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ username, password: hashedPassword, room });
    await user.save();
    res.status(201).json({ message: "User registered successfully." });
  } catch (err) {
    res.status(500).json({ message: "Error registering user.", error: err.message });
  }
});

// Route for user login
app.post("/login", async (req, res) => {
  const { username, password, room } = req.body;
  if (!username || !password || !room) {
    return res.status(400).json({ message: "Username, password, and room are required." });
  }

  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ message: "Invalid username or password." });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid username or password." });
    }

    // Check if the room matches
    if (user.room !== room) {
      return res.status(401).json({ message: "Invalid room number." });
    }

    // Generate JWT
    const token = jwt.sign({ username: user.username, room: user.room }, JWT_SECRET, { expiresIn: "1h" });
    res.json({ token, room: user.room });
  } catch (err) {
    res.status(500).json({ message: "Error logging in.", error: err.message });
  }
});

// Route for the login page
app.get("/", (req, res) => {
  return res.sendFile(path.join(__dirname, "public", "login.html"));
});

// Route for the chat page (protected)
app.get("/chat.html", authenticateJWT, (req, res) => {
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