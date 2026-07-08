# Pyncbin: Secure Zero-Knowledge Paste & Live Collaborative Pad

Pyncbin is a high-performance, minimalist, secure web application designed for sharing encrypted text, code snippets, and hosting real-time collaborative editing sessions. It implements state-of-the-art Web Crypto API patterns to achieve client-side zero-knowledge AES-256-GCM encryption, ensuring that sensitive data is fully encrypted before it is transmitted to the server.

---

## Key Features

- **Zero-Knowledge Encryption**: All cryptographic keys are derived and maintained strictly client-side using AES-256-GCM. The server never receives or stores your plaintext content or encryption keys.
- **Dual Functionality**:
  - **Secure Paste**: Create static, immutable text or code snippets with optional syntax highlighting, markdown support, custom retention policies, and password-protected decryption.
  - **Collaborative Pad**: Launch stateful, real-time cooperative editing spaces synced via light-overhead WebSockets.
- **Flexible Retention Policies**: Set expiration times (e.g., 5 minutes, 1 hour, 1 day, 1 week) or opt for **Burn on Read** to self-destruct content as soon as it is fetched.
- **Custom Aesthetic Styling**: Built using a modern dark palette, responsive layouts, customizable user tags, live word/character statistics, and micro-animations for feedback.
- **Portable and Lightweight**: Zero external database dependencies by default, utilizing localized JSON persistence and compatible with serverless workflows.

---

## Technical Stack

- **Frontend**: React (v18), Vite, TypeScript, Tailwind CSS, Lucide Icons, Framer Motion
- **Backend**: Express, Node.js HTTP & WS (WebSocket Server), TypeScript Runtime (`tsx`)
- **Cryptography**: Web Crypto API (SubtleCrypto), PBKDF2 Key Derivation, AES-256-GCM

---

## 💻 Local Setup & Development

### Prerequisites

- [Node.js](https://nodejs.org) (v18 or higher)
- npm (v9 or higher)

### Installation

1. Clone or download the repository to your local machine.
2. Open your terminal in the project root directory and run:
   ```bash
   npm install
   ```

### Running the Application

To boot the dual-purpose backend server and frontend development server simultaneously:

```bash
npm run dev
```

The application will launch on **http://localhost:3000**.
- **Frontend** changes will be served dynamically via Vite.
- **API endpoints** and **WebSocket connections** will be handled seamlessly by the underlying Express engine on the same port.

### Building for Production

Compile the production bundle (Vite outputs static files to `dist/`, and `esbuild` bundles the Express server to a standalone script):

```bash
npm run build
```

To run the compiled production bundle:

```bash
npm start
```

---

## ☁️ Deployment Guidelines

### 1. Deploying to Vercel (Recommended for Full-Stack)

The repository is configured out-of-the-box for serverless compatibility. It includes a serverless routing entrypoint (`/api/index.ts`) and custom rewrite parameters (`vercel.json`) to serve both the React client and the Express backend API.

#### Step-by-Step Instructions

1. Push your codebase to a **GitHub** repository.
2. Sign in to your [Vercel Account](https://vercel.com) and click **Add New Project**.
3. Select and import your GitHub repository.
4. Keep the default build settings (Vercel automatically detects the **Vite** project profile):
   - **Framework Preset**: `Vite` (Build command: `npm run build`, Output directory: `dist`)
5. Click **Deploy**.

> 💡 *Note on Vercel Serverless Architecture:*
> Since serverless functions are ephemeral, local serverless files are read-only. We have routed database writes to Vercel's `/tmp` folder. While suitable for simple share scenarios, serverless cold-starts or scaling instances will cycle data. For persistent production use, swap the local database helper (`pastes.json` checks in `server.ts`) with an external database (such as Firebase Firestore or Supabase PostgreSQL). Real-time WebSocket features are limited by Vercel serverless timeout limits; for robust collaborative pads, deploy the Express server container to a dedicated host.

---

### 2. Deploying to Cloudflare Pages (Frontend-Only)

Cloudflare Pages provides global-edge static file hosting, which is extremely fast and secure for serving the React Single Page Application (SPA).

#### Step-by-Step Instructions

1. Log in to the [Cloudflare Dashboard](https://dash.cloudflare.com) and go to **Workers & Pages**.
2. Click **Create** -> **Pages** -> **Connect to Git** and import your GitHub repository.
3. Configure the **Build Settings**:
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Build Output Directory**: `dist`
4. Click **Save and Deploy**.

#### Configuring the Backend for Cloudflare Pages

Cloudflare Pages natively hosts the static frontend code. Because traditional Node.js modules (like Express `fs` operations and stateful WebSockets) cannot run directly inside basic Cloudflare Edge Workers without modification:
1. **Proxy Method (Recommended)**: Deploy the standalone `server.ts` to a standard Node-supported container environment (such as **Google Cloud Run**, **Render**, or **Heroku**).
2. Update the frontend fetch endpoints to route to your deployed backend URL.

---

## License

This project is open-source and available under the MIT License. Feel free to customize, extend, and deploy!
