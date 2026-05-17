# Project State Tracker

## Completed Features
- [x] PDF-to-Word conversion (4-tier fallback)
- [x] PDF-to-Excel conversion (fallback chain)
- [x] Merge PDF (4-tier fallback)
- [x] Split PDF — Custom Ranges mode
- [x] Split PDF — Fixed Size mode
- [x] Split PDF — Pages per File mode
- [x] Cloud Storage — Google Drive + Dropbox
- [x] Frontend UX — Tool accent colors, drag-and-drop, job polling, cloud file integration
- [x] Redis graceful fallback

## In Progress
- [x] Split PDF — Split by Size: Backend algorithm (`splitBySize`) implemented + unit tested (3 tests pass)
- [x] Split PDF — Split by Size: Wired into `processSplit` (size mode branch added)
- [x] Split PDF — Split by Size: Frontend "Coming soon" replaced with MB input + submission wiring
- [ ] Split PDF — Split by Size: **END-TO-END VERIFICATION BLOCKED** — PostgreSQL not running

## Not Started
- [ ] PDF to PowerPoint (defined in TOOLS constant only)
- [ ] Word to PDF (defined in TOOLS constant only)
- [ ] Compress PDF (defined in TOOLS constant only)
- [ ] Rotate PDF (defined in TOOLS constant only)

## Active Bugs / Blockers
- **BLOCKER: PostgreSQL is DOWN** — `Can't reach database server at localhost:5433`. All split modes (range, pages, size) fail at `prisma.splitJob.create()`. Docker container likely not started.
- Split PDF button appears non-functional in ALL modes (not just size) — caused by the DB blocker above.

## System Status
- PostgreSQL: **DOWN** (Docker, should be host port 5433)
- Redis: Unknown status (graceful fallback if down)
- API: Running on port 3001
- Web: Running on port 3000
- Python .venv: Project root or CWD fallback
