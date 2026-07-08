# Deployment Guide: Vercel & Cloudflare Pages

This repository contains a full-stack secure paste and collaborative pad application. It has been pre-configured and updated to be 100% ready for instant deployment from GitHub to **Vercel** and **Cloudflare Pages**.

---

## 🚀 Deploying to Vercel (Recommended for Full-Stack)

We have added a custom serverless handler (`/api/index.ts`) and a routing configuration (`vercel.json`). Vercel will automatically detect the Vite frontend, build it, and serve the Express backend endpoints as serverless functions.

### Step-by-Step Instructions

1. **Push your code to a GitHub repository.**
2. Log in to [Vercel](https://vercel.com) and click **Add New** -> **Project**.
3. Import your GitHub repository.
4. Vercel will auto-detect the configuration. Ensure the following settings are active:
   - **Framework Preset**: `Vite` (Vercel will automatically configure the build command as `npm run build` and output directory as `dist`).
   - **Root Directory**: `./` (default)
5. Click **Deploy**.

### How the Full-Stack Architecture runs on Vercel
* **Static Assets**: Vercel's global CDN serves your optimized React bundle (Vite) with ultra-low latency.
* **API Endpoints**: All requests to `/api/*` are dynamically routed to the Express server running inside Vercel Serverless Functions.
* **Serverless Storage**: Since serverless filesystems are read-only, our backend has been updated to use the writable `/tmp/pastes.json` directory. 
  > *Note: Serverless containers are ephemeral. Pastes stored in `/tmp` will persist temporarily but can be reset on new deployment builds or container recycles. For production-grade long-term durability, we recommend swapping the local file-system `pastes.json` helper with an external database (such as Firebase Firestore, Supabase PostgreSQL, or MongoDB).*
* **WebSockets & Collaborative Pads**: Standard WebSockets (`ws`) require a long-lived, stateful server connection. Because Vercel serverless functions are ephemeral, live collaborative pads will have session-length limits on Vercel. For high-volume real-time collaboration, we recommend running on stateful container environments like Google Cloud Run or Render.

---

## ⚡ Deploying to Cloudflare Pages (Frontend Only)

Cloudflare Pages is incredibly fast and secure for hosting static Single Page Applications (SPAs).

### Step-by-Step Instructions

1. Log in to the [Cloudflare Dashboard](https://dash.cloudflare.com) and navigate to **Workers & Pages**.
2. Click **Create** -> **Pages** -> **Connect to Git**.
3. Import your GitHub repository.
4. Set up the Build Settings:
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Build Output Directory**: `dist`
5. Click **Save and Deploy**.

### How to handle the API Backend on Cloudflare
Since Cloudflare Pages runs entirely on the edge using V8 isolates, traditional Node.js modules (like `fs` and standard TCP `ws`) are not supported natively inside Pages.
To connect your Cloudflare Pages frontend to a backend:
1. **Proxy to a Standalone Backend**: Deploy the Express server (`server.ts`) to a Node.js-compatible container host like **Google Cloud Run** or **Render**, then set your API endpoint URL on the frontend to point to that host.
2. **Cloudflare Pages Functions**: Rewrite your API routes using Cloudflare-native APIs (using Cloudflare D1/KV for database storage and Durable Objects for real-time WebSockets).
