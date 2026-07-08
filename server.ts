import express from "express";
import http from "http";
import path from "path";
import fs from "fs";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import crypto from "crypto";

// Define Types
interface Paste {
  id: string;
  title: string;
  content: string;
  isPad: boolean;
  expiration: string; // '5m', '10m', '30m', '1h', '1d', '1w', '1m', 'never'
  burnOnRead: boolean;
  language: string;
  encrypted: boolean;
  createdAt: number;
  expiresAt: number | null;
  ownerId?: string;
  padAccessMode?: "readonly" | "collaborate";
}

interface PadClient {
  ws: WebSocket;
  userId: string;
  userName: string;
  color: string;
  cursor: { line: number; ch: number } | null;
}

const PORT = 3000;
const DB_FILE = process.env.VERCEL || process.env.ZEIT_ENV
  ? path.join("/tmp", "pastes.json")
  : path.join(process.cwd(), "pastes.json");

// In-memory store
let pastes: Record<string, Paste> = {};

// Load pastes from file on startup
function loadDatabase() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, "utf-8");
      pastes = JSON.parse(data);
      console.log(`[Database] Loaded ${Object.keys(pastes).length} pastes.`);
    } else {
      pastes = {};
      saveDatabase();
    }
  } catch (err) {
    console.error("[Database] Error loading database, initializing empty:", err);
    pastes = {};
  }
}

// Save pastes to file
function saveDatabase() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(pastes, null, 2), "utf-8");
  } catch (err) {
    console.error("[Database] Error saving database:", err);
  }
}

// Expiration Calculator
function calculateExpiration(expiration: string): number | null {
  const now = Date.now();
  switch (expiration) {
    case "5m":
      return now + 5 * 60 * 1000;
    case "10m":
      return now + 10 * 60 * 1000;
    case "30m":
      return now + 30 * 60 * 1000;
    case "1h":
      return now + 60 * 60 * 1000;
    case "1d":
      return now + 24 * 60 * 60 * 1000;
    case "1w":
      return now + 7 * 24 * 60 * 60 * 1000;
    case "1m":
      return now + 30 * 24 * 60 * 60 * 1000;
    case "never":
    default:
      return null;
  }
}

// Map padId to client list (defined at top level for both express endpoints and websocket server)
const activePads: Record<string, PadClient[]> = {};

const app = express();
app.use(express.json({ limit: "10mb" })); // Support large pastes

// Load database immediately at module load (works for serverless cold-starts too)
loadDatabase();

// Clean expired pastes every 30 seconds
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    let changed = false;
    for (const id in pastes) {
      const paste = pastes[id];
      if (paste.expiresAt !== null && paste.expiresAt < now) {
        console.log(`[Database] Evicting expired paste: ${id}`);
        delete pastes[id];
        changed = true;
      }
    }
    if (changed) {
      saveDatabase();
    }
  }, 30000);
}

// Setup Express Server Wrapper
async function startServer() {
  const server = http.createServer(app);

  // --- API Endpoints ---

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", count: Object.keys(pastes).length });
  });

  // Create a paste
  app.post("/api/paste", (req, res) => {
    try {
      const { title, content, isPad, expiration, burnOnRead, language, encrypted, ownerId, padAccessMode } = req.body;

      if (!content || typeof content !== "string") {
        res.status(400).json({ error: "Content is required and must be a string." });
        return;
      }

      // Generate secure unique ID
      const id = crypto.randomBytes(6).toString("base64url").substring(0, 8);
      const createdAt = Date.now();
      const expiresAt = calculateExpiration(expiration || "never");

      const paste: Paste = {
        id,
        title: title?.trim().substring(0, 100) || "Untitled Paste",
        content,
        isPad: !!isPad,
        expiration: expiration || "never",
        burnOnRead: !!burnOnRead && !isPad, // Pads can't be burn-on-read for obvious reasons
        language: language || "auto",
        encrypted: !!encrypted,
        createdAt,
        expiresAt,
        ownerId: isPad ? ownerId : undefined,
        padAccessMode: isPad ? (padAccessMode || "readonly") : undefined,
      };

      pastes[id] = paste;
      saveDatabase();

      console.log(`[Database] Created paste ${id} (isPad: ${paste.isPad}, encrypted: ${paste.encrypted})`);
      res.json({ id, title: paste.title, isPad: paste.isPad });
    } catch (err) {
      console.error("[API] Error creating paste:", err);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  // Get a paste
  app.get("/api/paste/:id", (req, res) => {
    try {
      const id = req.params.id;
      const paste = pastes[id];

      if (!paste) {
        res.status(404).json({ error: "Paste not found or has expired." });
        return;
      }

      // Check if expired
      if (paste.expiresAt !== null && paste.expiresAt < Date.now()) {
        delete pastes[id];
        saveDatabase();
        res.status(404).json({ error: "Paste has expired." });
        return;
      }

      // If burn on read, copy, delete from database and save
      if (paste.burnOnRead) {
        console.log(`[Database] Burning paste on read: ${id}`);
        const result = { ...paste, burned: true };
        delete pastes[id];
        saveDatabase();
        res.json(result);
        return;
      }

      res.json(paste);
    } catch (err) {
      console.error("[API] Error fetching paste:", err);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  // Update/Save an existing paste or collaborative pad
  app.put("/api/paste/:id", (req, res) => {
    try {
      const id = req.params.id;
      const { title, content, language } = req.body;

      const paste = pastes[id];
      if (!paste) {
        res.status(404).json({ error: "Paste not found or has expired." });
        return;
      }

      // Check if expired
      if (paste.expiresAt !== null && paste.expiresAt < Date.now()) {
        delete pastes[id];
        saveDatabase();
        res.status(404).json({ error: "Paste has expired." });
        return;
      }

      // Update fields
      if (title !== undefined) {
        paste.title = title.trim().substring(0, 100) || "Untitled Paste";
      }
      if (content !== undefined) {
        paste.content = content;
      }
      if (language !== undefined) {
        paste.language = language;
      }

      saveDatabase();
      console.log(`[Database] Updated paste/pad ${id}`);

      // Broadcast update to all connected WebSocket clients for this pad
      const clients = activePads[id] || [];
      clients.forEach((client) => {
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.send(
            JSON.stringify({
              type: "sync",
              content: paste.content,
              senderId: "server", // Indicates system sync
            })
          );
        }
      });

      res.json({ success: true, message: "Paste successfully updated.", paste });
    } catch (err) {
      console.error("[API] Error updating paste/pad:", err);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  // Delete/Revoke a paste or collaborative pad
  app.delete("/api/paste/:id", (req, res) => {
    try {
      const id = req.params.id;
      const paste = pastes[id];

      if (!paste) {
        res.status(404).json({ error: "Paste not found." });
        return;
      }

      // Evict from active pastes
      delete pastes[id];
      saveDatabase();

      console.log(`[Database] Revoked paste/pad: ${id}`);

      // If it was an active dynamic pad, notify all connected clients
      const clients = activePads[id];
      if (clients && clients.length > 0) {
        clients.forEach((client) => {
          if (client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(
              JSON.stringify({
                type: "revoked",
                reason: "owner-left",
                message: "This pad has been closed or revoked by the creator.",
              })
            );
            client.ws.close();
          }
        });
        delete activePads[id];
      }

      res.json({ success: true, message: "Paste/pad successfully revoked." });
    } catch (err) {
      console.error("[API] Error deleting paste/pad:", err);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  // --- WebSocket Setup for Pads ---
  const wss = new WebSocketServer({ noServer: true });

  wss.on("connection", (ws: WebSocket) => {
    let currentPadId: string | null = null;
    let currentUserId: string | null = null;

    ws.on("message", (messageStr: string) => {
      try {
        const msg = JSON.parse(messageStr);

        switch (msg.type) {
          case "join": {
            const { padId, userId, userName, color } = msg;
            currentPadId = padId;
            currentUserId = userId;

            // Initialize pad clients if not exist
            if (!activePads[padId]) {
              activePads[padId] = [];
            }

            // Remove existing if any (reconnection safeguard)
            activePads[padId] = activePads[padId].filter((c) => c.userId !== userId);

            // Add new client
            const newClient: PadClient = {
              ws,
              userId,
              userName: userName || "Anonymous Writer",
              color: color || "#3b82f6",
              cursor: null,
            };
            activePads[padId].push(newClient);

            console.log(`[WS] User ${userName} (${userId}) joined pad ${padId}`);

            // Send current pad content if exists
            const paste = pastes[padId];
            if (paste) {
              ws.send(
                JSON.stringify({
                  type: "init",
                  content: paste.content,
                  title: paste.title,
                  language: paste.language,
                  padAccessMode: paste.padAccessMode || "readonly",
                  ownerId: paste.ownerId,
                })
              );
            } else {
              ws.send(
                JSON.stringify({
                  type: "revoked",
                  message: "This pad has been closed or revoked by the creator."
                })
              );
              ws.close();
            }

            // Broadcast new user list to all in this pad
            broadcastPresence(padId);
            break;
          }

          case "edit": {
            if (!currentPadId || !currentUserId) return;
            const { content } = msg;

            // Update in database
            const paste = pastes[currentPadId];
            if (paste && paste.isPad) {
              paste.content = content;
              saveDatabase();
            }

            // Broadcast edit sync to other clients in this pad
            const clients = activePads[currentPadId] || [];
            clients.forEach((client) => {
              if (client.userId !== currentUserId && client.ws.readyState === WebSocket.OPEN) {
                client.ws.send(
                  JSON.stringify({
                    type: "sync",
                    content,
                    senderId: currentUserId,
                  })
                );
              }
            });
            break;
          }

          case "cursor": {
            if (!currentPadId || !currentUserId) return;
            const { cursor } = msg;

            // Update client's cursor position
            const clients = activePads[currentPadId] || [];
            const client = clients.find((c) => c.userId === currentUserId);
            if (client) {
              client.cursor = cursor;
            }

            // Broadcast cursor update to other clients
            clients.forEach((c) => {
              if (c.userId !== currentUserId && c.ws.readyState === WebSocket.OPEN) {
                c.ws.send(
                  JSON.stringify({
                    type: "cursor-sync",
                    userId: currentUserId,
                    cursor,
                  })
                );
              }
            });
            break;
          }

          case "ping":
            ws.send(JSON.stringify({ type: "pong" }));
            break;

          case "update-access-mode": {
            if (!currentPadId || !currentUserId) return;
            const { padAccessMode } = msg;

            // Only the owner can change the access mode
            const paste = pastes[currentPadId];
            if (paste && paste.isPad && paste.ownerId === currentUserId) {
              paste.padAccessMode = padAccessMode;
              saveDatabase();

              // Broadcast the updated access mode to all connected clients
              const clients = activePads[currentPadId] || [];
              clients.forEach((client) => {
                if (client.ws.readyState === WebSocket.OPEN) {
                  client.ws.send(
                    JSON.stringify({
                      type: "access-mode-updated",
                      padAccessMode,
                    })
                  );
                }
              });
            }
            break;
          }

          default:
            break;
        }
      } catch (err) {
        console.error("[WS] Message handling error:", err);
      }
    });

    ws.on("close", () => {
      if (currentPadId && currentUserId) {
        console.log(`[WS] User (${currentUserId}) disconnected from pad ${currentPadId}`);
        const clients = activePads[currentPadId] || [];

        // Check if the disconnecting user is the owner of this live pad
        const paste = pastes[currentPadId];
        const isOwner = paste && paste.isPad && paste.ownerId === currentUserId;

        if (isOwner) {
          console.log(`[WS] Owner (${currentUserId}) disconnected. Deleting/Revoking pad ${currentPadId}.`);
          delete pastes[currentPadId];
          saveDatabase();

          // Notify all other clients that the session has ended because the owner left, then close them
          clients.forEach((client) => {
            if (client.userId !== currentUserId && client.ws.readyState === WebSocket.OPEN) {
              client.ws.send(
                JSON.stringify({
                  type: "revoked",
                  reason: "owner-left",
                  message: "The session has ended because the owner left.",
                })
              );
              client.ws.close();
            }
          });
          delete activePads[currentPadId];
        } else {
          // Normal participant disconnected
          activePads[currentPadId] = clients.filter((c) => c.userId !== currentUserId);

          if (activePads[currentPadId].length === 0) {
            delete activePads[currentPadId];
          } else {
            broadcastPresence(currentPadId);
          }
        }
      }
    });

    function broadcastPresence(padId: string) {
      const clients = activePads[padId] || [];
      const userList = clients.map((c) => ({
        userId: c.userId,
        userName: c.userName,
        color: c.color,
        cursor: c.cursor,
      }));

      clients.forEach((client) => {
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.send(
            JSON.stringify({
              type: "presence",
              users: userList,
            })
          );
        }
      });
    }
  });

  // Attach WebSocket Server upgrade handler
  server.on("upgrade", (request, socket, head) => {
    const pathname = request.url ? new URL(request.url, `http://${request.headers.host}`).pathname : "";
    if (pathname === "/ws") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  // --- Vite Asset Serving Middleware ---
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

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Running at http://0.0.0.0:${PORT} (env: ${process.env.NODE_ENV || "development"})`);
  });
}

// Export express app for serverless platforms (e.g. Vercel)
export { app };

// Only start the full standalone HTTP + WebSocket server if not in a Vercel/serverless environment
if (!process.env.VERCEL && !process.env.ZEIT_ENV) {
  startServer().catch((err) => {
    console.error("[Server] Critical failure during startup:", err);
  });
}
