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
- [x] Split PDF — Split by Size: **END-TO-END VERIFIED** — All split modes (range, pages, size) tested and working

## Not Started
- [ ] PDF to PowerPoint (defined in TOOLS constant only)
- [ ] Word to PDF (defined in TOOLS constant only)
- [ ] Compress PDF (defined in TOOLS constant only)
- [ ] Rotate PDF (defined in TOOLS constant only)

## Active Bugs / Blockers
- **RESOLVED: sizeLimit data flow bug** — Route handler (`apps/api/src/routes/split.ts:58`) was not destructuring `sizeLimit` from `req.body`. Fixed and verified end-to-end.

## System Status
- PostgreSQL: **RUNNING** (native, host port 5433)
- Redis: **RUNNING** (native, port 6379)
- API: Runs on port 3001
- Web: Runs on port 3000
- Python .venv: Project root or CWD fallback
