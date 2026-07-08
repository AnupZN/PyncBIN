import React, { useEffect, useState } from "react";
import { HistoryItem } from "../types";
import { Clock, Copy, Check, Trash2, X, ExternalLink, Shield } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (item: HistoryItem) => void;
  currentId?: string;
}

export function HistoryDrawer({ isOpen, onClose, onSelect, currentId }: HistoryDrawerProps) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  // Load history on mount or open
  useEffect(() => {
    if (isOpen) {
      try {
        const data = localStorage.getItem("pyncbin_history");
        if (data) {
          setItems(JSON.parse(data));
        }
      } catch (err) {
        console.error("Error loading history:", err);
      }
      // Reset confirmation when opened
      setConfirmClear(false);
    }
  }, [isOpen]);

  const handleCopyLink = (e: React.MouseEvent, item: HistoryItem) => {
    e.stopPropagation();
    
    // Construct full link
    let url = `${window.location.origin}/?id=${item.id}`;
    if (item.secretKey) {
      url += `#${item.secretKey}`;
    }

    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const handleClearHistory = () => {
    const confirmed = window.confirm("Are you sure you want to clear your local paste history? This cannot be undone.");
    if (!confirmed) return;

    localStorage.removeItem("pyncbin_history");
    setItems([]);
  };

  const handleDeleteItem = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updated = items.filter((item) => item.id !== id);
    localStorage.setItem("pyncbin_history", JSON.stringify(updated));
    setItems(updated);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black z-40"
            id="history-drawer-backdrop"
          />

          {/* Drawer Panel */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 220 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white dark:bg-[#080808] border-l border-slate-200 dark:border-white/10 shadow-2xl z-50 flex flex-col h-full"
            id="history-drawer"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-white/10">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-500" />
                <h3 className="font-semibold text-slate-900 dark:text-white text-lg">My PyncBINs</h3>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 dark:text-white/40 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* List Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <div className="w-12 h-12 rounded-full bg-slate-50 dark:bg-white/5 border border-slate-200/50 dark:border-white/10 flex items-center justify-center mb-3">
                    <Clock className="w-5 h-5 text-slate-400 dark:text-white/40" />
                  </div>
                  <p className="text-slate-500 dark:text-white/60 font-medium">No history saved</p>
                  <p className="text-xs text-slate-400 dark:text-white/30 mt-1 max-w-[240px]">
                    Pastes or collaborative pads you create or join will appear here.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {items.map((item) => {
                    const isCurrent = item.id === currentId;
                    const formattedDate = new Date(item.createdAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    });

                    return (
                      <div
                        key={item.id}
                        onClick={() => onSelect(item)}
                        className={`group relative flex flex-col p-4 rounded-xl border transition text-left cursor-pointer ${
                          isCurrent
                            ? "bg-rose-50/30 dark:bg-blue-500/10 border-rose-500/50 dark:border-blue-500/30"
                            : "bg-slate-50/50 hover:bg-slate-50 dark:bg-white/5 dark:hover:bg-white/10 border-slate-100 dark:border-white/5 hover:border-slate-200 dark:hover:border-white/10"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-medium text-slate-800 dark:text-white text-sm line-clamp-1 pr-6">
                            {item.title}
                          </div>
                          
                          {/* Badge indicators */}
                          <div className="flex gap-1 items-center">
                            {item.encrypted && (
                              <span className="p-0.5 rounded text-blue-400 bg-blue-500/10" title="Client-Side Encrypted">
                                <Shield className="w-3.5 h-3.5" />
                              </span>
                            )}
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono uppercase font-semibold ${
                              item.isPad
                                ? "bg-blue-500/10 text-blue-400"
                                : "bg-emerald-500/10 text-emerald-400"
                            }`}>
                              {item.isPad ? "Pad" : "Paste"}
                            </span>
                          </div>
                        </div>

                        {/* Subtext info */}
                        <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-white/30 mt-2 font-mono">
                          <span>{formattedDate}</span>
                          <span className="capitalize">{item.language}</span>
                        </div>

                        {/* Action buttons revealed on hover */}
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 flex items-center gap-1.5 transition-all bg-gradient-to-l from-slate-50 dark:from-[#080808] pl-4 py-1">
                          <button
                            onClick={(e) => handleCopyLink(e, item)}
                            className="p-1 rounded-md bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-white/10 text-slate-500 dark:text-white/60 hover:text-blue-500 dark:hover:text-blue-400 hover:border-blue-300 dark:hover:border-blue-500/30 transition-all cursor-pointer"
                            title="Copy link"
                          >
                            {copiedId === item.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={(e) => handleDeleteItem(e, item.id)}
                            className="p-1 rounded-md bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-white/10 text-slate-500 dark:text-white/60 hover:text-red-500 hover:border-red-300 dark:hover:text-red-400 dark:hover:border-red-500/30 transition-all cursor-pointer"
                            title="Remove from history"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer with Clear all */}
            {items.length > 0 && (
              <div className="p-6 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20">
                <button
                  onClick={handleClearHistory}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 dark:border-red-900/30 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 font-medium text-sm transition-all cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear All History
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
