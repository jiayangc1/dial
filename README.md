# Dial

A class-aware to-do app on top of your Notion. Dial checks your bell schedule, works out which class you're in, and opens that class's tasks. Tasks live in your existing Notion databases. Dial reads and writes them there and keeps no copy of its own.

Next.js 16 (App Router) · TypeScript · Tailwind 4 · Motion · Auth.js v5 (Notion OAuth) · `@notionhq/client` (data-source API, `2025-09-03`).

See [`DESIGN.md`](DESIGN.md) for the design spec and `docs/review/` for the screenshot reviews of each stage.

## 1. Create the Notion public integration

1. Go to <https://www.notion.so/profile/integrations> → **New integration**.
2. Set **Type** to **Public**. Fill in the name (Dial), the website, and the privacy and terms URLs that Notion requires (your deployment URL is fine).
3. Under **OAuth domain & URIs**, add one redirect URI per environment:
   - local: `http://localhost:3000/api/auth/callback/notion`
   - production: `https://<your-domain>/api/auth/callback/notion`
4. Under **Capabilities**, enable **Read content**, **Update content**, **Insert content**, and **Read user information including email addresses**.
5. Copy the **OAuth client ID** and **OAuth client secret**.

When you first sign in, Notion's consent screen asks which pages to share. Pick **🎒 Assignment Tracker**. Both the Assignments and Courses databases must be inside it, or shared alongside it.

## 2. Environment variables

Copy `.env.example` to `.env.local` and fill it in:

| Variable | What it is |
|---|---|
| `AUTH_NOTION_ID` | OAuth client ID from the integration |
| `AUTH_NOTION_SECRET` | OAuth client secret |
| `NOTION_REDIRECT_URI` | Must exactly match a redirect URI on the integration, e.g. `http://localhost:3000/api/auth/callback/notion` |
| `AUTH_SECRET` | Random secret that encrypts the session. Generate one with `npx auth secret` or `openssl rand -base64 33` |
| `AUTH_URL` | Optional. Your public URL in production |
| `DIAL_DEMO` | `1` serves built-in fixture data with no Notion connection (development only) |

The Notion access token is stored only inside the encrypted session cookie (a JWE). It never reaches the browser, and every Notion call runs server-side.

## 3. Fill in your bell schedule

Edit [`config/bells.ts`](config/bells.ts). **The schedule in that file is an example.** Replace it with your real one.

```ts
export const timezone = "America/Chicago";
export const schoolEnds = "16:00";
export const schedules = {
  regular: [
    { period: "1", start: "08:30", end: "09:20", course: "Pre-Calc" },
    { period: "Lunch", start: "11:10", end: "11:45", course: null },
    // ...
  ],
  earlyRelease: [/* ... */],
};
export const dayType = (date: Date) => "regular"; // return "a" / "b" for A/B rotations
export const overrides = { "2026-11-26": "none" };  // holidays and odd days
```

- `course` must match the Notion **Course Name** exactly. The last onboarding step flags any name that doesn't match.
- Add a schedule for each day type, and pick between them in `dayType`.
- `overrides` maps a local date to a schedule name, or to `"none"` for a day off.

## 4. Run it

```bash
npm install
npm run dev            # http://localhost:3000
```

To try the app without Notion, set `DIAL_DEMO=1` in `.env.local`. Add `?scenario=heavy` (50 tasks) or `?scenario=empty` to `/app` for the stress states.

## Using Dial

The entry box opens on the class you're in right now (or the next one during a passing period). Pick a different class from the dropdown, or send a single task elsewhere with `@`.

| Type | Becomes |
|---|---|
| `ws 2.4 fri 30m quiz` | "ws 2.4", due Friday, 30 min, Test / Quiz |
| `essay due thu at 3pm` | "essay", due Thursday 3:00 PM |
| `read ch 5 tmrw 45m` | due tomorrow, 45 min |
| `lab report @chem nov 20` | filed under Chemistry, due Nov 20 |
| `study 1h30 !` | 90 min, High priority (`!low`, `!med` also work) |
| `chapter 4 #reading` | Type: Reading (`#quiz`, `#hw`, `#project`, `#study`) |

Each parsed piece shows as a chip; tap × to put the text back in the title. A type word at the start of a title stays in it ("Unit 3 test" keeps its name but is typed as a Test / Quiz).

- **Complete:** tap the circle, or swipe right. Undo for 5 seconds.
- **Quick actions:** swipe left for In progress, Need to Submit, change due date, Delete (moves the page to Notion's trash).
- **Edit:** tap a task. **Search:** `/` or the magnifier.
- **Keyboard:** `n` new task, `←` `→` previous/next class, `.` back to now, `/` search.
- **Offline:** changes queue with a "will sync" badge and go to Notion when you're back online. The installed app opens offline.

## Tests

```bash
npm test   # node:test — "now" logic (periods, passing, before/after school, weekends, overrides, A/B days) and the quick-add parser
```

To preview any time of day in the UI, add `?now=2026-11-09T08:45` (school-local time) to `/app`.

## 5. Deploy

### Coolify (how dial.ch3n.cc runs)

The repo ships a `Dockerfile` (a Next.js standalone server on port 3000) and a `/api/health` liveness route.

1. In Coolify, create an application from the GitHub repo, branch `main`, build pack **Dockerfile**, port **3000**, health check path `/api/health`. Set the domain, e.g. `https://dial.ch3n.cc`.
2. Add these as **runtime** environment variables (not build-time):

   | Variable | Value |
   |---|---|
   | `AUTH_SECRET` | `openssl rand -base64 33` |
   | `AUTH_URL` | `https://dial.ch3n.cc` |
   | `NOTION_REDIRECT_URI` | `https://dial.ch3n.cc/api/auth/callback/notion` |
   | `AUTH_NOTION_ID` | OAuth client ID from the Notion integration |
   | `AUTH_NOTION_SECRET` | OAuth client secret from the Notion integration |

3. Add the same redirect URI to the Notion integration (step 1), then redeploy. Pushes to `main` redeploy automatically.

Changing `AUTH_SECRET` signs everyone out. Leave `DIAL_DEMO` unset in production; demo mode refuses to run there anyway.

### Vercel

Import the repo, add the same variables under Project → Settings → Environment Variables, and add the production redirect URI to the Notion integration.

## How data flows

- **Discovery:** after sign-in, Dial searches the shared pages for the two data sources by their schema: Assignments (a "Course" relation and a "Status" status property) and Courses (a "Currently enrolled" checkbox). It saves their IDs in an httpOnly cookie, so nothing is hard-coded.
- **Reads:** one paginated query for open tasks plus tasks completed this week, and one query for enrolled courses, run in parallel. `/app` does this on the server, so the first view arrives as finished HTML with your tasks already in it. After that, the client polls `GET /api/data` every 60 seconds while the tab is visible. Offline, the installed app opens from the service worker and paints from the last snapshot cached in the browser.
- **Rate limits:** each token gets a queue that spaces requests 340ms apart (about 3 per second). The SDK retries 429s with backoff.
- **Bot-owned fields:** "Scheduled For" and "Calendar Event" are read-only. Dial shows them and never writes them.
- **Expired access:** if Notion answers 401 or 403, Dial clears the session and returns you to sign-in with a notice.
