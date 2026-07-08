import React, { useMemo } from "react";

interface MarkdownRendererProps {
  content: string;
  language?: string; // fallback if no lang in code blocks
}

export function MarkdownRenderer({ content, language }: MarkdownRendererProps) {
  // Syntax highlighter for code blocks
  const highlightCode = (code: string, lang: string): React.ReactNode => {
    const l = (lang || language || "plaintext").toLowerCase();
    
    // Escape HTML first to prevent injection in code blocks
    let escaped = code
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    if (l === "plaintext" || l === "text") {
      return <code dangerouslySetInnerHTML={{ __html: escaped }} />;
    }

    // Highlighting tokens mapping
    const rules: { regex: RegExp; className: string }[] = [];

    if (l === "javascript" || l === "typescript" || l === "js" || l === "ts") {
      rules.push(
        // Comments (single line and multi line)
        { regex: /(\/\/.*)/g, className: "text-slate-500 italic" },
        { regex: /(\/\*[\s\S]*?\*\/)/g, className: "text-slate-500 italic" },
        // Strings
        { regex: /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g, className: "text-emerald-400" },
        // Keywords
        { regex: /\b(const|let|var|function|return|import|export|from|class|extends|new|if|else|for|while|do|switch|case|break|continue|default|try|catch|finally|throw|async|await|yield|type|interface|enum|public|private|protected|static|readonly|as|keyof|typeof|any|string|number|boolean|void|never|unknown|null|undefined)\b/g, className: "text-rose-400 font-semibold" },
        // Constants/Booleans
        { regex: /\b(true|false|NaN|Infinity)\b/g, className: "text-amber-400 font-medium" },
        // Functions
        { regex: /\b([a-zA-Z_$][a-zA-Z0-9_$]*)(?=\()/g, className: "text-sky-400" },
        // Numbers
        { regex: /\b(\d+(\.\d+)?)\b/g, className: "text-amber-300" }
      );
    } else if (l === "python" || l === "py") {
      rules.push(
        // Comments
        { regex: /(#.*)/g, className: "text-slate-500 italic" },
        // Strings
        { regex: /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|"""[\s\S]*?"""|'''[\s\S]*?''')/g, className: "text-emerald-400" },
        // Keywords
        { regex: /\b(def|class|return|if|elif|else|for|while|in|is|not|and|or|import|from|as|try|except|finally|raise|assert|with|lambda|pass|break|continue|global|nonlocal|None|True|False|yield|async|await)\b/g, className: "text-rose-400 font-semibold" },
        // Decorators
        { regex: /(@[a-zA-Z0-9_.]+)/g, className: "text-violet-400" },
        // Builtins
        { regex: /\b(print|len|range|str|int|float|list|dict|set|tuple|open|type|enumerate|zip|sum|min|max|abs|map|filter)\b/g, className: "text-sky-400" },
        // Numbers
        { regex: /\b(\d+(\.\d+)?)\b/g, className: "text-amber-300" }
      );
    } else if (l === "json") {
      rules.push(
        // Keys
        { regex: /("[a-zA-Z0-9_$]+"\s*)(?=:)/g, className: "text-rose-400 font-semibold" },
        // Strings
        { regex: /("(?:[^"\\]|\\.)*")/g, className: "text-emerald-400" },
        // Booleans & Null
        { regex: /\b(true|false|null)\b/g, className: "text-amber-400 font-medium" },
        // Numbers
        { regex: /\b(-?\d+(\.\d+)?)\b/g, className: "text-amber-300" }
      );
    } else if (l === "html" || l === "xml") {
      rules.push(
        // Comments
        { regex: /(&lt;!--[\s\S]*?--&gt;)/g, className: "text-slate-500 italic" },
        // Tag Names
        { regex: /(&lt;\/?[a-zA-Z0-9:-]+)/g, className: "text-rose-400 font-semibold" },
        // Attribute values
        { regex: /(=&quot;.*?&quot;|=&#39;.*?&#39;)/g, className: "text-emerald-400" },
        // Attribute Names
        { regex: /\b([a-zA-Z0-9:-]+)(?=\s*=)/g, className: "text-sky-400" },
        // Closing tag markers
        { regex: /(&gt;)/g, className: "text-rose-400" }
      );
    } else if (l === "css") {
      rules.push(
        // Comments
        { regex: /(\/\*[\s\S]*?\*\/)/g, className: "text-slate-500 italic" },
        // Selectors
        { regex: /([.#a-zA-Z0-9_:-]+)(?=\s*\{)/g, className: "text-rose-400 font-semibold" },
        // Properties
        { regex: /([a-zA-Z-]+)(?=\s*:)/g, className: "text-sky-400" },
        // Values
        { regex: /(:\s*[^;{}]+)/g, className: "text-emerald-300" }
      );
    } else if (l === "sql") {
      rules.push(
        // Comments
        { regex: /(--.*)/g, className: "text-slate-500 italic" },
        // Keywords (upper or lower)
        { regex: /\b(SELECT|FROM|WHERE|INSERT|INTO|UPDATE|SET|DELETE|CREATE|TABLE|ALTER|DROP|INDEX|JOIN|LEFT|RIGHT|INNER|OUTER|ON|AND|OR|NOT|IN|LIKE|IS|NULL|GROUP|BY|ORDER|HAVING|LIMIT|AS|UNION|VALUES|select|from|where|insert|into|update|set|delete|create|table|alter|drop|index|join|on|and|or|not|group|by|order|limit|as)\b/g, className: "text-rose-400 font-semibold" },
        // Strings
        { regex: /('(?:[^'\\]|\\.)*')/g, className: "text-emerald-400" },
        // Numbers
        { regex: /\b(\d+(\.\d+)?)\b/g, className: "text-amber-300" }
      );
    } else if (l === "sh" || l === "bash" || l === "shell") {
      rules.push(
        // Comments
        { regex: /(#.*)/g, className: "text-slate-500 italic" },
        // Keywords
        { regex: /\b(echo|exit|cd|ls|cat|mkdir|rm|cp|mv|sudo|apt|npm|git|docker|curl|wget|grep|awk|sed|if|then|else|fi|for|in|do|done|while)\b/g, className: "text-rose-400 font-semibold" },
        // Strings
        { regex: /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, className: "text-emerald-400" }
      );
    }

    // Apply highlighting rules in sequence
    // To prevent tags nested matching, we replace tokens with temporary markers, then reconstruct
    let tokens: { id: string; html: string }[] = [];
    let counter = 0;

    rules.forEach((rule) => {
      escaped = escaped.replace(rule.regex, (match) => {
        const id = `__TOKEN_${counter++}__`;
        tokens.push({
          id,
          html: `<span class="${rule.className}">${match}</span>`,
        });
        return id;
      });
    });

    // Reconstruct
    // Run backward to prevent nested token issues if any
    for (let i = tokens.length - 1; i >= 0; i--) {
      escaped = escaped.replace(new RegExp(tokens[i].id, "g"), tokens[i].html);
    }

    return <code dangerouslySetInnerHTML={{ __html: escaped }} />;
  };

  // Fast custom Markdown compiler
  const parsedElements = useMemo(() => {
    if (!content) return [];

    const lines = content.split("\n");
    const elements: React.ReactNode[] = [];
    let inCodeBlock = false;
    let codeContent: string[] = [];
    let codeLanguage = "plaintext";
    let inList = false;
    let listItems: React.ReactNode[] = [];
    let isOrderedList = false;

    // Helper to render inline markdown (bold, italic, inline code, links)
    const renderInline = (text: string): React.ReactNode => {
      let escaped = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

      // Checkbox [ ] and [x]
      escaped = escaped.replace(/^\[ \]\s(.*)/g, '<span class="inline-flex items-center gap-2"><input type="checkbox" disabled class="rounded border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-[#080808] text-blue-500 focus:ring-0" /> $1</span>');
      escaped = escaped.replace(/^\[x\]\s(.*)/g, '<span class="inline-flex items-center gap-2"><input type="checkbox" checked disabled class="rounded border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-[#080808] text-blue-500 focus:ring-0" /> <span class="line-through text-slate-400 dark:text-white/40">$1</span></span>');

      // Inline code `code`
      escaped = escaped.replace(/`([^`]+)`/g, '<code class="bg-slate-100 dark:bg-white/5 px-1.5 py-0.5 rounded text-blue-600 dark:text-blue-400 font-mono text-sm border border-slate-200 dark:border-white/5">$1</code>');

      // Bold **text** or __text__
      escaped = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-bold text-slate-900 dark:text-white">$1</strong>');
      escaped = escaped.replace(/__([^_]+)__/g, '<strong class="font-bold text-slate-900 dark:text-white">$1</strong>');

      // Italic *text* or _text_
      escaped = escaped.replace(/\*([^*]+)\*/g, '<em class="italic text-slate-700 dark:text-white/70">$1</em>');
      escaped = escaped.replace(/_([^_]+)_/g, '<em class="italic text-slate-700 dark:text-white/70">$1</em>');

      // Strikethrough ~~text~~
      escaped = escaped.replace(/~~([^~]+)~~/g, '<span class="line-through text-slate-400 dark:text-white/30">$1</span>');

      // Images ![alt](url)
      escaped = escaped.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" referrerPolicy="no-referrer" class="max-w-full h-auto rounded-lg my-2 border border-slate-200 dark:border-white/10" />');

      // Links [text](url)
      escaped = escaped.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 underline transition">$1</a>');

      return <span dangerouslySetInnerHTML={{ __html: escaped }} />;
    };

    // Close any open lists
    const flushList = (key: number) => {
      if (listItems.length > 0) {
        if (isOrderedList) {
          elements.push(
            <ol key={`ol-${key}`} className="list-decimal pl-6 my-3 space-y-1 text-slate-800 dark:text-white/80">
              {listItems}
            </ol>
          );
        } else {
          elements.push(
            <ul key={`ul-${key}`} className="list-disc pl-6 my-3 space-y-1 text-slate-800 dark:text-white/80">
              {listItems}
            </ul>
          );
        }
        listItems = [];
        inList = false;
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Code Block Toggle
      if (line.trim().startsWith("```")) {
        if (inCodeBlock) {
          // Close Code Block
          const codeText = codeContent.join("\n");
          const lang = codeLanguage;
          elements.push(
            <div key={`codeblock-${i}`} className="relative my-4 group rounded-xl overflow-hidden border border-white/10 bg-[#0a0a0a]">
              <div className="flex items-center justify-between px-4 py-1.5 bg-white/[0.02] border-b border-white/5 text-xs font-mono text-white/40">
                <span>{lang || "code"}</span>
                <button
                  id={`btn-copy-${i}`}
                  onClick={() => navigator.clipboard.writeText(codeText)}
                  className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 hover:text-white transition-all cursor-pointer"
                >
                  Copy
                </button>
              </div>
              <pre className="p-4 overflow-x-auto text-sm font-mono text-[#e0e0e0]">
                {highlightCode(codeText, lang)}
              </pre>
            </div>
          );
          codeContent = [];
          inCodeBlock = false;
        } else {
          // Open Code Block
          flushList(i);
          inCodeBlock = true;
          codeLanguage = line.trim().substring(3).trim();
        }
        continue;
      }

      if (inCodeBlock) {
        codeContent.push(line);
        continue;
      }

      // Headers
      if (line.startsWith("#")) {
        flushList(i);
        const match = line.match(/^(#{1,6})\s+(.*)$/);
        if (match) {
          const level = match[1].length;
          const text = match[2];
          const className = [
            "",
            "text-3xl font-bold text-slate-900 dark:text-white tracking-tight mt-6 mb-3 border-b border-slate-200 dark:border-white/10 pb-2",
            "text-2xl font-bold text-slate-900 dark:text-white tracking-tight mt-5 mb-2.5",
            "text-xl font-semibold text-slate-800 dark:text-white/90 mt-4 mb-2",
            "text-lg font-semibold text-slate-800 dark:text-white/85 mt-4 mb-2",
            "text-base font-semibold text-slate-800 dark:text-white/80 mt-3 mb-1.5",
            "text-sm font-semibold text-slate-500 dark:text-white/50 uppercase tracking-wider mt-3 mb-1.5",
          ][level];

          elements.push(
            React.createElement(
              `h${level}`,
              { key: `h-${i}`, className, id: `header-${i}` },
              renderInline(text)
            )
          );
          continue;
        }
      }

      // Blockquotes
      if (line.trim().startsWith(">")) {
        flushList(i);
        const text = line.trim().substring(1).trim();
        elements.push(
          <blockquote key={`quote-${i}`} className="border-l-4 border-blue-500 bg-slate-100 dark:bg-white/5 px-4 py-2 my-3 rounded-r italic text-slate-700 dark:text-white/60">
            {renderInline(text)}
          </blockquote>
        );
        continue;
      }

      // Lists
      const uListMatch = line.match(/^(\s*)[-*+]\s+(.*)$/);
      const oListMatch = line.match(/^(\s*)\d+\.\s+(.*)$/);

      if (uListMatch) {
        const text = uListMatch[2];
        if (!inList || isOrderedList) {
          flushList(i);
          inList = true;
          isOrderedList = false;
        }
        listItems.push(
          <li key={`li-${i}`} className="pl-1">
            {renderInline(text)}
          </li>
        );
        continue;
      }

      if (oListMatch) {
        const text = oListMatch[2];
        if (!inList || !isOrderedList) {
          flushList(i);
          inList = true;
          isOrderedList = true;
        }
        listItems.push(
          <li key={`li-${i}`} className="pl-1">
            {renderInline(text)}
          </li>
        );
        continue;
      }

      // Horizontal Rule
      if (line.trim() === "---" || line.trim() === "***" || line.trim() === "___") {
        flushList(i);
        elements.push(<hr key={`hr-${i}`} className="my-6 border-slate-200 dark:border-white/10" />);
        continue;
      }

      // Paragraphs
      if (line.trim() === "") {
        flushList(i);
        // Empty lines act as paragraph separators
        continue;
      }

      // Normal text line
      if (inList) {
        // Continue list items or close if not matching list indent (handled above)
        flushList(i);
      }

      elements.push(
        <p key={`p-${i}`} className="text-slate-800 dark:text-white/80 leading-relaxed my-2 text-base">
          {renderInline(line)}
        </p>
      );
    }

    // Flush any trailing list
    flushList(lines.length);

    return elements;
  }, [content, language]);

  return <div className="markdown-body select-text space-y-1">{parsedElements}</div>;
}
