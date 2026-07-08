import { useEffect, useRef, useState, useCallback } from "react";

export interface CollaborativeUser {
  userId: string;
  userName: string;
  color: string;
  cursor: { line: number; ch: number } | null;
}

interface UsePadWebSocketProps {
  padId: string | null;
  userName: string;
  userColor: string;
  onIncomingContent: (content: string) => void;
  onTitleUpdate?: (title: string) => void;
  onLanguageUpdate?: (lang: string) => void;
  onAccessModeUpdate?: (mode: "readonly" | "collaborate") => void;
  onRevoked?: (reason?: string) => void;
}

export function usePadWebSocket({
  padId,
  userName,
  userColor,
  onIncomingContent,
  onTitleUpdate,
  onLanguageUpdate,
  onAccessModeUpdate,
  onRevoked,
}: UsePadWebSocketProps) {
  const [status, setStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [users, setUsers] = useState<CollaborativeUser[]>([]);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const userIdRef = useRef<string>("");
  const hasBeenRevokedRef = useRef<boolean>(false);

  // Initialize a unique stable userId for this session
  if (!userIdRef.current) {
    const savedId = localStorage.getItem("pyncbin_userId");
    if (savedId) {
      userIdRef.current = savedId;
    } else {
      const newId = `user_${Math.random().toString(36).substring(2, 11)}`;
      localStorage.setItem("pyncbin_userId", newId);
      userIdRef.current = newId;
    }
  }

  const userId = userIdRef.current;

  // Use a stable ref for callbacks to prevent re-renders from recreating the WebSocket
  const callbacksRef = useRef({
    onIncomingContent,
    onTitleUpdate,
    onLanguageUpdate,
    onAccessModeUpdate,
    onRevoked,
  });

  useEffect(() => {
    callbacksRef.current = {
      onIncomingContent,
      onTitleUpdate,
      onLanguageUpdate,
      onAccessModeUpdate,
      onRevoked,
    };
  }, [onIncomingContent, onTitleUpdate, onLanguageUpdate, onAccessModeUpdate, onRevoked]);

  // Send message helper
  const sendMessage = useCallback((msg: any) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(msg));
    }
  }, []);

  // Sync cursor position
  const updateCursor = useCallback((line: number, ch: number) => {
    sendMessage({
      type: "cursor",
      cursor: { line, ch },
    });
  }, [sendMessage]);

  // Sync editor content
  const updateContent = useCallback((content: string) => {
    sendMessage({
      type: "edit",
      content,
    });
  }, [sendMessage]);

  // Sync access mode update
  const updateAccessMode = useCallback((mode: "readonly" | "collaborate") => {
    sendMessage({
      type: "update-access-mode",
      padAccessMode: mode,
    });
  }, [sendMessage]);

  useEffect(() => {
    if (!padId) return;

    const connect = () => {
      // Clean previous connections
      if (socketRef.current) {
        socketRef.current.close();
      }

      hasBeenRevokedRef.current = false;
      setStatus("connecting");
      
      // Determine WebSocket protocol based on browser environment
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.host; // e.g. localhost:3000
      const wsUrl = `${protocol}//${host}/ws`;

      console.log(`[WS] Connecting to ${wsUrl} for pad ${padId}`);
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        console.log("[WS] Connection opened successfully");
        setStatus("connected");

        // Send Join Message
        sendMessage({
          type: "join",
          padId,
          userId,
          userName,
          color: userColor,
        });

        // Set up server heartbeat ping to prevent Cloud Run socket termination
        if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = setInterval(() => {
          sendMessage({ type: "ping" });
        }, 20000); // every 20s
      };

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          switch (msg.type) {
            case "init":
              callbacksRef.current.onIncomingContent(msg.content || "");
              if (callbacksRef.current.onTitleUpdate && msg.title) {
                callbacksRef.current.onTitleUpdate(msg.title);
              }
              if (callbacksRef.current.onLanguageUpdate && msg.language) {
                callbacksRef.current.onLanguageUpdate(msg.language);
              }
              if (callbacksRef.current.onAccessModeUpdate && msg.padAccessMode) {
                callbacksRef.current.onAccessModeUpdate(msg.padAccessMode);
              }
              break;

            case "sync":
              if (msg.senderId !== userId) {
                callbacksRef.current.onIncomingContent(msg.content);
              }
              break;

            case "presence":
              // Received updated list of active users in pad
              setUsers(msg.users || []);
              break;

            case "cursor-sync":
              // Real-time remote cursor movement
              setUsers((prevUsers) =>
                prevUsers.map((u) =>
                  u.userId === msg.userId ? { ...u, cursor: msg.cursor } : u
                )
              );
              break;

            case "access-mode-updated":
              if (callbacksRef.current.onAccessModeUpdate && msg.padAccessMode) {
                callbacksRef.current.onAccessModeUpdate(msg.padAccessMode);
              }
              break;

            case "pong":
              // Heartbeat acknowledgement
              break;

            case "revoked":
              hasBeenRevokedRef.current = true;
              if (callbacksRef.current.onRevoked) {
                callbacksRef.current.onRevoked(msg.reason);
              }
              break;

            default:
              break;
          }
        } catch (err) {
          console.error("[WS] Error parsing message:", err);
        }
      };

      socket.onclose = (event) => {
        console.log(`[WS] Connection closed: ${event.reason || "no reason"}`);
        setStatus("disconnected");
        setUsers([]);

        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
        }

        // If pad was revoked, do not retry connection
        if (hasBeenRevokedRef.current) {
          console.log("[WS] Pad has been revoked. Stopping reconnect attempts.");
          return;
        }

        // Auto-reconnect with exponential backoff
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log("[WS] Retrying connection...");
          connect();
        }, 3000);
      };

      socket.onerror = (err) => {
        console.error("[WS] Socket error:", err);
        socket.close();
      };
    };

    connect();

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, [padId, userName, userColor, userId, sendMessage]);

  return {
    status,
    users,
    userId,
    updateContent,
    updateCursor,
    updateAccessMode,
  };
}
