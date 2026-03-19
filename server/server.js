const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const path = require("path");

const app = express();
const isVercel = !!process.env.VERCEL;
const dbPath = isVercel
  ? path.join("/tmp", "trackvista.db")
  : path.join(__dirname, "trackvista.db");

const JWT_SECRET = process.env.JWT_SECRET || "trackvista-secret-key-2026";

let db;
const getDb = () => {
  if (!db) {
    db = new sqlite3.Database(dbPath);
  }
  return db;
};

app.use(express.json({ limit: "1mb" }));
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

// Serve static frontend files from the bundled public folder
app.use(express.static(path.join(__dirname, "public")));

const run = (sql, params = []) =>
  new Promise((resolve, reject) => {
    getDb().run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });

const get = (sql, params = []) =>
  new Promise((resolve, reject) => {
    getDb().get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });

const all = (sql, params = []) =>
  new Promise((resolve, reject) => {
    getDb().all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
};

const verifyPassword = (password, stored) => {
  const [salt, key] = stored.split(":");
  if (!salt || !key) return false;
  const hash = crypto.scryptSync(password, salt, 64);
  const keyBuffer = Buffer.from(key, "hex");
  if (keyBuffer.length !== hash.length) return false;
  return crypto.timingSafeEqual(keyBuffer, hash);
};

const initDb = async () => {
  await run(
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`
  );

  await run(
    `CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      project_name TEXT,
      project_type TEXT,
      project_category TEXT,
      project_description TEXT,
      project_objective TEXT,
      project_requirements TEXT,
      design_requirements TEXT,
      target_users TEXT,
      technology_preferences TEXT,
      budget TEXT,
      deadline TEXT,
      attachment_name TEXT,
      progress INTEGER DEFAULT 0,
      health TEXT DEFAULT 'On Track',
      created_at TEXT NOT NULL
    )`
  );

  await run(
    `CREATE TABLE IF NOT EXISTS meetings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      meeting_title TEXT,
      project_name TEXT,
      meeting_date TEXT,
      time_start TEXT,
      time_end TEXT,
      meeting_type TEXT,
      created_at TEXT NOT NULL
    )`
  );

  await run(
    `CREATE TABLE IF NOT EXISTS feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      project_selection TEXT,
      stars INTEGER,
      comment TEXT,
      communication INTEGER,
      development INTEGER,
      design INTEGER,
      management INTEGER,
      delivery_satisfaction TEXT,
      suggestion TEXT,
      anonymous INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    )`
  );

  await run(
    `CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      sender_type TEXT NOT NULL,
      sender_name TEXT,
      message_text TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`
  );

  // Seed default user so login always works after a cold start
  const defaultUser = await get("SELECT id FROM users WHERE username = ?", ["Rohith"]);
  if (!defaultUser) {
    const passwordHash = hashPassword("123");
    const now = new Date().toISOString();
    await run(
      "INSERT INTO users (username, email, password_hash, created_at) VALUES (?, ?, ?, ?)",
      ["Rohith", "rohith@trackvista.com", passwordHash, now]
    );
  }
};

let dbInitialized = false;

// Middleware: ensure DB is initialized on every request (critical for Vercel cold starts)
app.use(async (req, res, next) => {
  if (!dbInitialized) {
    try {
      await initDb();
      dbInitialized = true;
    } catch (error) {
      console.error("DB init error:", error);
      return res.status(500).json({ error: "Database initialization failed" });
    }
  }
  next();
});

// JWT-based auth middleware (replaces in-memory sessions)
const requireAuth = (req, res, next) => {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.userId;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

app.post("/api/auth/signup", async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const existing = await get(
      "SELECT id FROM users WHERE username = ? OR email = ?",
      [username, email]
    );
    if (existing) {
      return res.status(409).json({ error: "User already exists" });
    }

    const passwordHash = hashPassword(password);
    const now = new Date().toISOString();
    const result = await run(
      "INSERT INTO users (username, email, password_hash, created_at) VALUES (?, ?, ?, ?)",
      [username, email, passwordHash, now]
    );

    res.json({
      user: {
        id: result.lastID,
        username,
        email,
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Missing credentials" });
    }

    const user = await get("SELECT * FROM users WHERE username = ?", [username]);
    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    // Create JWT token instead of in-memory session
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/me", requireAuth, async (req, res) => {
  try {
    const user = await get("SELECT id, username, email FROM users WHERE id = ?", [
      req.userId,
    ]);
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/projects", requireAuth, async (req, res) => {
  try {
    const {
      projectType,
      projectCategory,
      projectDescription,
      projectObjective,
      projectRequirements,
      designRequirements,
      targetUsers,
      technologyPreferences,
      budget,
      deadline,
      attachmentName,
      projectName,
    } = req.body;

    const resolvedName = projectName || projectCategory || projectType || "New Project";
    const now = new Date().toISOString();

    const result = await run(
      `INSERT INTO projects (
        user_id,
        project_name,
        project_type,
        project_category,
        project_description,
        project_objective,
        project_requirements,
        design_requirements,
        target_users,
        technology_preferences,
        budget,
        deadline,
        attachment_name,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.userId,
        resolvedName,
        projectType,
        projectCategory,
        projectDescription,
        projectObjective,
        projectRequirements,
        designRequirements,
        targetUsers,
        technologyPreferences,
        budget,
        deadline,
        attachmentName,
        now,
      ]
    );

    res.json({
      id: result.lastID,
      projectName: resolvedName,
      projectType,
      projectCategory,
      projectDescription,
      deadline,
    });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/projects/latest", requireAuth, async (req, res) => {
  try {
    const project = await get(
      "SELECT * FROM projects WHERE user_id = ? ORDER BY id DESC LIMIT 1",
      [req.userId]
    );
    if (!project) {
      return res.status(404).json({ error: "No projects found" });
    }

    res.json({
      id: project.id,
      projectId: `TV-${project.id}`,
      projectName: project.project_name,
      projectType: project.project_type,
      projectDescription: project.project_description,
      health: project.health,
      progress: project.progress,
      deadline: project.deadline,
    });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/meetings", requireAuth, async (req, res) => {
  try {
    const { meetingTitle, projectName, meetingDate, timeStart, timeEnd, meetingType } = req.body;
    if (!meetingTitle || !projectName || !meetingDate || !timeStart || !timeEnd || !meetingType) {
      return res.status(400).json({ error: "Missing meeting details" });
    }

    const now = new Date().toISOString();
    const result = await run(
      `INSERT INTO meetings (
        user_id,
        meeting_title,
        project_name,
        meeting_date,
        time_start,
        time_end,
        meeting_type,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.userId,
        meetingTitle,
        projectName,
        meetingDate,
        timeStart,
        timeEnd,
        meetingType,
        now,
      ]
    );

    res.json({ id: result.lastID });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/feedback", requireAuth, async (req, res) => {
  try {
    const {
      projectSelection,
      stars,
      comment,
      communication,
      development,
      design,
      management,
      deliverySatisfaction,
      suggestion,
      anonymous,
    } = req.body;

    if (!projectSelection || !stars || !comment || !deliverySatisfaction) {
      return res.status(400).json({ error: "Missing feedback details" });
    }

    const now = new Date().toISOString();
    const result = await run(
      `INSERT INTO feedback (
        user_id,
        project_selection,
        stars,
        comment,
        communication,
        development,
        design,
        management,
        delivery_satisfaction,
        suggestion,
        anonymous,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        anonymous ? null : req.userId,
        projectSelection,
        Number(stars),
        comment,
        Number(communication) || null,
        Number(development) || null,
        Number(design) || null,
        Number(management) || null,
        deliverySatisfaction,
        suggestion || "",
        anonymous ? 1 : 0,
        now,
      ]
    );

    res.json({ id: result.lastID });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/messages", requireAuth, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const messages = await all(
      "SELECT id, sender_type, sender_name, message_text, created_at FROM messages WHERE user_id = ? ORDER BY id ASC LIMIT ?",
      [req.userId, limit]
    );

    res.json(
      messages.map((msg) => ({
        id: msg.id,
        senderType: msg.sender_type,
        senderName: msg.sender_name,
        text: msg.message_text,
        createdAt: msg.created_at,
      }))
    );
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/messages", requireAuth, async (req, res) => {
  try {
    const { text, senderType, senderName } = req.body;
    if (!text) {
      return res.status(400).json({ error: "Message text required" });
    }

    const user = await get("SELECT username FROM users WHERE id = ?", [req.userId]);
    const resolvedType = senderType === "team" ? "team" : "client";
    const resolvedName = senderName || (resolvedType === "team" ? "Dev Team" : user.username);
    const now = new Date().toISOString();

    const result = await run(
      "INSERT INTO messages (user_id, sender_type, sender_name, message_text, created_at) VALUES (?, ?, ?, ?, ?)",
      [req.userId, resolvedType, resolvedName, text, now]
    );

    res.json({ id: result.lastID });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

// Catch-all: serve index.html for any non-API route (SPA fallback)
app.get("*", (req, res) => {
  if (!req.path.startsWith("/api")) {
    res.sendFile(path.join(__dirname, "public", "index.html"));
  } else {
    res.status(404).json({ error: "Not found" });
  }
});

module.exports = app;

if (!isVercel) {
  const PORT = process.env.PORT || 3000;
  initDb()
    .then(() => {
      dbInitialized = true;
      app.listen(PORT, () => {
        console.log(`TrackVista API running on http://localhost:${PORT}`);
      });
    })
    .catch((error) => {
      console.error("Failed to initialize database", error);
      process.exit(1);
    });
}
