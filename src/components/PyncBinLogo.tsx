import React from "react";

interface PyncBinLogoProps {
  className?: string;
  size?: number;
  animate?: boolean;
}

export const PyncBinLogo: React.FC<PyncBinLogoProps> = ({
  className = "",
  size = 32,
  animate = true,
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={`select-none filter drop-shadow-[0_2px_8px_rgba(37,99,235,0.15)] dark:drop-shadow-[0_4px_12px_rgba(99,102,241,0.25)] ${className}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Sync Arrow Gradient for Light Theme */}
        <linearGradient id="pyncbin-arrow-grad-light" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2563eb" /> {/* vibrant blue */}
          <stop offset="100%" stopColor="#7c3aed" /> {/* violet */}
        </linearGradient>

        {/* Sync Arrow Gradient for Dark Theme */}
        <linearGradient id="pyncbin-arrow-grad-dark" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3b82f6" /> {/* bright blue */}
          <stop offset="100%" stopColor="#8b5cf6" /> {/* bright violet/purple */}
        </linearGradient>
        
        {animate && (
          <style>
            {`
              @keyframes pync-spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
              .pync-sync-ring {
                transform-origin: 68px 68px;
                animation: pync-spin 14s linear infinite;
                transition: animation-duration 0.3s ease;
              }
              svg:hover .pync-sync-ring {
                animation-duration: 3s;
              }
            `}
          </style>
        )}
      </defs>

      {/* Main Document / File Sheet with folded corner */}
      <path
        d="M 24 12 H 50 L 66 28 V 74 A 4 4 0 0 1 62 78 H 22 A 4 4 0 0 1 18 74 V 16 A 4 4 0 0 1 22 12 Z"
        className="fill-slate-50 stroke-slate-400/90 dark:fill-[#12131a] dark:stroke-slate-600/90"
        strokeWidth="3"
        strokeLinejoin="round"
      />

      {/* 3D Folded Flap Corner (Dog Ear) */}
      <path
        d="M 50 12 V 24 A 4 4 0 0 0 54 28 H 66 Z"
        className="fill-slate-200 stroke-slate-400/90 dark:fill-[#1e2230] dark:stroke-slate-600/90"
        strokeWidth="3"
        strokeLinejoin="round"
      />

      {/* Code symbol "</>" inside document */}
      <g strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className="stroke-slate-800 dark:stroke-slate-200">
        {/* Left angle bracket "<" */}
        <path d="M 31 29 L 25 34 L 31 39" fill="none" />
        {/* Slash "/" */}
        <path d="M 34.5 41 L 39.5 27" fill="none" />
        {/* Right angle bracket ">" */}
        <path d="M 43 29 L 49 34 L 43 39" fill="none" />
      </g>

      {/* Document content lines / rounded pills */}
      <g strokeWidth="4" strokeLinecap="round" className="stroke-slate-300 dark:stroke-slate-600/80">
        <line x1="25" y1="48" x2="58" y2="48" />
        <line x1="25" y1="56" x2="54" y2="56" />
        <line x1="25" y1="64" x2="48" y2="64" />
        <line x1="25" y1="72" x2="38" y2="72" />
      </g>

      {/* Synchronization Ring overlayed on bottom right */}
      <g className={animate ? "pync-sync-ring" : ""}>
        {/* Top-Right Arrow curve & pointer */}
        <path
          d="M 53.3 53.3 A 18 18 0 0 1 84 66"
          fill="none"
          stroke="url(#pyncbin-arrow-grad-light)"
          className="dark:stroke-[url(#pyncbin-arrow-grad-dark)]"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <path
          d="M 84 57.5 L 84 66 L 75.5 66"
          fill="none"
          stroke="url(#pyncbin-arrow-grad-light)"
          className="dark:stroke-[url(#pyncbin-arrow-grad-dark)]"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Bottom-Left Arrow curve & pointer */}
        <path
          d="M 78.7 78.7 A 18 18 0 0 1 50 66"
          fill="none"
          stroke="url(#pyncbin-arrow-grad-light)"
          className="dark:stroke-[url(#pyncbin-arrow-grad-dark)]"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <path
          d="M 50 74.5 L 50 66 L 58.5 66"
          fill="none"
          stroke="url(#pyncbin-arrow-grad-light)"
          className="dark:stroke-[url(#pyncbin-arrow-grad-dark)]"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
};
