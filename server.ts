import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import multer from "multer";
import { nanoid } from "nanoid";
import fs from "fs";

const app = express();
const PORT = 3000;

// Temporary in-memory storage for active sessions and their files
// In a real kiosk, this would be a local directory or temporary storage
const sessions: Record<string, { files: string[]; createdAt: number }> = {};
const uploadsDir = path.join(process.cwd(), "uploads");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${nanoid()}-${file.originalname}`;
    cb(null, uniqueName);
  },
});

const upload = multer({ storage });

async function startServer() {
  // API Routes
  app.use(express.json());

  // Create a new session
  app.post("/api/session/start", (req, res) => {
    const sessionId = nanoid(10);
    sessions[sessionId] = { files: [], createdAt: Date.now() };
    res.json({ sessionId });
  });

  // Check session status/files
  app.get("/api/session/:id/files", (req, res) => {
    const session = sessions[req.params.id];
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    res.json({ files: session.files });
  });

  // Mobile Upload Route (for phone)
  app.post("/api/session/:id/upload", upload.array("files"), (req, res) => {
    const session = sessions[req.params.id];
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    
    const uploadedFiles = (req.files as Express.Multer.File[]).map(f => ({
      name: f.originalname,
      path: `/uploads/${f.filename}`,
      size: f.size,
      type: f.mimetype
    }));

    // In this simulation, we'll just store the paths
    session.files.push(...uploadedFiles.map(f => f.path));
    
    res.json({ success: true, files: uploadedFiles });
  });

  // Serve uploaded files
  app.use("/uploads", express.static(uploadsDir));

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Cleanup old sessions every 10 minutes
  setInterval(() => {
    const now = Date.now();
    for (const id in sessions) {
      if (now - sessions[id].createdAt > 15 * 60 * 1000) { // 15 mins
        delete sessions[id];
      }
    }
  }, 600000);

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
