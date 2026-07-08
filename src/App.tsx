import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import {
  Plus,
  Clock,
  Lock,
  Unlock,
  FileCode,
  Share2,
  Copy,
  Check,
  Settings,
  Sun,
  Moon,
  Users,
  Radio,
  Eye,
  Edit3,
  AlertTriangle,
  Trash2,
  HelpCircle,
  ExternalLink,
  Shield,
  Activity,
  Download,
  Sparkles,
  RefreshCw,
  User,
  CheckSquare,
  LogOut,
  XCircle,
  ChevronsUpDown
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { EditorWithLineNumbers } from "./components/EditorWithLineNumbers";
import { MarkdownRenderer } from "./components/MarkdownRenderer";
import { HistoryDrawer } from "./components/HistoryDrawer";
import { PyncBinLogo } from "./components/PyncBinLogo";
import {
  SUPPORTED_LANGUAGES,
  ExpirationOption,
  Paste,
  HistoryItem
} from "./types";
import {
  generateRandomKey,
  encryptContent,
  decryptContent,
  deriveKeyFromPassword
} from "./cryptoUtils";
import { usePadWebSocket, CollaborativeUser } from "./hooks/usePadWebSocket";

// Default configuration constants
const ADJECTIVES = ["Swift", "Silent", "Secure", "Vibrant", "Clever", "Sleek", "Polished", "Luminous", "Crypto", "Agile"];
const ANIMALS = ["Fox", "Owl", "Cat", "Koala", "Otter", "Lynx", "Wolf", "Bear", "Falcon", "Eagle", "Panda", "Panther"];
const PRESET_COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#f59e0b", // amber
  "#10b981", // emerald
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#14b8a6"  // teal
];

// Helper to generate stable random persona for collaboration
function getOrCreatePersona() {
  const savedName = localStorage.getItem("pyncbin_userName");
  const savedColor = localStorage.getItem("pyncbin_userColor");
  
  if (savedName && savedColor) {
    return { name: savedName, color: savedColor };
  }
  
  const randAdj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const randAnimal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  const name = `${randAdj} ${randAnimal}`;
  const color = PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)];
  
  localStorage.setItem("pyncbin_userName", name);
  localStorage.setItem("pyncbin_userColor", color);
  return { name, color };
}

export default function App() {
  // State for user details
  const [userPersona, setUserPersona] = useState(() => getOrCreatePersona());
  const [showPersonaModal, setShowPersonaModal] = useState(false);
  const [editedUserName, setEditedUserName] = useState(userPersona.name);
  const [editedUserColor, setEditedUserColor] = useState(userPersona.color);

  // General App configuration
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = localStorage.getItem("pyncbin_theme");
    if (saved === "light" || saved === "dark") return saved;
    return "dark";
  });

  // Mode & Load States
  const [pasteId, setPasteId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isViewing, setIsViewing] = useState(false);
  const [loadedPaste, setLoadedPaste] = useState<Paste | null>(null);

  // Editor states
  const [title, setTitle] = useState("Untitled Note");
  const [content, setContent] = useState("");
  const [isPad, setIsPad] = useState(false); // standard Paste (static) vs collaborative Pad (real-time)
  const [padAccessMode, setPadAccessMode] = useState<"readonly" | "collaborate">("readonly");
  const [expiration, setExpiration] = useState<ExpirationOption>("1h");
  const [burnOnRead, setBurnOnRead] = useState(false);
  const [language, setLanguage] = useState("plaintext");
  
  // Custom layout modes
  const [activeTab, setActiveTab] = useState<"edit" | "preview" | "split">("edit");
  const [historyOpen, setHistoryOpen] = useState(false);

  // Security states
  const [encryptEnabled, setEncryptEnabled] = useState(false);
  const [passwordProtect, setPasswordProtect] = useState(false);
  const [password, setPassword] = useState("");
  const [decryptPassword, setDecryptPassword] = useState("");
  const [requiresDecryptionInput, setRequiresDecryptionInput] = useState(false);
  const [decryptionError, setDecryptionError] = useState<string | null>(null);

  // States for updating existing notes (Publish Changes / Update features)
  const [isEditingStaticPaste, setIsEditingStaticPaste] = useState(false);
  const [currentDecryptionKey, setCurrentDecryptionKey] = useState<string | null>(null);

  // Check if current user is the original creator of this paste/pad
  const isCreator = useMemo(() => {
    if (!pasteId) return true; // Draft mode is always creator mode
    try {
      const createdRaw = localStorage.getItem("pyncbin_created");
      const createdList = createdRaw ? JSON.parse(createdRaw) : [];
      return createdList.includes(pasteId);
    } catch (e) {
      return false;
    }
  }, [pasteId]);

  // Syncing & Menu States
  const [syncStatus, setSyncStatus] = useState<"synced" | "syncing" | "offline">("synced");
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  // Refs
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const initialLoadRef = useRef(true);
  const initialFetchDone = useRef(false);

  // Notification states
  const [notification, setNotification] = useState<{ msg: string; type: "success" | "error" | "info" } | null>(null);

  // Apply dark class to document and update favicon dynamically to match theme
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("pyncbin_theme", theme);

    // Dynamic high-fidelity Favicon matching light/dark theme
    const isDark = theme === "dark";
    const docFill = isDark ? "#12131a" : "#f8fafc";
    const docStroke = isDark ? "#475569" : "#94a3b8";
    const foldFill = isDark ? "#1e2230" : "#e2e8f0";
    const codeStroke = isDark ? "#f8fafc" : "#1e293b";
    const linesStroke = isDark ? "#334155" : "#cbd5e1";
    const arrowGrad0 = isDark ? "#3b82f6" : "#2563eb";
    const arrowGrad1 = isDark ? "#8b5cf6" : "#7c3aed";

    const svgIcon = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <linearGradient id="fav-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${arrowGrad0}" />
          <stop offset="100%" stop-color="${arrowGrad1}" />
        </linearGradient>
        <path d="M 24 12 H 50 L 66 28 V 74 A 4 4 0 0 1 62 78 H 22 A 4 4 0 0 1 18 74 V 16 A 4 4 0 0 1 22 12 Z" fill="${docFill}" stroke="${docStroke}" stroke-width="3" stroke-linejoin="round" />
        <path d="M 50 12 V 24 A 4 4 0 0 0 54 28 H 66 Z" fill="${foldFill}" stroke="${docStroke}" stroke-width="3" stroke-linejoin="round" />
        <g stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" stroke="${codeStroke}">
          <path d="M 31 29 L 25 34 L 31 39" fill="none" />
          <path d="M 34.5 41 L 39.5 27" fill="none" />
          <path d="M 43 29 L 49 34 L 43 39" fill="none" />
        </g>
        <g stroke-width="4.5" stroke-linecap="round" stroke="${linesStroke}">
          <line x1="25" y1="48" x2="58" y2="48" />
          <line x1="25" y1="56" x2="54" y2="56" />
          <line x1="25" y1="64" x2="48" y2="64" />
          <line x1="25" y1="72" x2="38" y2="72" />
        </g>
        <path d="M 53.3 53.3 A 18 18 0 0 1 84 66" fill="none" stroke="url(#fav-grad)" stroke-width="6.5" stroke-linecap="round" />
        <path d="M 84 57.5 L 84 66 L 75.5 66" fill="none" stroke="url(#fav-grad)" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M 78.7 78.7 A 18 18 0 0 1 50 66" fill="none" stroke="url(#fav-grad)" stroke-width="6.5" stroke-linecap="round" />
        <path d="M 50 74.5 L 50 66 L 58.5 66" fill="none" stroke="url(#fav-grad)" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    `;

    const encoded = encodeURIComponent(svgIcon.trim().replace(/\s+/g, " "));
    const dataUrl = `data:image/svg+xml;utf8,${encoded}`;

    let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = dataUrl;
  }, [theme]);

  // Set page title on mount
  useEffect(() => {
    document.title = "PyncBIN — Secure, Synced Paste & Real-time Pad";
  }, []);

  // Handle Toast notification helper
  const showToast = useCallback((msg: string, type: "success" | "error" | "info" = "success") => {
    setNotification({ msg, type });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  }, []);

  // Update URL state and query parameters
  const updateURL = (id: string | null, hashKey?: string) => {
    let newURL = window.location.origin + window.location.pathname;
    if (id) {
      newURL += `?id=${id}`;
      if (hashKey) {
        newURL += `#${hashKey}`;
      }
    }
    window.history.pushState({ path: newURL }, "", newURL);
  };

  // Callback to handle incoming WebSocket synchronization
  const handleIncomingWebSocketContent = useCallback((newContent: string) => {
    setContent((current) => {
      // Direct replace if contents differ to keep in sync
      if (current !== newContent) {
        return newContent;
      }
      return current;
    });
  }, []);

  const handleTitleUpdateFromWS = useCallback((wsTitle: string) => {
    setTitle(wsTitle);
  }, []);

  const handleLanguageUpdateFromWS = useCallback((wsLang: string) => {
    setLanguage(wsLang);
  }, []);

  // Initialize WebSocket for collaborative Pads
  const { status: wsStatus, users: activeCollaborators, updateContent, updateCursor, updateAccessMode } = usePadWebSocket({
    padId: isViewing && isPad && pasteId ? pasteId : null,
    userName: userPersona.name,
    userColor: userPersona.color,
    onIncomingContent: handleIncomingWebSocketContent,
    onTitleUpdate: handleTitleUpdateFromWS,
    onLanguageUpdate: handleLanguageUpdateFromWS,
    onAccessModeUpdate: (newMode) => {
      setPadAccessMode(newMode);
      if (!isCreator) {
        showToast(
          newMode === "readonly"
            ? "The owner has changed this Pad to Read Only mode."
            : "The owner has enabled collaboration. You can now edit!",
          "info"
        );
      }
    },
    onRevoked: (reason) => {
      if (reason === "owner-left") {
        showToast("The session has ended because the owner left.", "error");
      } else {
        showToast("This Real-time Pad has been closed or revoked.", "error");
      }
      resetToEditor();
    },
  });

  // Keep syncStatus in sync with WebSocket connection status
  useEffect(() => {
    if (isViewing && isPad && pasteId) {
      if (wsStatus === "disconnected") {
        setSyncStatus("offline");
      } else if (wsStatus === "connecting") {
        setSyncStatus("syncing");
      } else if (wsStatus === "connected") {
        setSyncStatus((prev) => (prev === "offline" || prev === "syncing" ? "synced" : prev));
      }
    } else {
      setSyncStatus("synced");
    }
  }, [wsStatus, isViewing, isPad, pasteId]);

  // Click outside to close overflow more-menu
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setMoreMenuOpen(false);
      }
    }
    if (moreMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [moreMenuOpen]);

  // Continuous Auto-Save in the background for Live Collaborative Pads
  useEffect(() => {
    if (!isViewing || !isPad || !pasteId) {
      return;
    }

    if (wsStatus === "disconnected") {
      setSyncStatus("offline");
      return;
    }

    // Skip auto-saving on initial load to prevent saving clean loaded copy
    if (initialLoadRef.current) {
      initialLoadRef.current = false;
      return;
    }

    setSyncStatus("syncing");

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        let finalTitle = title.trim() || "Untitled Note";
        let finalContent = content;

        const response = await fetch(`/api/paste/${pasteId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: finalTitle,
            content: finalContent,
            language,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to auto-save to server");
        }

        if (loadedPaste) {
          setLoadedPaste((prev) => prev ? {
            ...prev,
            title: finalTitle,
            content: finalContent,
            language,
          } : null);
        }

        setSyncStatus("synced");
      } catch (err) {
        console.warn("Background auto-save failed:", err);
        setSyncStatus("offline");
      }
    }, 1500); // 1.5 seconds debounce

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [title, content, language, isViewing, isPad, pasteId, wsStatus]);

  // Handle Manual Synchronisation
  const handleManualSync = async () => {
    if (!isViewing || !isPad || !pasteId) return;

    setSyncStatus("syncing");
    try {
      let finalTitle = title.trim() || "Untitled Note";
      let finalContent = content;

      const response = await fetch(`/api/paste/${pasteId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: finalTitle,
          content: finalContent,
          language,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to sync changes");
      }

      if (loadedPaste) {
        setLoadedPaste((prev) => prev ? {
          ...prev,
          title: finalTitle,
          content: finalContent,
          language,
        } : null);
      }

      setSyncStatus("synced");
      showToast("All changes synced successfully!", "success");
    } catch (err) {
      console.warn("Manual sync failed:", err);
      setSyncStatus("offline");
      showToast("Sync failed. Check your connection.", "error");
    }
  };

  // Track editor typing and sync content
  const handleContentChange = (val: string) => {
    if (isViewing && isPad && padAccessMode === "readonly" && !isCreator) {
      return;
    }
    setContent(val);
    if (isViewing && isPad && pasteId) {
      updateContent(val);
    }
  };

  // Track cursor caret position
  const handleCursorChange = (line: number, ch: number) => {
    if (isViewing && isPad && padAccessMode === "readonly" && !isCreator) {
      return;
    }
    if (isViewing && isPad && pasteId) {
      updateCursor(line, ch);
    }
  };

  // Fetch Paste details from API
  const fetchPaste = async (id: string, hashKey?: string, userPass?: string) => {
    setIsLoading(true);
    setErrorMsg(null);
    setRequiresDecryptionInput(false);
    setDecryptionError(null);

    try {
      let pasteData: Paste;

      // If we already have the encrypted paste data locally, use it directly instead of re-fetching!
      // This is crucial for Burn on Read pastes which are deleted from the server upon the first fetch.
      if (loadedPaste && loadedPaste.id === id && loadedPaste.encrypted) {
        pasteData = { ...loadedPaste };
      } else {
        const response = await fetch(`/api/paste/${id}`);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Paste expired, burned, or not found.");
        }
        pasteData = await response.json();
      }
      
      // Zero-knowledge encryption handling
      if (pasteData.encrypted) {
        const key = hashKey || window.location.hash.substring(1);
        
        if (!key && !userPass) {
          // Encryption active but no key provided in URL or prompt
          setRequiresDecryptionInput(true);
          setLoadedPaste(pasteData);
          setIsLoading(false);
          return;
        }

        try {
          let decryptionKey = key;
          
          if (userPass) {
            // Password protection
            decryptionKey = await deriveKeyFromPassword(userPass);
          }

          // Decrypt title and content
          let cipherTitle = pasteData.title;
          let cipherContent = pasteData.content;
          
          let decryptedTitle = "";
          if (cipherTitle.includes(":")) {
            const [iv, cipher] = cipherTitle.split(":");
            decryptedTitle = await decryptContent(cipher, iv, decryptionKey);
          } else {
            decryptedTitle = await decryptContent(cipherTitle, cipherTitle, decryptionKey);
          }

          let decryptedContent = "";
          if (cipherContent.includes(":")) {
            const [iv, cipher] = cipherContent.split(":");
            decryptedContent = await decryptContent(cipher, iv, decryptionKey);
          } else {
            decryptedContent = await decryptContent(cipherContent, pasteData.id, decryptionKey);
          }

          pasteData.title = decryptedTitle;
          pasteData.content = decryptedContent;
          setRequiresDecryptionInput(false);
          setCurrentDecryptionKey(decryptionKey);
        } catch (decErr: any) {
          console.warn("Decryption failed: Incorrect key or password.");
          setRequiresDecryptionInput(true);
          setDecryptionError("Incorrect key or password. Please try again.");
          setLoadedPaste(pasteData);
          setIsLoading(false);
          return;
        }
      }

      setLoadedPaste(pasteData);
      setTitle(pasteData.title);
      setContent(pasteData.content);
      setIsPad(pasteData.isPad);
      if (pasteData.isPad && pasteData.padAccessMode) {
        setPadAccessMode(pasteData.padAccessMode);
      } else {
        setPadAccessMode("readonly");
      }
      setLanguage(pasteData.language);
      setIsViewing(true);
      setPasteId(id);
      initialLoadRef.current = true;

      // Save to local history list
      const historyItem: HistoryItem = {
        id: pasteData.id,
        title: pasteData.title,
        isPad: pasteData.isPad,
        encrypted: pasteData.encrypted,
        language: pasteData.language,
        createdAt: pasteData.createdAt,
        secretKey: hashKey || (pasteData.encrypted ? window.location.hash.substring(1) : undefined),
      };
      
      const savedHistory = localStorage.getItem("pyncbin_history");
      const list: HistoryItem[] = savedHistory ? JSON.parse(savedHistory) : [];
      const updatedList = [historyItem, ...list.filter((x) => x.id !== historyItem.id)].slice(0, 50);
      localStorage.setItem("pyncbin_history", JSON.stringify(updatedList));

      if (pasteData.burned) {
        showToast("This is a 'Burn on Read' paste. It has been destroyed from the server.", "info");
      }
    } catch (err: any) {
      console.warn("Failed to load paste:", err);
      setErrorMsg(err.message || "Failed to load paste.");
    } finally {
      setIsLoading(false);
    }
  };

  // Scan URL for paste ID on boot
  useEffect(() => {
    if (initialFetchDone.current) return;
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    if (id) {
      initialFetchDone.current = true;
      fetchPaste(id);
    } else {
      resetToEditor();
    }
  }, []);

  // Save/Create Paste or Collaborative Pad
  const handlePublish = async () => {
    if (!content.trim()) {
      showToast("Content cannot be empty.", "error");
      return;
    }

    setIsLoading(true);
    try {
      let finalTitle = title.trim() || "Untitled Note";
      let finalContent = content;
      let hashKey: string | undefined;

      // Handle Client-Side Symmetric Encryption (Zero-Knowledge)
      if (encryptEnabled) {
        if (passwordProtect && !password.trim()) {
          showToast("Please enter a symmetric password.", "error");
          setIsLoading(false);
          return;
        }

        // Generate encryption key
        hashKey = passwordProtect 
          ? await deriveKeyFromPassword(password.trim())
          : generateRandomKey();

        // Encrypt content and title client-side
        const encryptedTitleObj = await encryptContent(finalTitle, hashKey);
        const encryptedContentObj = await encryptContent(finalContent, hashKey);

        finalTitle = `${encryptedTitleObj.iv}:${encryptedTitleObj.ciphertext}`;
        finalContent = `${encryptedContentObj.iv}:${encryptedContentObj.ciphertext}`;
      }

      // Send to Express API
      let ownerId: string | undefined;
      if (isPad) {
        let savedId = localStorage.getItem("pyncbin_userId");
        if (!savedId) {
          savedId = `user_${Math.random().toString(36).substring(2, 11)}`;
          localStorage.setItem("pyncbin_userId", savedId);
        }
        ownerId = savedId;
      }

      const response = await fetch("/api/paste", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: finalTitle,
          content: finalContent,
          isPad,
          expiration: isPad ? "never" : expiration, // Pads don't expire for persistence
          burnOnRead: isPad ? false : burnOnRead,
          language,
          encrypted: encryptEnabled,
          ownerId,
          padAccessMode: isPad ? padAccessMode : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create paste on the server.");
      }

      const result = await response.json();
      
      // Save ID to locally created list
      try {
        const createdRaw = localStorage.getItem("pyncbin_created");
        const createdList = createdRaw ? JSON.parse(createdRaw) : [];
        if (!createdList.includes(result.id)) {
          createdList.push(result.id);
          localStorage.setItem("pyncbin_created", JSON.stringify(createdList));
        }
      } catch (err) {
        console.warn("Failed to update created list:", err);
      }
      
      // If we used password-based encryption, we don't put key in URL. Otherwise, we do!
      const finalHash = (encryptEnabled && !passwordProtect) ? hashKey : undefined;
      updateURL(result.id, finalHash);
      
      // Update local view states
      setPasteId(result.id);
      setIsViewing(true);
      fetchPaste(result.id, finalHash, passwordProtect ? password.trim() : undefined);
      showToast(isPad ? "Collaborative Pad initiated! Share link to sync in real time." : "Paste published successfully!", "success");
    } catch (err: any) {
      console.warn("Publishing failed:", err);
      showToast(err.message || "An error occurred while publishing.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Reset to empty editor screen
  const resetToEditor = () => {
    initialLoadRef.current = true;
    initialFetchDone.current = false;
    setMoreMenuOpen(false);
    setPasteId(null);
    setIsViewing(false);
    setLoadedPaste(null);
    setTitle("Untitled Note");
    setContent("");
    setIsPad(false);
    setPadAccessMode("readonly");
    setExpiration("1h");
    setBurnOnRead(false);
    setEncryptEnabled(false);
    setPasswordProtect(false);
    setPassword("");
    setDecryptPassword("");
    setErrorMsg(null);
    setIsEditingStaticPaste(false);
    setCurrentDecryptionKey(null);
    updateURL(null);
  };

  const handleHistoryItemSelect = (item: HistoryItem) => {
    setHistoryOpen(false);
    updateURL(item.id, item.secretKey);
    fetchPaste(item.id, item.secretKey);
  };

  // Clone active paste/pad into new editor
  const handleFork = () => {
    setIsViewing(false);
    setPasteId(null);
    setTitle(`${title} (Fork)`);
    updateURL(null);
    showToast("Cloned into editor. Modify and publish as a new link.", "info");
  };

  // Directly save / publish edited changes back to the same note URL
  const handleSaveChanges = async () => {
    if (!pasteId) return;
    if (!content.trim()) {
      showToast("Content cannot be empty.", "error");
      return;
    }

    setIsLoading(true);
    try {
      let finalTitle = title.trim() || "Untitled Note";
      let finalContent = content;

      // Handle re-encryption if the loaded paste was encrypted!
      if (loadedPaste?.encrypted && currentDecryptionKey) {
        // Encrypt content and title with the stored key
        const encryptedTitleObj = await encryptContent(finalTitle, currentDecryptionKey);
        const encryptedContentObj = await encryptContent(finalContent, currentDecryptionKey);

        finalTitle = `${encryptedTitleObj.iv}:${encryptedTitleObj.ciphertext}`;
        finalContent = `${encryptedContentObj.iv}:${encryptedContentObj.ciphertext}`;
      }

      // Send PUT request to server
      const response = await fetch(`/api/paste/${pasteId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: finalTitle,
          content: finalContent,
          language,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update paste on the server.");
      }

      // Update loaded paste details locally so switching tabs or resetting works correctly
      if (loadedPaste) {
        setLoadedPaste({
          ...loadedPaste,
          title: finalTitle,
          content: finalContent,
          language,
        });
      }

      // If it is a collaborative live pad, let's also sync it to everyone through WS
      if (isPad) {
        updateContent(content);
      }

      setIsEditingStaticPaste(false);
      showToast("Changes published and updated successfully!", "success");
    } catch (err: any) {
      console.warn("Updating failed:", err);
      showToast(err.message || "An error occurred while updating.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Cancel direct editing and restore previous state
  const handleCancelEditing = () => {
    if (loadedPaste) {
      setTitle(loadedPaste.title);
      setContent(loadedPaste.content);
      setLanguage(loadedPaste.language);
    }
    setIsEditingStaticPaste(false);
    showToast("Editing cancelled. Reverted to saved version.", "info");
  };

  // Permanently delete/revoke a paste or pad from the server
  const handleRevokePad = async () => {
    if (!pasteId) return;

    const isCurrentPad = isPad;
    const confirmed = window.confirm(
      isCurrentPad
        ? "Are you sure you want to permanently revoke this Live Pad? This will delete the note from the server and immediately disconnect all active collaborators."
        : "Are you sure you want to permanently revoke and delete this secure paste from the server?"
    );
    if (!confirmed) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/paste/${pasteId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to revoke from server.");
      }

      showToast(
        isCurrentPad
          ? "Live Pad revoked and permanently deleted."
          : "Secure Paste revoked and permanently deleted.",
        "success"
      );
      
      // Also remove it from local history to keep history clean
      const savedHistory = localStorage.getItem("pyncbin_history");
      if (savedHistory) {
        const list: HistoryItem[] = JSON.parse(savedHistory);
        const updatedList = list.filter((item) => item.id !== pasteId);
        localStorage.setItem("pyncbin_history", JSON.stringify(updatedList));
      }

      resetToEditor();
    } catch (err: any) {
      console.warn("Revocation failed:", err);
      showToast(err.message || "Failed to revoke.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Copy current URL to clipboard
  const handleCopyLink = () => {
    let currentLink = window.location.href;
    navigator.clipboard.writeText(currentLink).then(() => {
      showToast("Link copied to clipboard!", "success");
    });
  };

  // Export raw paste content as file
  const handleDownload = () => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "_") || "paste"}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    showToast("Raw file downloaded successfully", "success");
  };

  // Update Persona details
  const savePersona = () => {
    if (!editedUserName.trim()) return;
    setUserPersona({ name: editedUserName, color: editedUserColor });
    localStorage.setItem("pyncbin_userName", editedUserName);
    localStorage.setItem("pyncbin_userColor", editedUserColor);
    setShowPersonaModal(false);
    showToast(`Persona updated: ${editedUserName}`, "success");
  };

  // Auto-detect code lines for syntax overlay or custom info
  const editorLineCount = content.split("\n").length;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#050505] text-slate-900 dark:text-[#e0e0e0] font-sans transition-colors duration-300">
      
      {/* Dynamic Toast Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 backdrop-blur-md border ${
              notification.type === "success"
                ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                : notification.type === "error"
                ? "bg-red-500/10 text-red-500 border-red-500/20"
                : "bg-blue-500/10 text-blue-500 border-blue-500/20"
            }`}
          >
            <Sparkles className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm font-medium">{notification.msg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* COMPACT COMPOSABLE HEADER */}
      <header className="sticky top-0 z-30 bg-white dark:bg-[#0a0a0a] border-b border-slate-200/50 dark:border-white/10 px-4 py-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          
          {/* Logo Brand */}
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => { window.location.href = window.location.origin + window.location.pathname; }}>
            <PyncBinLogo size={32} />
            <div className="flex flex-col">
              <span className="font-extrabold text-slate-900 dark:text-white tracking-tight leading-none text-base sm:text-lg flex items-center gap-1.5">
                <span>Pync<span className="text-rose-500 dark:text-blue-500">BIN</span></span>
                {isViewing && isPad && (
                  <span className="inline-flex h-2 w-2 relative rounded-full bg-blue-500">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  </span>
                )}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-white/40 font-mono tracking-widest uppercase font-bold">Paste. Sync. Share</span>
            </div>
          </div>

          {/* Interactive Collaborators / Connection status */}
          {isViewing && isPad ? (
            <div className={`hidden md:flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ${
              wsStatus === "connected"
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                : wsStatus === "connecting"
                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                : "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
            }`}>
              <div className={`w-1.5 h-1.5 rounded-full ${
                wsStatus === "connected" ? "bg-emerald-400 animate-pulse" : wsStatus === "connecting" ? "bg-amber-400 animate-pulse" : "bg-red-400"
              }`} />
              <span className="uppercase tracking-wider font-bold">
                {wsStatus === "connected" ? "ENCRYPTED SYNC ACTIVE" : `SYNC: ${wsStatus}`}
              </span>
            </div>
          ) : (
            <div className="hidden md:flex items-center gap-2 text-xs font-medium text-emerald-400 bg-emerald-400/10 px-2.5 py-1 rounded-full border border-emerald-500/10">
              <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></div>
              ENCRYPTED SYNC ACTIVE
            </div>
          )}

          {/* Actions controls */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            
            {/* Create New Paste Button */}
            {isViewing && (
              <button
                onClick={resetToEditor}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-transparent border border-slate-200/40 dark:border-transparent hover:bg-slate-200 dark:hover:bg-white/5 text-xs sm:text-sm font-medium text-slate-700 dark:text-white/60 dark:hover:text-white transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4 text-rose-500 dark:text-blue-500" />
                <span className="hidden sm:inline">New</span>
              </button>
            )}

            {/* Leave Pad Button */}
            {isViewing && isPad && (
              <button
                onClick={resetToEditor}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs sm:text-sm font-bold transition-all cursor-pointer"
                title="Disconnect from this real-time session"
              >
                <LogOut className="w-4 h-4 text-rose-500" />
                <span className="hidden sm:inline">Leave Pad</span>
              </button>
            )}

            {/* Change Persona profile */}
            {isViewing && isPad && (
              <button
                onClick={() => {
                  setEditedUserName(userPersona.name);
                  setEditedUserColor(userPersona.color);
                  setShowPersonaModal(true);
                }}
                className="p-1.5 sm:p-2 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200/40 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 dark:text-white/70 dark:hover:text-white transition-all cursor-pointer"
                title="Edit collaboration nickname"
              >
                <User className="w-4 h-4 text-blue-500" />
              </button>
            )}

            {/* History Button */}
            <button
              onClick={() => setHistoryOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200/40 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-white/10 text-xs sm:text-sm font-semibold text-slate-700 dark:text-white/70 dark:hover:text-white transition-all cursor-pointer"
            >
              <Clock className="w-4 h-4 text-amber-500" />
              <span className="hidden sm:inline">My Pastes</span>
            </button>

            {/* Theme Toggle */}
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-1.5 sm:p-2 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200/40 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 dark:text-white/70 dark:hover:text-white transition-all cursor-pointer"
            >
              {theme === "dark" ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
            </button>
          </div>
        </div>
      </header>

      {/* CORE WRAPPER */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex flex-col gap-6 overflow-hidden">
        
        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex-1 flex flex-col items-center justify-center h-96">
            <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
            <p className="text-sm text-slate-500 dark:text-white/40 mt-4 font-mono">Synchronizing database...</p>
          </div>
        )}

        {/* Error State */}
        {!isLoading && errorMsg && (
          <div className="flex-1 flex flex-col items-center justify-center h-96 text-center max-w-md mx-auto">
            <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
              <AlertTriangle className="w-7 h-7 text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-slate-950 dark:text-white">PyncBIN Unavailable</h3>
            <p className="text-sm text-slate-500 dark:text-white/40 mt-2">{errorMsg}</p>
            <button
              onClick={() => { window.location.href = window.location.origin + window.location.pathname; }}
              className="mt-6 px-6 py-2.5 bg-blue-600 dark:bg-white dark:text-black rounded-lg font-semibold shadow-md hover:opacity-90 transition-all text-sm cursor-pointer"
            >
              Back to Editor
            </button>
          </div>
        )}

        {/* Decryption Password Prompt */}
        {!isLoading && requiresDecryptionInput && (
          <div className="flex-1 flex items-center justify-center h-96">
            <div className="max-w-md w-full bg-white dark:bg-[#080808] border border-slate-200 dark:border-white/10 p-6 sm:p-8 rounded-2xl shadow-xl">
              <div className="flex flex-col items-center text-center mb-6">
                <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-3">
                  <Lock className="w-6 h-6 text-amber-500" />
                </div>
                <h3 className="text-lg font-bold text-slate-950 dark:text-white">Encrypted Paste</h3>
                <p className="text-xs text-slate-500 dark:text-white/35 mt-1 max-w-[280px]">
                  This note is secured with zero-knowledge AES-256 encryption. Enter the passphrase to decrypt.
                </p>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (loadedPaste) {
                    fetchPaste(loadedPaste.id, undefined, decryptPassword);
                  }
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-white/40 uppercase tracking-wider mb-1.5">
                    Decryption Password
                  </label>
                  <input
                    type="password"
                    placeholder="Enter password..."
                    value={decryptPassword}
                    onChange={(e) => setDecryptPassword(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-transparent text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                  />
                  {decryptionError && (
                    <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {decryptionError}
                    </p>
                  )}
                </div>

                <div className="flex gap-2.5">
                  <button
                    type="button"
                    onClick={() => { window.location.href = window.location.origin + window.location.pathname; }}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs sm:text-sm text-slate-600 dark:text-white/60 hover:bg-slate-50 dark:hover:bg-white/5 font-medium transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 dark:bg-white dark:text-black text-xs sm:text-sm font-semibold shadow-md hover:opacity-90 transition cursor-pointer"
                  >
                    Unlock Content
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ACTIVE LAYOUT */}
        {!isLoading && !errorMsg && !requiresDecryptionInput && (
          <div className="flex-1 flex flex-col lg:flex-row gap-6 overflow-hidden h-full">
            
            {/* LEFT / EDITING REGION */}
            <div className={`flex-1 flex flex-col gap-4 overflow-hidden h-full ${isViewing ? "w-full" : ""}`}>
              
              {/* Title, Badges & Compact Action Toolbar */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-200/30 dark:border-white/5 pb-3">
                
                {/* Title */}
                <div className="flex-1 min-w-0">
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Untitled Note..."
                    disabled={isViewing && (!isPad || !isCreator) && !isEditingStaticPaste} // only creator can edit title, and static pastes are immutable unless editing unlocked
                    className="text-lg sm:text-xl font-bold bg-transparent outline-none border-b border-transparent focus:border-blue-500 text-slate-900 dark:text-white w-full transition placeholder-slate-400 dark:placeholder-white/20"
                  />
                </div>

                {/* Badges and Actions Row (Beautifully arranged side-by-side on tablet/mobile as well) */}
                <div className="flex flex-row items-center justify-between lg:justify-end gap-3 w-full lg:w-auto">
                  {/* Status Badges */}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {isViewing ? (
                      <>
                        {isPad ? (
                          <>
                            <span className="px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-500 font-mono flex items-center gap-1.5">
                              <Radio className="w-3.5 h-3.5 animate-pulse" />
                              Live Pad
                            </span>

                            {/* Access Mode Selector / Badge */}
                            {isCreator ? (
                              <div className="inline-flex items-center gap-0.5 bg-slate-100 dark:bg-white/5 p-0.5 rounded-full border border-slate-200/40 dark:border-white/10 text-[11px] font-mono shadow-sm">
                                <button
                                  onClick={() => {
                                    setPadAccessMode("readonly");
                                    updateAccessMode("readonly");
                                    showToast("Pad set to Read Only.", "info");
                                  }}
                                  className={`px-2.5 py-0.5 rounded-full transition-all flex items-center gap-1 cursor-pointer font-medium ${
                                    padAccessMode === "readonly"
                                      ? "bg-white dark:bg-[#050505] text-[#050505] dark:text-white shadow-sm font-semibold"
                                      : "text-slate-500 dark:text-white/40 hover:text-slate-800 dark:hover:text-white"
                                  }`}
                                  title="Only you can edit this pad"
                                >
                                  <Eye className="w-3 h-3 text-blue-500" />
                                  <span>Read Only</span>
                                </button>
                                <button
                                  onClick={() => {
                                    setPadAccessMode("collaborate");
                                    updateAccessMode("collaborate");
                                    showToast("Pad set to Collaborate.", "success");
                                  }}
                                  className={`px-2.5 py-0.5 rounded-full transition-all flex items-center gap-1 cursor-pointer font-medium ${
                                    padAccessMode === "collaborate"
                                      ? "bg-white dark:bg-[#050505] text-[#050505] dark:text-white shadow-sm font-semibold"
                                      : "text-slate-500 dark:text-white/40 hover:text-slate-800 dark:hover:text-white"
                                  }`}
                                  title="Everyone can view and edit"
                                >
                                  <Users className="w-3 h-3 text-emerald-500" />
                                  <span>Collaborate</span>
                                </button>
                              </div>
                            ) : (
                              <span className={`px-2.5 py-1 rounded-full border border-slate-200/30 text-xs font-mono font-medium flex items-center gap-1 shadow-sm ${
                                padAccessMode === "collaborate"
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                              }`}>
                                {padAccessMode === "collaborate" ? (
                                  <>
                                    <Users className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
                                    <span>Collaborative</span>
                                  </>
                                ) : (
                                  <>
                                    <Eye className="w-3.5 h-3.5 text-amber-500" />
                                    <span>Read Only</span>
                                  </>
                                )}
                              </span>
                            )}

                            <button
                              onClick={handleCopyLink}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-slate-200 dark:border-blue-500/20 text-xs font-mono transition-all cursor-pointer font-medium shadow-sm"
                              title="Copy Shareable Link"
                            >
                              <Share2 className="w-3 h-3 text-blue-500" />
                              <span>Copy Link</span>
                            </button>

                            {/* Sync Status Button */}
                            <button
                              onClick={handleManualSync}
                              disabled={syncStatus === "syncing"}
                              title="Click to manually sync now"
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all text-xs font-mono cursor-pointer ${
                                syncStatus === "syncing"
                                  ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                                  : syncStatus === "offline"
                                  ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 hover:bg-rose-500/20"
                                  : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20"
                              }`}
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${syncStatus === "syncing" ? "animate-spin" : ""}`} />
                              <span>
                                {syncStatus === "syncing" ? "Syncing" : syncStatus === "offline" ? "Offline" : "Synced"}
                              </span>
                            </button>
                          </>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono font-medium">
                              Static Paste
                            </span>
                            <button
                              onClick={handleCopyLink}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-slate-200 dark:border-blue-500/20 text-xs font-mono transition-all cursor-pointer font-medium shadow-sm"
                              title="Copy Shareable Link"
                            >
                              <Share2 className="w-3.5 h-3.5 text-blue-500" />
                              <span>Copy Link</span>
                            </button>
                          </div>
                        )}

                        {loadedPaste?.encrypted && (
                          <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-500 font-mono flex items-center gap-1">
                            <Shield className="w-3.5 h-3.5" />
                            Encrypted
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 font-mono">
                        Draft mode
                      </span>
                    )}
                  </div>

                  {/* Compact Actions Toolbar (Only when viewing/collaborating) */}
                  {isViewing && (
                    <div className="flex items-center gap-2 relative justify-end">
                      {isEditingStaticPaste ? (
                        <>
                          <button
                            onClick={handleSaveChanges}
                            disabled={isLoading}
                            className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5 text-white" />
                            Save Update
                          </button>
                          <button
                            onClick={handleCancelEditing}
                            className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white/85 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-xs font-semibold transition-all cursor-pointer"
                          >
                            <XCircle className="w-3.5 h-3.5 text-slate-400" />
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          {/* Download as File Button (Primary outlined action) */}
                          <button
                            onClick={handleDownload}
                            className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white/85 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-xs font-semibold transition-all cursor-pointer"
                            title="Download as File"
                          >
                            <Download className="w-3.5 h-3.5 text-amber-500" />
                            <span className="hidden sm:inline">Download</span>
                          </button>

                          {/* More Menu Dropdown trigger */}
                          <div ref={moreMenuRef} className="relative">
                            <button
                              onClick={() => setMoreMenuOpen(!moreMenuOpen)}
                              className="p-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white/85 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-xs font-semibold transition-all cursor-pointer flex items-center justify-center"
                              title="More actions"
                            >
                              <span className="text-base font-bold leading-none px-0.5">⋯</span>
                            </button>

                            {/* ⋯ More Dropdown Menu */}
                            <AnimatePresence>
                              {moreMenuOpen && (
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.95, y: 5 }}
                                  animate={{ opacity: 1, scale: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.95, y: 5 }}
                                  className="absolute right-0 mt-1.5 w-56 rounded-xl bg-white dark:bg-[#080808] border border-slate-200 dark:border-white/10 shadow-xl z-50 py-1.5 text-xs text-slate-700 dark:text-slate-300"
                                >
                                   {/* Clone to New Draft and other actions */}
                                  <button
                                    onClick={() => {
                                      handleFork();
                                      setMoreMenuOpen(false);
                                    }}
                                    className="w-full flex items-center gap-2 px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-white/5 text-left transition-all cursor-pointer font-medium"
                                  >
                                    <Plus className="w-4 h-4 text-amber-500" />
                                    Clone to New Draft
                                  </button>



                                  {isCreator && (
                                    <>
                                      <div className="my-1.5 border-t border-slate-100 dark:border-white/5" />

                                      <button
                                        onClick={() => {
                                          handleRevokePad();
                                          setMoreMenuOpen(false);
                                        }}
                                        className="w-full flex items-center gap-2 px-3.5 py-2 hover:bg-rose-500/10 text-left transition-all cursor-pointer font-bold text-rose-600 dark:text-rose-400"
                                      >
                                        <Trash2 className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                                        {isPad ? "Delete/Revoke Pad" : "Delete/Revoke Paste"}
                                      </button>
                                    </>
                                  )}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Compact Information Metadata Row (Only when viewing/collaborating) */}
              {isViewing && (
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-[-4px]">
                  {/* Published Date */}
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-50 dark:bg-white/[0.03] border border-slate-200/40 dark:border-white/5 font-mono text-[11px]">
                    <span className="text-slate-400">Published:</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {new Date(loadedPaste?.createdAt || Date.now()).toLocaleDateString()}
                    </span>
                  </span>

                  {/* Language */}
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-50 dark:bg-white/[0.03] border border-slate-200/40 dark:border-white/5 font-mono text-[11px] uppercase">
                    <span className="text-slate-400">Language:</span>
                    <span className="font-semibold text-blue-500 dark:text-blue-400">
                      {SUPPORTED_LANGUAGES.find((l) => l.id === language)?.name || language}
                    </span>
                  </span>

                  {/* Privacy / Security Badge */}
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-50 dark:bg-white/[0.03] border border-slate-200/40 dark:border-white/5 font-mono text-[11px]">
                    <span className="text-slate-400">Privacy:</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {loadedPaste?.encrypted ? "Encrypted" : isPad ? "Collaborative" : "Public"}
                    </span>
                  </span>

                  {/* Auto Sync status */}
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-50 dark:bg-white/[0.03] border border-slate-200/40 dark:border-white/5 font-mono text-[11px]">
                    <span className="text-slate-400">Auto Sync:</span>
                    <span className={`font-semibold ${isPad ? "text-emerald-500" : "text-slate-400"}`}>
                      {isPad ? "Enabled" : "N/A (Static)"}
                    </span>
                  </span>
                </div>
              )}

              {/* View/Edit Tab Controls (Split screen / Editor toggle) */}
              <div className="flex border-b border-slate-200/50 dark:border-white/10 pb-px text-sm justify-between items-center flex-wrap gap-2">
                <div className="flex">
                  <button
                    onClick={() => setActiveTab("edit")}
                    className={`px-4 py-2 border-b-2 font-medium transition cursor-pointer flex items-center gap-1.5 ${
                      activeTab === "edit"
                        ? "border-blue-500 text-blue-500 dark:text-white"
                        : "border-transparent text-slate-500 dark:text-white/40 hover:text-slate-700 dark:hover:text-white"
                    }`}
                  >
                    {isViewing && !isPad && !isEditingStaticPaste ? (
                      <FileCode className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                    ) : (
                      <Edit3 className="w-4 h-4" />
                    )}
                    {isViewing && !isPad && !isEditingStaticPaste ? "View Raw" : "Editor"}
                  </button>
                  <button
                    onClick={() => setActiveTab("preview")}
                    className={`px-4 py-2 border-b-2 font-medium transition cursor-pointer flex items-center gap-1.5 ${
                      activeTab === "preview"
                        ? "border-blue-500 text-blue-500 dark:text-white"
                        : "border-transparent text-slate-500 dark:text-white/40 hover:text-slate-700 dark:hover:text-white"
                    }`}
                  >
                    <Eye className="w-4 h-4" />
                    Markdown Preview
                  </button>
                  <button
                    onClick={() => setActiveTab("split")}
                    className={`hidden md:flex px-4 py-2 border-b-2 font-medium transition cursor-pointer items-center gap-1.5 ${
                      activeTab === "split"
                        ? "border-blue-500 text-blue-500 dark:text-white"
                        : "border-transparent text-slate-500 dark:text-white/40 hover:text-slate-700 dark:hover:text-white"
                    }`}
                  >
                    <CheckSquare className="w-4 h-4" />
                    Split View
                  </button>
                </div>

                {/* Quick copy raw & clear paste buttons at top right corner of active view raw/editor card */}
                {(activeTab === "edit" || activeTab === "split") && (
                  <div className="flex items-center gap-2 ml-auto mr-1 mb-1">
                    {!(isViewing && !isPad && !isEditingStaticPaste) && (
                      <button
                        onClick={() => {
                          setContent("");
                          showToast("Paste content cleared!", "info");
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 border border-rose-200/50 dark:border-rose-500/20 bg-rose-50/50 dark:bg-rose-500/5 hover:bg-rose-100/50 dark:hover:bg-rose-500/10 transition-all cursor-pointer shadow-sm"
                        title="Clear all paste content"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Clear Paste</span>
                      </button>
                    )}
                    {isViewing && !isPad && !isEditingStaticPaste && isCreator && (
                      <button
                        onClick={() => {
                          setIsEditingStaticPaste(true);
                          showToast("Direct editing unlocked. Modify title or text and click Save Update.", "info");
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 border border-blue-200/50 dark:border-blue-500/20 bg-blue-50/50 dark:bg-blue-500/5 hover:bg-blue-100/50 dark:hover:bg-blue-500/10 transition-all cursor-pointer shadow-sm"
                        title="Directly edit paste"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-blue-500" />
                        <span>Edit Paste</span>
                      </button>
                    )}
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(content);
                        showToast("Code copied to clipboard!", "success");
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-950 dark:text-white/70 dark:hover:text-white border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-all cursor-pointer shadow-sm"
                      title="Copy raw content to clipboard"
                    >
                      <Copy className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Copy Raw</span>
                    </button>
                  </div>
                )}
              </div>

              {/* EDITOR / PREVIEW LAYOUT AREA */}
              <div className="flex-1 min-h-[500px] h-[600px] lg:h-[calc(100vh-240px)] relative overflow-hidden flex">
                <AnimatePresence mode="wait">
                  {activeTab === "edit" && (
                    <motion.div
                      key="tab-edit"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      transition={{ duration: 0.15 }}
                      className="w-full h-full flex flex-col"
                    >
                      <EditorWithLineNumbers
                        value={content}
                        onChange={handleContentChange}
                        onCursorChange={handleCursorChange}
                        placeholder={
                          isPad
                            ? "This is a real-time collaborative Pad. All changes are saved and synced instantly to anyone viewing."
                            : "Write or paste anything... Markdown style formatting is fully supported! Switch tabs above to see instant preview."
                        }
                        readOnly={isViewing && !isPad && !isEditingStaticPaste} // immutable if static paste unless in direct edit mode
                      />
                    </motion.div>
                  )}

                  {activeTab === "preview" && (
                    <motion.div
                      key="tab-preview"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.15 }}
                      className="w-full h-full p-6 sm:p-8 rounded-xl border border-slate-200/50 dark:border-white/10 bg-white dark:bg-[#050505] overflow-y-auto select-text scroll-smooth"
                    >
                      {content.trim() ? (
                        <MarkdownRenderer content={content} language={language} />
                      ) : (
                        <div className="flex flex-col items-center justify-center h-64 text-slate-400 dark:text-white/20">
                          <Eye className="w-10 h-10 mb-2 opacity-50" />
                          <p className="text-sm font-mono">Nothing to preview yet</p>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {activeTab === "split" && (
                    <motion.div
                      key="tab-split"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="w-full h-full flex gap-4"
                    >
                      {/* Left Editor half */}
                      <div className="flex-1 flex flex-col h-full overflow-hidden">
                        <EditorWithLineNumbers
                          value={content}
                          onChange={handleContentChange}
                          onCursorChange={handleCursorChange}
                          placeholder="Collaborate in split view..."
                          readOnly={isViewing && !isPad}
                        />
                      </div>
                      {/* Right Preview half */}
                      <div className="flex-1 p-6 rounded-xl border border-slate-200/50 dark:border-white/10 bg-white dark:bg-[#050505] overflow-y-auto select-text scroll-smooth">
                        {content.trim() ? (
                          <MarkdownRenderer content={content} language={language} />
                        ) : (
                          <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-white/20">
                            <p className="text-sm font-mono">Write on left to preview here</p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Mobile Collaborators presence indicator (under editor on small screens) */}
              {isViewing && isPad && activeCollaborators.length > 0 && (
                <div className="md:hidden flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200/40 dark:border-white/10">
                  <div className="flex items-center gap-1.5 text-xs font-mono text-slate-500">
                    <Users className="w-3.5 h-3.5 text-blue-500 animate-bounce" />
                    <span>Active:</span>
                  </div>
                  <div className="flex -space-x-1.5 overflow-hidden">
                    {activeCollaborators.map((user) => (
                      <div
                        key={user.userId}
                        className="h-5 w-5 rounded-full ring-2 ring-white dark:ring-slate-900 flex items-center justify-center text-[10px] font-bold text-white uppercase"
                        style={{ backgroundColor: user.color }}
                        title={user.userName}
                      >
                        {user.userName.charAt(0)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT SIDEBAR / SIDE OPTIONS PANEL */}
            {!isViewing && (
              <div className="w-full lg:w-80 flex flex-col gap-4">
                
                {/* Main controls configuration Card */}
                <div className="bg-white dark:bg-[#080808] border border-slate-200/50 dark:border-white/10 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col gap-4">
                  
                  <h4 className="font-bold text-sm uppercase tracking-wider text-slate-400 dark:text-white/30 flex items-center gap-2">
                    <Settings className="w-4 h-4 text-blue-500" />
                    Configuration
                  </h4>

                  {/* EDIT/VIEW CONTROLS OVERVIEW */}
                  {!isViewing ? (
                    <>
                      {/* MODE SELECTOR (Paste vs Collaborative Pad) */}
                      <div className="space-y-2">
                        <label className="block text-xs font-semibold text-slate-500 dark:text-white/40 uppercase tracking-wide">
                          Paste Type
                        </label>
                        <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-white/5 p-1 rounded-xl border border-slate-200/40 dark:border-white/10">
                          <button
                            type="button"
                            onClick={() => setIsPad(false)}
                            className={`py-2 px-3 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                              !isPad
                                ? "bg-white dark:bg-[#050505] text-[#050505] dark:text-white shadow-sm"
                                : "text-slate-500 dark:text-white/40 hover:text-slate-800 dark:hover:text-white"
                            }`}
                          >
                            <Shield className="w-3.5 h-3.5" />
                            Static Paste
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIsPad(true);
                              setEncryptEnabled(false); // standard pads shouldn't enforce base AESGCM encryption over live edits
                            }}
                            className={`py-2 px-3 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                              isPad
                                ? "bg-white dark:bg-[#050505] text-[#050505] dark:text-white shadow-sm"
                                : "text-slate-500 dark:text-white/40 hover:text-slate-800 dark:hover:text-white"
                            }`}
                          >
                            <Radio className="w-3.5 h-3.5" />
                            Live Pad
                          </button>
                        </div>
                      </div>

                      {/* LIVE PAD ACCESS MODE (Only when isPad is true) */}
                      {isPad && (
                        <div className="space-y-2 pt-1 border-t border-slate-200/40 dark:border-white/10">
                          <label className="block text-xs font-semibold text-slate-500 dark:text-white/40 uppercase tracking-wide">
                            Access Mode
                          </label>
                          <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-white/5 p-1 rounded-xl border border-slate-200/40 dark:border-white/10">
                            <button
                              type="button"
                              onClick={() => setPadAccessMode("readonly")}
                              className={`py-2 px-3 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                                padAccessMode === "readonly"
                                  ? "bg-white dark:bg-[#050505] text-[#050505] dark:text-white shadow-sm"
                                  : "text-slate-500 dark:text-white/40 hover:text-slate-800 dark:hover:text-white"
                              }`}
                            >
                              <Eye className="w-3.5 h-3.5 text-blue-500" />
                              Read Only
                            </button>
                            <button
                              type="button"
                              onClick={() => setPadAccessMode("collaborate")}
                              className={`py-2 px-3 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                                padAccessMode === "collaborate"
                                  ? "bg-white dark:bg-[#050505] text-[#050505] dark:text-white shadow-sm"
                                  : "text-slate-500 dark:text-white/40 hover:text-slate-800 dark:hover:text-white"
                              }`}
                            >
                              <Users className="w-3.5 h-3.5 text-emerald-500" />
                              Collaborate
                            </button>
                          </div>
                        </div>
                      )}

                      {/* SYNTAX HIGHLIGHTING & EXPIRATION SELECTORS */}
                      <div className={!isPad ? "grid grid-cols-2 lg:grid-cols-1 gap-4" : "space-y-1.5"}>
                        {/* SYNTAX HIGHLIGHTING SELECTOR */}
                        <div className="space-y-1.5">
                          <label className="block text-xs font-semibold text-slate-500 dark:text-white/40 uppercase tracking-wide">
                            Language highlight
                          </label>
                          <div className="relative">
                            <select
                              value={language}
                              onChange={(e) => setLanguage(e.target.value)}
                              className="w-full pl-3 pr-10 py-2 text-sm rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-800 dark:text-white focus:outline-none focus:border-blue-500 transition-all cursor-pointer appearance-none"
                            >
                              {SUPPORTED_LANGUAGES.map((lang) => (
                                <option key={lang.id} value={lang.id} className="dark:bg-[#080808] dark:text-white">
                                  {lang.name}
                                </option>
                              ))}
                            </select>
                            <div className="absolute inset-y-0 right-0 flex items-center pr-3.5 pointer-events-none">
                              <ChevronsUpDown className="w-4 h-4 text-slate-400 dark:text-white/40" />
                            </div>
                          </div>
                        </div>

                        {/* EXPIRATION TIMEOUT (Hidden for collaborative pads since they should remain durable) */}
                        {!isPad && (
                          <div className="space-y-1.5">
                            <label className="block text-xs font-semibold text-slate-500 dark:text-white/40 uppercase tracking-wide">
                              Expiration Expiry
                            </label>
                            <div className="relative">
                              <select
                                value={expiration}
                                onChange={(e) => setExpiration(e.target.value as ExpirationOption)}
                                className="w-full pl-3 pr-10 py-2 text-sm rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-800 dark:text-white focus:outline-none focus:border-blue-500 transition-all cursor-pointer appearance-none"
                              >
                                <option value="5m" className="dark:bg-[#080808] dark:text-white">5 Minutes</option>
                                <option value="10m" className="dark:bg-[#080808] dark:text-white">10 Minutes</option>
                                <option value="30m" className="dark:bg-[#080808] dark:text-white">30 Minutes</option>
                                <option value="1h" className="dark:bg-[#080808] dark:text-white">1 Hour</option>
                                <option value="1d" className="dark:bg-[#080808] dark:text-white">1 Day</option>
                                <option value="1w" className="dark:bg-[#080808] dark:text-white">1 Week</option>
                                <option value="1m" className="dark:bg-[#080808] dark:text-white">1 Month</option>
                              </select>
                              <div className="absolute inset-y-0 right-0 flex items-center pr-3.5 pointer-events-none">
                                <ChevronsUpDown className="w-4 h-4 text-slate-400 dark:text-white/40" />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* SYMMETRIC CLIENT ENCRYPTION (Password Protected) */}
                      {!isPad && (
                        <div className="space-y-2 pt-1 border-t border-slate-200/40 dark:border-white/10">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-semibold text-slate-500 dark:text-white/40 uppercase tracking-wide flex items-center gap-1.5">
                              <Lock className="w-3.5 h-3.5 text-blue-500" />
                              Password Protected
                            </label>
                            <input
                              type="checkbox"
                              checked={passwordProtect}
                              onChange={(e) => {
                                const val = e.target.checked;
                                setPasswordProtect(val);
                                setEncryptEnabled(val);
                              }}
                              className="rounded border-slate-300 dark:border-white/10 bg-transparent text-blue-500 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                            />
                          </div>

                          {passwordProtect && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              className="space-y-3 pt-2"
                            >
                              <div>
                                <input
                                  type="password"
                                  placeholder="Type manual password..."
                                  value={password}
                                  onChange={(e) => setPassword(e.target.value)}
                                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 focus:outline-none focus:border-blue-500 transition-all text-slate-800 dark:text-white"
                                />
                                <p className="text-[10px] text-slate-400 dark:text-white/30 mt-1">
                                  This note will be encrypted client-side. Readers must manually enter this password to view.
                                </p>
                              </div>
                            </motion.div>
                          )}
                        </div>
                      )}

                      {/* SUBMIT BUTTON */}
                      <button
                        onClick={handlePublish}
                        className="w-full mt-2 py-3 px-4 rounded-xl bg-blue-600 dark:bg-white text-white dark:text-black font-bold text-sm shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 hover:opacity-95 transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Sparkles className="w-4.5 h-4.5 text-white dark:text-black" />
                        {isPad ? "Launch Real-time Pad" : "Publish Secure Paste"}
                      </button>
                    </>
                  ) : null}
                </div>

                {/* Security Warning Notice */}
                <div className="p-4 rounded-2xl bg-slate-100 dark:bg-white/[0.02] border border-slate-200/40 dark:border-white/10 flex gap-3 text-xs leading-normal">
                  <Shield className="w-5 h-5 text-blue-500 flex-shrink-0" />
                  <div className="text-slate-500 dark:text-white/45 space-y-1">
                    <p className="font-semibold text-slate-800 dark:text-white/85">Zero-Knowledge Security</p>
                    <p>
                      Encryption keys are maintained exclusively on the client. PyncBIN servers store encrypted data only and cannot read your note.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* PEOPLES/NICKNAME MULTIPLAYER PROFILE DRAWER MODAL */}
      <AnimatePresence>
        {showPersonaModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPersonaModal(false)}
              className="fixed inset-0 bg-black z-40"
              id="persona-modal-backdrop"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="fixed inset-0 m-auto max-w-sm h-fit max-h-[90vh] bg-white dark:bg-[#080808] border border-slate-200 dark:border-white/10 p-6 rounded-2xl shadow-2xl z-50 flex flex-col gap-5"
              id="persona-modal"
            >
              <div className="flex flex-col gap-1 text-center">
                <h3 className="font-bold text-slate-900 dark:text-white text-lg">Pad Pen Name</h3>
                <p className="text-xs text-slate-500 dark:text-white/40">
                  Choose a nickname and avatar color to represent yourself on real-time pads.
                </p>
              </div>

              <div className="space-y-4">
                {/* Username Input */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-white/40 uppercase tracking-wide mb-1">
                    Collaboration Pseudonym
                  </label>
                  <input
                    type="text"
                    value={editedUserName}
                    onChange={(e) => setEditedUserName(e.target.value.substring(0, 30))}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-transparent text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                  />
                </div>

                {/* Color Selection Presets */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-white/40 uppercase tracking-wide mb-2">
                    Avatar Accent Color
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setEditedUserColor(c)}
                        className={`h-7 w-full rounded-lg transition border relative flex items-center justify-center cursor-pointer ${
                          editedUserColor === c ? "border-slate-900 dark:border-white scale-105" : "border-transparent"
                        }`}
                        style={{ backgroundColor: c }}
                      >
                        {editedUserColor === c && <Check className="w-3.5 h-3.5 text-white stroke-[3px]" />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  onClick={() => setShowPersonaModal(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs sm:text-sm text-slate-600 dark:text-white/40 hover:bg-slate-50 dark:hover:bg-white/5 font-semibold transition-all cursor-pointer"
                >
                  Close
                </button>
                <button
                  onClick={savePersona}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 dark:bg-white dark:text-black text-white text-xs sm:text-sm font-semibold shadow-md hover:opacity-90 transition cursor-pointer"
                >
                  Save Persona
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* PAST VISITS HISTORY DRAWER */}
      <HistoryDrawer
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onSelect={handleHistoryItemSelect}
        currentId={pasteId || undefined}
      />
    </div>
  );
}
