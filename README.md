# Team Shuffle

Upload a CSV guest list (e.g. exported from [Luma](https://lu.ma)) and randomly
split everyone into teams. Built for hackathons and events where you need to
form balanced groups on the spot.

## What it does

- **Import a Luma CSV** — export your event's guest list from Luma and upload it.
  Columns (name, email, approval status, check-in time) are detected
  automatically, so no manual mapping is needed.
- **Filter who gets a team:**
  - **Approval status** — include/exclude `approved`, `waitlist`, `declined`, etc.
    (defaults to `approved`).
  - **Checked-in only** — keep just the people who actually checked in at the
    event (defaults on when the file has check-in data).
  - **Remove duplicates** — drop repeated entries by email/name.
- **Pick a team size** (2–5) and choose what happens when it doesn't divide evenly:
  - **Separate smaller team** — leftovers form one smaller team.
  - **Spread into bigger teams** — leftovers join existing teams so no one is left out.
- **Shuffle** — teams are assigned randomly (Fisher–Yates). Re-shuffle anytime.
- **Find a name** — search the results to quickly locate someone's team.
- **Export CSV** — download the final teams as `Team,Name,Email`.

## How to use

1. In Luma, open your event → **Guests** → **Export** to download the guest CSV.
2. Open the app and click **Choose CSV file**, then select that export.
3. Adjust the filters, team size, and remainder option — the summary shows
   exactly how many teams you'll get.
4. Click **Generate teams**, then **Shuffle again** or **Export CSV** as needed.

> Guest lists contain personal data (names, emails). They are parsed entirely in
> your browser and never uploaded anywhere. `*.csv` files are git-ignored so they
> can't be committed by accident.

## Development

```bash
npm install
npm run dev      # start the dev server
npm run build    # production build to dist/
```

## Tech

Vite + React + TypeScript. The app is a static SPA — deploy the `dist/` output
to any static host (e.g. Vercel).

### Project structure

```
src/
├─ App.tsx, main.tsx        # entry points
├─ TeamShuffle.tsx          # container: state + screen routing
├─ TeamShuffle.css
├─ components/
│  ├─ LogoBar.tsx
│  ├─ SetupScreen.tsx       # upload + filters + options form
│  └─ ResultsScreen.tsx     # generated teams + search/export
└─ lib/teams.ts             # pure logic: CSV parsing, filtering, shuffling
```
