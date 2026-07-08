export interface Paste {
  id: string;
  title: string;
  content: string;
  isPad: boolean;
  expiration: string;
  burnOnRead: boolean;
  language: string;
  encrypted: boolean;
  createdAt: number;
  expiresAt: number | null;
  burned?: boolean;
  ownerId?: string;
  padAccessMode?: "readonly" | "collaborate";
}

export type ExpirationOption = "never" | "5m" | "10m" | "30m" | "1h" | "1d" | "1w" | "1m";

export interface CodeLanguage {
  id: string;
  name: string;
  extension?: string;
}

export const SUPPORTED_LANGUAGES: CodeLanguage[] = [
  { id: "auto", name: "Auto-Detect" },
  { id: "javascript", name: "JavaScript" },
  { id: "typescript", name: "TypeScript" },
  { id: "python", name: "Python" },
  { id: "html", name: "HTML" },
  { id: "css", name: "CSS" },
  { id: "json", name: "JSON" },
  { id: "sql", name: "SQL" },
  { id: "sh", name: "Shell Script (Bash)" },
  { id: "markdown", name: "Markdown" },
  { id: "plaintext", name: "Plain Text" },
];

export interface HistoryItem {
  id: string;
  title: string;
  isPad: boolean;
  encrypted: boolean;
  language: string;
  createdAt: number;
  secretKey?: string; // stored client-side for zero-knowledge decryption
}
