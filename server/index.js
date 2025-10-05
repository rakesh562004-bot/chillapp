const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);

// Setup Socket.IO
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000", // React app port
    methods: ["GET", "POST"],
  },
});

// Keep track of shared state
let currentVideoState = {
  url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  playing: false,
};

io.on("connection", (socket) => {
  console.log("✅ User connected:", socket.id);

  // Send current video state to new user
  socket.emit("sync_video", currentVideoState);

  // Handle chat messages
  socket.on("send_message", (data) => {
    console.log("💬 Message received:", data);
    socket.broadcast.emit("receive_message", data);
  });

  // Handle video actions (play/pause/link change)
  socket.on("sync_video", (data) => {
    if (data.url) currentVideoState.url = data.url;
    if (typeof data.playing === "boolean") {
      currentVideoState.playing = data.playing;
    }
    // Broadcast to everyone except sender
    socket.broadcast.emit("sync_video", currentVideoState);
    console.log("🎬 Video state updated:", currentVideoState);
  });

  socket.on("disconnect", () => {
    console.log("❌ User disconnected:", socket.id);
  });
});

// Start server
const PORT = 4000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
