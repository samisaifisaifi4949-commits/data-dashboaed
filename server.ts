import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  const PORT = 3000;

  // Real-time collaboration state
  const rooms: Record<string, { users: any[], charts: any[], versionHistory: any[] }> = {};

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("join-room", ({ roomId, user }) => {
      socket.join(roomId);
      if (!rooms[roomId]) {
        rooms[roomId] = { users: [], charts: [], versionHistory: [] };
      }
      
      const newUser = { ...user, socketId: socket.id };
      rooms[roomId].users.push(newUser);
      
      io.to(roomId).emit("room-state", rooms[roomId]);
      console.log(`User ${user.name} joined room ${roomId}`);
    });

    socket.on("update-charts", ({ roomId, charts }) => {
      if (rooms[roomId]) {
        // Save to version history before updating
        rooms[roomId].versionHistory.push({
          timestamp: new Date().toISOString(),
          charts: [...rooms[roomId].charts],
          updatedBy: socket.id
        });
        if (rooms[roomId].versionHistory.length > 20) rooms[roomId].versionHistory.shift();
        
        rooms[roomId].charts = charts;
        socket.to(roomId).emit("charts-updated", charts);
      }
    });

    socket.on("disconnect", () => {
      for (const roomId in rooms) {
        rooms[roomId].users = rooms[roomId].users.filter(u => u.socketId !== socket.id);
        io.to(roomId).emit("room-state", rooms[roomId]);
      }
      console.log("User disconnected:", socket.id);
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
