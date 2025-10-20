This repository is a Node.js (ESM) Express application that runs a multi-LINE account slip-checker + admin dashboard.

Keep edits minimal and behavior-preserving. Below are the key facts an AI coding agent needs to be productive and safe when changing code.

- Project entry: `backend/index.js` — loads `info.env` (not `.env`) and starts the server. Use `npm run dev` (nodemon) or `npm start`.
- Node engine: Node 18.x (see `package.json`).
- Database: MongoDB via `mongoose` — connection config uses `process.env.MONGODB_URI` in `backend/mongo.js`.

- Important env files / vars (repo uses `info.env` if present):
  - `info.env` at project root — checked by `backend/index.js` and many modules.
  - Key vars: `PORT`, `URL` (public base URL), `SESSION_SECRET`, `MONGODB_URI` and LINE credentials live in the Shop documents in MongoDB.

- LINE integration and webhooks:
  - Shop / LINE configuration is stored in MongoDB `Shop` documents and loaded into memory via `backend/utils/loadShopData.js` (exported `shopData`).
  - Webhook routes are created dynamically by `backend/routes/line-webhook.js` with pattern `/webhook/{prefix}/{channelIdLast4}.bot`.
  - Do not rely on static webhook routes — update `loadShopData()` or `setupWebhooks()` when changing how shops are registered.
  - The webhook handler requires `express.raw()` middleware for signature verification; see `setCorrectSignature()` in `line-webhook.js`.

- Event flow & core handlers:
  - `backend/routes/line-webhook.js` receives events and calls `backend/handlers/handleEvent.js`.
  - `handleEvent.js` delegates to `handleText.js` for text messages and `handleImage.js` for images. Many user-state maps (Maps and timeouts) live in `handleEvent.js` — preserve exported helpers when refactoring.
  - `handleText.js` uses local keyword files (`backend/handlers/textBot/keywords/*`) first and falls back to a GPT categorizer. Message replies are chosen from `backend/handlers/textBot/reply/*` utilities.
  - When changing reply behavior, examine `reportResultToAPI` (`utils/slipResultManager.js`) so analytics/logging remain consistent.

- Admin dashboard & sessions:
  - Admin UI served from `public/` and `views/`. Session middleware is `express-session` configured in `backend/index.js`. User identity (username) is stored in `req.session.user`.
  - Uploaded in-progress images (for the dashboard) are stored temporarily in MongoDB in `lineSendingImage` via `backend/models/lineSendingImage.js` and accessed by `GET /api/uploaded-image`.

- Patterns and conventions you must follow:
  - Use ES modules (import / export) — follow existing style.
  - Preserve the `express.raw()` usage for webhook routes. Converting `/webhook` to a JSON body parser breaks signature verification.
  - Shop identification convention: a username starts with a 3-character shop prefix; many APIs rely on `username.substring(0,3)`.
  - When interacting with LINE SDK: prefer `client.replyMessage(...)` for replies inside webhook flows, `client.pushMessage(...)` for admin-initiated messages (see `routes/api/send-message.js`).
  - Keep SSE log broadcasting behavior intact: `backend/index.js` exposes `/events` and `utils/logManager.js` contains `broadcastLog()` used across the app.

- Useful files to inspect when working on features or bugs:
  - `backend/index.js` — app bootstrap, session config, static files, `restartWebhooks()`
  - `backend/routes/line-webhook.js` — dynamic webhook registration and signature handling
  - `backend/handlers/handleEvent.js`, `handleText.js`, `handleImage.js` — main bot logic and state maps
  - `backend/utils/loadShopData.js` and `backend/credentials.js` — how runtime config and credentials are obtained
  - `backend/routes/api/send-message.js` — how admin sends push messages and how temporary uploads are used
  - `backend/mongo.js` — connection, reconnect behavior and important timeouts

- Quick start (developer) — commands and endpoints an agent may use:
  - Install: the repo uses npm. Ensure Node 18.x.
  - Start dev server: `npm run dev` (invokes `nodemon backend/index.js`).
  - Start for production: `npm start`.
  - Check base URL returned by the running server: `GET /api/get-baseURL`.

- Editing guidance for AI agents:
  - Small, local edits only: prefer targeted diffs that preserve exported functions and module contracts (for example `loadShopData`, exports from `handleEvent.js`).
  - When changing message formats or reply logic, update `reportResultToAPI` calls so downstream logging/analytics are consistent.
  - When editing webhook behavior, run the server and verify webhook routes are generated for sample shops (check console logs printed by `loadShopData()` and `setupWebhooks()`).
  - Preserve existing error handling conventions (console.error + broadcastLog for critical bot errors).

If anything here is unclear or you want the guidance phrased differently (more examples, additional files listed), tell me which section to expand and I will iterate.
