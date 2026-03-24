# CodeSpace

<div align="center">

<img src="https://cdn.nekohime.site/file/sOyPp0Jp.png" alt="CodeSpace" width="80" height="80" style="border-radius:16px;" />

# cs

**A modern platform to write, share, and execute JavaScript snippets — directly from your browser.**

![Next.js](https://img.shields.io/badge/Next.js-14.1.0-black?style=for-the-badge&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-336791?style=for-the-badge&logo=postgresql&logoColor=white)
![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-000000?style=for-the-badge&logo=vercel)

[Live Demo](https://codespace.yardansh.com) · [Post a Snippet](https://codespace.yardansh.com/post) · [Report Bug](https://github.com/yardanshaq/CodeSpace/issues)

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [Database Setup](#-database-setup)
- [API Reference](#-api-reference)
- [Security](#-security)
- [Deployment](#-deployment)
- [Available Modules](#-available-modules-in-sandbox)

---

## 🌐 Overview

CodeSpace is a full-stack web application that lets administrators publish JavaScript code snippets that anyone can view, copy, download, and **execute on the server** — without needing to install anything locally. Think of it as a personal snippet vault with a built-in server-side JavaScript runner, social features, and a real-time stats dashboard.

---

## ✨ Features

### Public
- 🔍 **Browse snippets** — view all public snippets organized by category
- 🔥 **Trending** — discover the most-liked and most-viewed snippets
- ▶️ **Run in browser** — execute JavaScript server-side, see output instantly
- 📋 **Copy & Download** — one-click copy or download as `.js` file
- 🔗 **Clean URLs** — share snippets via `/code?v=my-snippet.js` or `/snippet/[id]`
- 💬 **Comments** — leave comments on snippets (members only)
- ❤️ **Likes** — like snippets to show appreciation (members only)
- 📎 **File attachments** — snippets can include downloadable source files
- 💡 **Feedback** — submit bug reports or feature suggestions
- 🌙 **Dark/Light mode** — theme toggle with system preference detection
- 🤖 **Bot detection** — bots/scrapers get raw code output, browsers get full UI

### Admin
- 🔐 **Secure login** — opaque session tokens (no JWT), bcrypt passwords
- ✏️ **Create / Edit / Delete** snippets
- 📁 **File manager** — upload and attach files to snippets
- 👥 **Multi-admin** — SUPERADMIN can register additional admins and members
- 📬 **Feedback inbox** — read and manage user-submitted feedback
- 📊 **Stats dashboard** — real-time server metrics (CPU, memory, uptime, DB latency, request rate)
- 🔄 **Live polling** — snippet list auto-refreshes every 3 seconds
- ⌨️ **Keyboard shortcut** — `Ctrl+S` to save while editing

### Auth
- 🔑 **Forgot password** — email-based password reset flow
- 🔒 **Reset password** — secure token-gated reset page
- ⚙️ **Account settings** — update username and password

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Next.js 14](https://nextjs.org/) (App Router) |
| Language | TypeScript 5 |
| Database | PostgreSQL via [Neon](https://neon.tech) |
| ORM | [Prisma 5](https://www.prisma.io/) |
| Auth | Opaque session tokens + bcrypt (no JWT) |
| Cache / Rate limit | [Upstash Redis](https://upstash.com/) |
| Code execution | Node.js `vm` sandbox |
| Deployment | [Vercel](https://vercel.com/) |

---

## 📁 Project Structure

```
CodeSpace/
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── login/route.ts            # POST /api/auth/login
│   │   │   ├── logout/route.ts           # POST /api/auth/logout
│   │   │   ├── me/route.ts               # GET  /api/auth/me
│   │   │   ├── register/route.ts         # POST /api/auth/register
│   │   │   ├── settings/route.ts         # PUT  /api/auth/settings
│   │   │   ├── forgot-password/route.ts  # POST /api/auth/forgot-password
│   │   │   └── reset-password/route.ts   # POST /api/auth/reset-password
│   │   ├── admin/
│   │   │   ├── snippets/[id]/files/route.ts
│   │   │   └── users/route.ts            # User management (SUPERADMIN)
│   │   ├── snippets/                     # Public snippet CRUD
│   │   ├── comments/[id]/route.ts        # Comment management
│   │   ├── feedback/route.ts             # Feedback submission
│   │   ├── files/[id]/route.ts           # File download
│   │   └── run/route.ts                  # POST /api/run — JS executor
│   ├── page.tsx                          # / — Home
│   ├── code/page.tsx                     # /code?v=filename.js
│   ├── snippet/[id]/page.tsx             # /snippet/[id] — Snippet detail
│   ├── trending/page.tsx                 # /trending
│   ├── stats/page.tsx                    # /stats — Server metrics dashboard
│   ├── feedback/
│   │   ├── page.tsx                      # /feedback — Submit feedback
│   │   └── inbox/page.tsx               # /feedback/inbox — Admin inbox
│   ├── post/page.tsx                     # /post — Admin dashboard
│   ├── admin/page.tsx                    # /admin — Redirects to /post
│   ├── users/page.tsx                    # /users — User management (SUPERADMIN)
│   ├── settings/page.tsx                 # /settings
│   ├── login/page.tsx
│   ├── register/page.tsx
│   ├── forgot-password/page.tsx
│   ├── reset-password/page.tsx
│   ├── raw/route.ts                      # Raw code output
│   ├── not-found.tsx                     # 404 page (server component, proper OG metadata)
│   └── loading.tsx
├── components/
│   ├── DevToolsGuard.tsx                 # Anti-devtools protection
│   ├── Navbar.tsx
│   ├── NavigationLoader.tsx
│   ├── PageLoader.tsx
│   └── ThemeProvider.tsx
├── lib/
│   ├── auth.ts                           # Session management
│   ├── authCache.ts                      # Client-side user cache
│   ├── chromium.ts                       # Puppeteer helper
│   ├── prisma.ts                         # Prisma client singleton
│   └── redis.ts                          # Upstash Redis client
├── middleware.ts                         # Route protection + bot detection
├── prisma/schema.prisma                  # Database schema
├── next.config.js
└── .env.example
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database (recommended: [Neon](https://neon.tech) — free tier)
- Upstash Redis (recommended: [Upstash](https://upstash.com) — free tier)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/yardanshaq/CodeSpace.git
cd CodeSpace

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Fill in your values

# 4. Push database schema
npm run db:push

# 5. Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

---

## 🔑 Environment Variables

Create a `.env` file in the root directory:

```env
# PostgreSQL — Neon (https://neon.tech)
DATABASE_URL="postgresql://user:password@ep-xxx-pooler.neon.tech/neondb?sslmode=require"
DIRECT_URL="postgresql://user:password@ep-xxx.neon.tech/neondb?sslmode=require"

# SuperAdmin — auto-created on first login
SUPERADMIN_USERNAME="your_username"
SUPERADMIN_PASSWORD="your_strong_password"

# Upstash Redis — rate limiting
UPSTASH_REDIS_REST_URL="https://your-db.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your_upstash_token"
```

> ⚠️ Never commit `.env` to git. Never use `NEXT_PUBLIC_` prefix for sensitive variables.

---

## 🗄 Database Setup

| Model | Description |
|---|---|
| `Admin` | Users with username, hashed password, and role (SUPERADMIN / ADMIN / MEMBER) |
| `Session` | Opaque session tokens (SHA-256 hashed) with expiry |
| `Snippet` | Code snippets with title, filename, category, visibility |
| `Like` | Per-user likes on snippets (unique per user+snippet) |
| `Comment` | User comments on snippets |
| `Feedback` | User-submitted feedback/bug reports |
| `GlobalFile` | Uploaded files stored as binary in DB |
| `SnippetFile` | Join table linking snippets to their attached files |
| `PasswordReset` | Secure time-limited tokens for password reset flow |
| `ProxyDomain` | Allowed proxy domains for the sandbox |
| `system_alerts` | System-wide alert messages |

```bash
# Push schema (development)
npm run db:push

# Open visual DB browser
npm run db:studio
```

---

## 📡 API Reference

### Authentication

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/login` | Login |
| `POST` | `/api/auth/logout` | Logout |
| `GET` | `/api/auth/me` | Current session |
| `PUT` | `/api/auth/settings` | Update username/password |
| `POST` | `/api/auth/forgot-password` | Request password reset email |
| `POST` | `/api/auth/reset-password` | Reset password via token |

### Snippets

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/snippets` | List public snippets |
| `GET` | `/api/snippets?adminView=true` | List all (auth) |
| `GET` | `/api/snippets/[id]` | Get one by filename or id |
| `POST` | `/api/snippets` | Create (auth) |
| `PUT` | `/api/snippets/[id]` | Update (auth) |
| `DELETE` | `/api/snippets/[id]` | Delete (auth) |
| `PATCH` | `/api/snippets/[id]` | Increment view count |
| `POST` | `/api/snippets/[id]/like` | Like / unlike |
| `GET` | `/api/snippets/[id]/comments` | Get comments |
| `POST` | `/api/snippets/[id]/comments` | Post a comment (auth) |

### Other

| Method | Endpoint | Description |
|---|---|---|
| `DELETE` | `/api/comments/[id]` | Delete a comment (auth) |
| `POST` | `/api/feedback` | Submit feedback |
| `GET` | `/api/files/[id]` | Download attached file |

### Code Runner

```bash
POST /api/run
Content-Type: application/json

{ "code": "console.log('hello')", "snippetId": "optional" }
```

---

## 🔐 Security

- **No JWT** — opaque 64-char random session tokens
- Tokens stored as **SHA-256 hash** in DB
- Passwords hashed with **bcrypt** (cost 12) + timing-safe comparison
- Rate limiting: 10 login attempts / IP / 15 minutes
- Security headers: `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`, etc.
- **Anti-DevTools** — page blanks when browser devtools detected
- Code sandbox: `vm` module with strictly whitelisted modules, 55s timeout

---

## ☁️ Deployment

```bash
# Build
npm run build

# Start production
npm run start
```

Deploy to Vercel: push to GitHub → import at vercel.com → add env vars → deploy.

---

## 📦 Available Modules in Sandbox

**HTTP:** `axios` · `node-fetch` · `got` · `superagent` · `cross-fetch` · `form-data` · `tough-cookie` · `https-proxy-agent` · `socks-proxy-agent`

**Scraping:** `cheerio` · `node-html-parser` · `htmlparser2` · `jsdom` · `xml2js` · `fast-xml-parser` · `html-entities` · `html-to-text`

**Browser:** `puppeteer-core` · `@sparticuz/chromium` · `cloudscraper`

**Async:** `p-limit` · `p-retry` · `p-queue` · `p-map` · `bottleneck` · `async-retry` · `delay`

**Utils:** `lodash` · `dayjs` · `uuid` · `nanoid` · `crypto-js` · `qs` · `bcryptjs` · `jose` · `jsonwebtoken` · `user-agents` · `random-useragent`

**File:** `fs` · `fs/promises` · `path` · `os` · `sharp` · `mime-types` · `file-type` · `archiver` · `adm-zip` · `fs-extra`

**Data:** `csv-parse` · `csv-stringify` · `xlsx` · `json5` · `marked` · `turndown`

**Network:** `http` · `https` · `url` · `crypto` · `stream` · `buffer` · `ws` · `eventsource`

> 🚫 **Blocked:** `process`, `child_process`, `net`, `tls`, `dns`, `cluster`, `worker_threads`, `vm`, `inspector`, `@prisma/client`, `dotenv`

---

<div align="center">
  <img src="https://cdn.nekohime.site/file/sOyPp0Jp.png" alt="CS" width="32" height="32" style="border-radius:6px;vertical-align:middle;" />
  &nbsp; Made with ☕ by <a href="https://github.com/yardanshaq">yardanshaq</a>
</div>