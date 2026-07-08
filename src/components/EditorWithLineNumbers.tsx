import React, { useRef, useEffect, useLayoutEffect, useState, useMemo, useCallback } from "react";

interface EditorWithLineNumbersProps {
  value: string;
  onChange: (value: string) => void;
  onCursorChange?: (line: number, ch: number) => void;
  placeholder?: string;
  readOnly?: boolean;
}

export function EditorWithLineNumbers({
  value,
  onChange,
  onCursorChange,
  placeholder = "Write or paste your code here...",
  readOnly = false,
}: EditorWithLineNumbersProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineCounterRef = useRef<HTMLDivElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const [cursorPos, setCursorPos] = useState({ line: 1, ch: 1 });
  const [lineHeights, setLineHeights] = useState<number[]>([]);

  // Compute lines
  const lines = useMemo(() => {
    const splitLines = value.split("\n");
    // Always have at least 1 line
    return splitLines.length === 0 ? [""] : splitLines;
  }, [value]);

  // Sync scroll of lines and textarea
  const handleScroll = () => {
    if (textareaRef.current && lineCounterRef.current) {
      lineCounterRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  // Handle Tab indentation inside textarea
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab" && textareaRef.current) {
      e.preventDefault();
      const start = textareaRef.current.selectionStart;
      const end = textareaRef.current.selectionEnd;

      // Insert 2 spaces
      const newValue = value.substring(0, start) + "  " + value.substring(end);
      onChange(newValue);

      // Reset selection range
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 2;
        }
      }, 0);
    }
  };

  // Update selection/cursor details
  const updateCursorDetails = () => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const textBeforeCursor = value.substring(0, start);
    const linesBefore = textBeforeCursor.split("\n");
    const currentLine = linesBefore.length;
    const currentChar = linesBefore[linesBefore.length - 1].length + 1;

    setCursorPos({ line: currentLine, ch: currentChar });

    if (onCursorChange) {
      onCursorChange(currentLine, currentChar);
    }
  };

  // Function to update measured line heights
  const updateLineHeights = useCallback(() => {
    if (!textareaRef.current || !mirrorRef.current) return;

    const width = textareaRef.current.clientWidth; // exact content width excluding scrollbars
    if (width === 0) return; // Wait until container layout is fully initialized and has width

    const style = window.getComputedStyle(textareaRef.current);

    mirrorRef.current.style.width = `${width}px`;
    mirrorRef.current.style.paddingLeft = style.paddingLeft;
    mirrorRef.current.style.paddingRight = style.paddingRight;
    mirrorRef.current.style.fontFamily = style.fontFamily;
    mirrorRef.current.style.fontSize = style.fontSize;
    mirrorRef.current.style.lineHeight = style.lineHeight;

    const children = mirrorRef.current.children;
    const heights: number[] = [];
    for (let i = 0; i < children.length; i++) {
      heights.push((children[i] as HTMLElement).offsetHeight);
    }
    setLineHeights(heights);
  }, [lines]);

  // Keep line scrolling synced if value changes (e.g. from websocket sync)
  useEffect(() => {
    handleScroll();
  }, [value]);

  // Recalculate heights on changes
  useLayoutEffect(() => {
    updateLineHeights();
  }, [value, updateLineHeights]);

  // Recalculate heights on window / container resize
  useEffect(() => {
    if (!textareaRef.current) return;
    const observer = new ResizeObserver(() => {
      updateLineHeights();
    });
    observer.observe(textareaRef.current);
    return () => observer.disconnect();
  }, [updateLineHeights]);

  // Count words
  const wordCount = useMemo(() => {
    if (!value.trim()) return 0;
    return value.trim().split(/\s+/).length;
  }, [value]);

  return (
    <div className="flex flex-col flex-1 h-full min-h-[400px] border border-slate-200/50 dark:border-white/10 rounded-xl bg-white dark:bg-[#050505] backdrop-blur-md overflow-hidden relative shadow-sm w-full max-w-full box-border">
      <div className="flex flex-1 overflow-hidden relative h-full w-full max-w-full box-border">
        {/* Line Numbers */}
        <div
          ref={lineCounterRef}
          className="w-12 bg-slate-50 dark:bg-[#080808] border-r border-slate-200/40 dark:border-white/5 select-none overflow-hidden text-right pr-3 font-mono text-xs text-slate-400 dark:text-white/20 scrollbar-none box-border flex-shrink-0"
          style={{
            paddingTop: "16px",
            paddingBottom: "16px",
            lineHeight: "24px",
          }}
        >
          {lines.map((_, idx) => {
            const height = lineHeights[idx] || 24; // fallback to 24px (leading-6)
            return (
              <div
                key={idx}
                style={{
                  height: `${height}px`,
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "flex-end",
                  boxSizing: "border-box",
                }}
              >
                {idx + 1}
              </div>
            );
          })}
        </div>

        {/* Text Area Input */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={handleScroll}
          onKeyDown={handleKeyDown}
          onSelect={updateCursorDetails}
          onKeyUp={updateCursorDetails}
          onClick={updateCursorDetails}
          placeholder={placeholder}
          readOnly={readOnly}
          className="flex-1 bg-transparent outline-none border-none font-mono text-sm text-slate-800 dark:text-[#e0e0e0] placeholder-slate-400 dark:placeholder-white/20 resize-none h-full overflow-y-auto overflow-x-hidden min-h-full scroll-smooth select-text box-border w-full max-w-full"
          id="pad-editor-textarea"
          style={{
            paddingTop: "16px",
            paddingBottom: "16px",
            paddingLeft: "16px",
            paddingRight: "16px",
            lineHeight: "24px",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        />
      </div>

      {/* Footer Info bar */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2 border-t border-slate-200/50 dark:border-white/5 bg-slate-50 dark:bg-[#0a0a0a] text-xs font-mono text-slate-500 dark:text-white/30">
        <div className="flex gap-4">
          <span>{lines.length} lines</span>
          <span>{wordCount} words</span>
          <span>{value.length} characters</span>
        </div>
        <div className="flex gap-1 items-center">
          <span className="text-slate-400 dark:text-white/20">Ln</span> {cursorPos.line},{" "}
          <span className="text-slate-400 dark:text-white/20">Col</span> {cursorPos.ch}
        </div>
      </div>

      {/* Hidden mirror element for line height measurement - placed off-screen */}
      <div
        ref={mirrorRef}
        className="fixed invisible pointer-events-none select-none"
        style={{
          left: "-9999px",
          top: "-9999px",
          width: "100px",
          height: "auto",
          overflow: "hidden",
          boxSizing: "border-box",
        }}
      >
        {lines.map((line, idx) => (
          <div
            key={idx}
            style={{
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              minHeight: "24px",
              boxSizing: "border-box",
            }}
          >
            {line === "" ? "\u200b" : line}
          </div>
        ))}
      </div>
    </div>
  );
}
