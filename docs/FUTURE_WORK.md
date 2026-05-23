# Future Work

Features and improvements planned for future development cycles. Items are grouped by theme, not priority.

---

## Plan 3 — Automation Engine Extensions

### Publish to Etsy
After a listing reaches `review` state, a one-click Publish button in the AutomationToolbar pushes it live to Etsy via the existing `POST /api/etsy/publish` route. On success, Automation State → `published` and the Etsy listing ID is written back to the record.

### Auto-Detect Category
Before generating, classify the product image with Gemini against the store's category list. If a confident match is found, set the Category field automatically so the user doesn't have to assign it manually before running automation.

### Streaming Cell Updates
Replace the current "wait for full response then populate" model with an SSE endpoint so Title, Description, and Tags fill in word-by-word as Gemini streams the response. Cells animate in real time.

### Scheduled Automation Runs
Let users schedule automation to run at a specific time or on a recurring interval (e.g. "generate 10 listings every morning at 8am"). Requires a server-side scheduler or cron trigger.

---

## Hardening & Polish

### Error Visibility
Currently errored rows show state = `error` but there's no way to see *why* it failed. Add an error message field or tooltip so users can diagnose issues (no images, bad category, Gemini timeout, etc.).

### Batch Size Warning
When the user queues more rows than `batchSize` allows, the excess rows are silently dropped. Show a toast or inline warning: "Running 10 of 24 selected rows. Increase batch size in Settings to run more at once."

### Prompt Preview / Dry Run
In the Category editor → AI Template tab, add a "Preview prompt" button that shows the fully resolved prompt for a selected row without calling Gemini. Lets users verify template variables and description blocks before running.

### Image Upload in Grid
There's currently no in-grid way to attach images to a row. Add a cell editor for the Images field type that supports drag-and-drop upload directly from the grid, using the existing `POST /api/upload` route.

### Category Assignment UX
When automation runs on a row with no Category set, it falls back to the default prompt. Add a visible indicator in the toolbar or grid when rows are missing a category, and optionally a bulk "assign category" action for selected rows.

---

## Infrastructure

### Migrate to Turso (Production DB)
The current setup uses a local SQLite file (`dev.db`). For a production deployment, migrate to Turso (libSQL remote) — the Prisma adapter is already installed.

### Environment-Based Config
Add a proper `env.ts` validation layer (e.g. with Zod) so missing or malformed env vars fail loudly at startup rather than at runtime.

### Rate Limiting on Automation API
`POST /api/automation/run-row` makes an outbound Gemini API call per invocation. Add basic rate limiting or concurrency control to prevent runaway costs if triggered rapidly.

---

## Nice to Haves

- **Duplicate record** — right-click context menu option in the grid
- **Record history** — track field value changes over time per record
- **Bulk edit** — change a field value across all selected rows at once
- **View sharing** — generate a read-only shareable link for a grid view
- **Dark mode** — `next-themes` is already installed, just needs wiring up
