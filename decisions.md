# Architectural Decision Records (ADRs)

## ADR-001: Cloud Proxy Pattern
- **Context:** Cloud providers (Drive, Dropbox) return files via URLs that may have CORS restrictions or return HTML error pages instead of actual PDFs.
- **Decision:** Frontend passes access tokens/file IDs to backend. Backend downloads the file, validates the `%PDF-` header, saves to uploads/, then begins the job.
- **Why:** Ensures file integrity before processing and bypasses client-side CORS limitations. Centralizes validation logic.

## ADR-002: Aggressive CLI Fallback Chains
- **Context:** Single conversion engines (especially LibreOffice) fail unpredictably on specific PDFs.
- **Decision:** Every conversion operation chains multiple CLI/library methods, catching errors and trying the next. Only fails if ALL methods return errors or empty files.
- **Why:** Maximizes conversion success rate at the cost of code complexity. User trust depends on reliability.

## ADR-003: Frontend Polling for Job Status
- **Context:** Conversions can take 10+ seconds. Holding HTTP connections open causes timeouts.
- **Decision:** Jobs return a job ID immediately. Frontend polls `/status/:id` every 2 seconds until COMPLETED or FAILED.
- **Why:** Simple, reliable, works without WebSockets. Acceptable latency for the use case.

## ADR-004: Tool-Specific Accent Theming
- **Context:** Visual distinction helps users orient within different tool contexts.
- **Decision:** Each tool has an `ACCENT_COLOR` (e.g., Word=#2B579A, Excel=#217346, Split=#9B59B6) passed to shared components.
- **Why:** Minimal implementation cost, significant UX clarity improvement.

## ADR-005: Shared Constants Package
- **Context:** Frontend and backend must agree on tool definitions, API routes, and TypeScript interfaces.
- **Decision:** All shared types and constants live in `@pdf-converter/shared` package.
- **Why:** Single source of truth eliminates drift between frontend and backend.

## ADR-006: Redis Graceful Fallback
- **Context:** BullMQ requires Redis. If Redis is down, the entire API would previously crash.
- **Decision:** BullMQ worker initialization is wrapped in try/catch. On failure, jobs processes directly in-process without queuing.
- **Why:** System remains functional (albeit without async queuing) during Redis outages. Degrades gracefully.

## ADR-007: Split by Size — Oversized Page Handling
- **Context:** When splitting by file size, a single PDF page may exceed the user's sizeLimit. We must define system behavior for this edge case.
- **Options Considered:**
  - (A) Strict: Reject with error, tell user the limit is too small.
  - (B) Permissive: Allow the oversized page as its own file, exceeding the limit. ✅ SELECTED
  - (C) Compressive: Attempt to compress/re-render the page to fit, then fallback.
- **Decision:** Option B — single pages that exceed sizeLimit are placed in their own group and output as-is.
- **Why:** No data loss, no surprising errors, no irreversible compression artifacts. The user's intent is "split into manageable chunks" — an oversized single page is the best possible chunk for that page. The output filename can indicate the file is oversized.
- **Caveat:** Frontend should display a note when oversized files are produced in the results.

## ADR-008: Split by Size — Size Estimation Strategy
- **Context:** PDF page sizes are non-uniform — shared fonts/images mean page groups are smaller than the sum of individual pages extracted separately. We need a grouping algorithm.
- **Decision:** Two-pass approach:
  1. **Measurement pass:** Extract each page as a single-page PDF via pdf-lib, record byte length. These sizes are conservative (overestimates) because each standalone page carries its own copy of shared resources.
  2. **Grouping pass:** Greedy bin-packing using the measured sizes. Accumulate pages into groups until adding the next would exceed sizeLimit. Single pages exceeding the limit form their own group (per ADR-007).
  3. **Output pass:** For each group, extract the page range from the original PDF. This shares resources properly, producing smaller files than merging individual page PDFs.
- **Why:** Guarantees no output file exceeds sizeLimit (since grouped extraction is ≤ sum of individual extractions). Simple, deterministic, no re-measurement loop needed. Minor inefficiency (could pack slightly more pages per group) is acceptable for v1.
- **Status:** Active — governing the Sprint Pack below.
