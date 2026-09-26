# itenary.com

Collaborative, AI-orchestrated travel planning for Bharat. Built from the *TravlConnect — Concept & System Design (v1.0)* document, rebranded as itenary.com.

Friends, couples and families plan a trip together in real time. **Yatri**, the AI concierge, books cabs, food, stays and experiences, and a traveller approves every payment. Trips can be published to a community feed, forked, sold as premium itineraries, and turned into a shareable Digital Zine.

---

## Run it

**Windows:** double-click `START.bat`. On first run it installs dependencies, builds the app, starts the server and opens http://localhost:4000.

**Any OS:**

```bash
npm install
npm run build
npm start            # http://localhost:4000
```

**Development** (hot reload): `npm run dev`, then open http://localhost:5173. The API runs on :4000.

Requires **Node.js 22.13 or newer**. The database is SQLite, built into Node. There is nothing else to install.

On first start the app creates the admin account, the booking providers and a full set of demo data. To wipe everything and start again, run `npm run seed`.

## Logins

| Who | How |
|---|---|
| **Admin panel** | http://localhost:4000/admin → `admin@itenary.com` / `Admin@12345` (change it in Admin → Settings) |
| **Demo travellers** | http://localhost:4000/login → tap a demo traveller (Aarav, Priya, Rohan, Ananya, Kabir, Meera, Ishaan, Zoya) |
| **New users** | Enter any Indian mobile number. In demo mode the 6-digit WhatsApp code is shown on screen. |

To see real-time collaboration, sign in as **Aarav** in one browser and **Priya** in another (for example, a normal window and a private window). Then open *Nainital & Bhimtal Getaway*.

## What's included

**Traveller app**
- WhatsApp OTP sign-in and onboarding: travel style, emergency contact, and who you travel with
- Trip hub with live presence ("Priya is editing Day 2")
  - Vibe Check slider and a day-by-day timeline with drag-and-drop
  - A Stash of saved places, links and photos, plus group votes
  - Group chat with @mentions and typing indicators
- **Yatri AI concierge** that searches cab, food, stay and event partners and posts proposal cards
- **Confirm-before-pay** UPI sheet, per-booking and per-trip spending limits, and a full audit trail
- Bookings: Upcoming, Past and Cancelled; driver, OTP and room details; cancel and refund
- Split budget: expenses (auto-added from bookings), who-owes-whom, and one-tap UPI settle-up
- Map with each day's route, directions and live location sharing
- **SOS**: alerts the group, your emergency contact and the safety desk
- Shared album with reactions, and a **Digital Zine** scrapbook with Instagram Story export
- Community feed with vibe tags and "Forked by N", fork into your own trip, likes, reviews and tips
- Premium itinerary marketplace, and auto-promotion to Verified Premium after N forks
- Creator studio: sales, tips, platform fees, follower growth, forks and payouts
- Event finder with ticket booking
- Profile: verified-traveller request, the Itenary Plus subscription (unlimited concierge) and payment history
- Offline support: the app shell, trips and maps are cached, and chat messages queue until you reconnect

**Admin panel** (`/admin`)
- Dashboard with KPIs, 30-day charts, revenue breakdown and live queues
- Users: verify, suspend, grant Plus, create admins
- Trips
- **Bookings "needs attention" queue** (human-in-the-loop): confirm manually, retry, or cancel and refund
- Payments ledger with refunds, and creator payouts
- Marketplace moderation: feature, Verified Premium, price, remove
- Review moderation
- Events CRUD
- Provider connectors: enable, commission, sandbox failure rate
- Safety desk: live SOS alerts and verification requests
- AI audit log and admin activity log
- Platform settings: fees, limits, AI model and key, announcements, broadcast notifications

## Going live: what to plug in

Everything works out of the box, but these parts run in a **sandbox** until you connect real services:

| Area | Today | To go live |
|---|---|---|
| AI concierge | Built-in rule engine | Set `ANTHROPIC_API_KEY` (or paste it in Admin → Settings). Yatri then uses Claude (`claude-opus-5` by default) with tool calling. |
| WhatsApp OTP | Code shown on screen (demo mode) | Set `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_OTP_TEMPLATE`, then set `DEMO_MODE=false` |
| UPI payments | Sandbox PSP (any 4- or 6-digit PIN) | Swap `server/services/payments.js` for Razorpay/Cashfree collect, refund and payout |
| Cab / food / stay partners | Sandbox connectors with realistic pricing | Replace `search`/`execute` in `server/connectors/*.js` with partner APIs |

Copy `.env.example` to `.env` to configure. **Before inviting real users**, set `DEMO_MODE=false`, a strong `JWT_SECRET` and a new admin password.

## Deploy: Vercel + Render, both from GitHub

itenary.com has two parts:

- **The web app**: static files, hosted on **Vercel**.
- **The API server**: Express with live WebSockets, the SQLite database and photo uploads, hosted on **Render**.

Vercel can't host the API server. Its serverless functions can't keep WebSocket connections open, a database file, or uploaded photos.

**1. Push to GitHub**

```bash
git remote add origin https://github.com/<you>/itenary.git
git push -u origin main
```

**2. API server on Render** (about 5 minutes)
1. Go to render.com → **New → Blueprint** → pick the `itenary` repo. `render.yaml` sets everything up: Node 24, a 1 GB persistent disk and the Singapore region.
2. Enter an `ADMIN_PASSWORD` when asked. `ANTHROPIC_API_KEY` is optional.
3. When it's live, copy the URL, for example `https://itenary-api.onrender.com`. Check that `/api/health` returns `{"ok":true}`.

> The disk needs Render's Starter plan (~$7/mo). On the free plan the database resets on every deploy.

**3. Web app on Vercel** (about 2 minutes)
1. Go to vercel.com → **Add New → Project** → import the same GitHub repo. `vercel.json` already sets the build to `npm run build` with output in `dist`.
2. Under **Environment Variables**, add `VITE_API_URL` = the Render URL from step 2.
3. Click **Deploy**. Every push to `main` now redeploys both Vercel and Render.

**4. Connect itenary.com**
1. In Vercel → **Settings → Domains**, add `itenary.com` and `www.itenary.com`, then set the DNS records Vercel shows at your registrar.
2. Optionally add `api.itenary.com` as a custom domain on Render. If you do, update `VITE_API_URL` and redeploy.
3. In Render, set `CORS_ORIGIN=https://itenary.com,https://www.itenary.com` to lock the API to your site.

**Before real users:** set `DEMO_MODE=false` on Render (after configuring the WhatsApp variables) and change the admin password.

**Other options.** The API server can also serve the web app itself, so a single host works too:
- **Docker:** `docker build -t itenary .` then `docker run -p 4000:4000 -v itenary-data:/data --env-file .env itenary`
- **Any Node host** (Railway, Fly.io, a VPS): `npm run build && npm start`, with `DATA_DIR` on a persistent disk and HTTPS in front.

## Project layout

```
server/            Express API + Socket.IO (realtime) + SQLite
  routes/          auth, trips, bookings, budget, media/zine/SOS, feed/marketplace/creator, admin
  services/        bookings state machine, payments (sandbox UPI), budget split, OTP, notifications
  agent/           Yatri concierge (Claude tool-use loop + built-in fallback engine)
  connectors/      cab, food, stay, experience provider modules (isolated, versioned)
  data/places.js   gazetteer of 25+ Indian destinations for maps & suggestions
  seed.js          demo data
client/            React 19 + Tailwind v4 web app (PWA)
  src/pages/       traveller app, trip hub (pages/trip), discover & creator (pages/discover), admin (pages/admin)
```
