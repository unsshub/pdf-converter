# Technical Risks & Vulnerabilities

## RISK-001: System CLI Dependency Fragility
- **Category:** Infrastructure
- **Description:** LibreOffice, pdftk, Ghostscript, and pdftoppm must be installed at the system level. Missing binaries cause silent fallback failures.
- **Mitigation:** Aggressive fallback chains reduce single-point-of-failure risk. Should add startup health checks that verify CLI availability.
- **Severity:** Medium

## RISK-002: File Cleanup / Disk Exhaustion
- **Category:** Resource Management
- **Description:** Uploaded files and conversion outputs accumulate in uploads/ and output/ directories. No visible cleanup mechanism documented.
- **Mitigation:** Need a scheduled cleanup job (cron or BullMQ repeatable) that purges files older than N minutes.
- **Severity:** High (will cause production disk-full failures)

## RISK-003: Split by Size — Edge Cases
- **Category:** Feature Logic
- **Description:** Splitting by file size is inherently imprecise. A single page may exceed the size limit. Compressed vs uncompressed size ambiguity. PDF structure (embedded fonts, images) makes size-per-page non-uniform.
- **Mitigation:** ADR-007 resolved: oversized pages allowed as own file. ADR-008 resolved: two-pass measurement + greedy bin-packing.
- **Severity:** Low (resolved by ADR-007 and ADR-008)

## RISK-004: Cloud Token Expiry During Long Jobs
- **Category:** Integration
- **Description:** If a cloud-sourced file takes long to download and the access token expires mid-transfer, the job will fail with a potentially unhelpful error.
- **Mitigation:** Validate token freshness before starting download; implement retry with refreshed token.
- **Severity:** Low

## RISK-005: Concurrent Job Resource Contention
- **Category:** Performance
- **Description:** Without Redis queue enforcement, direct in-process execution processes jobs synchronously. Multiple simultaneous conversions could exhaust CPU/memory (LibreOffice is particularly heavy).
- **Mitigation:** Consider a concurrency limiter even in fallback mode.
- **Severity:** Medium

## RISK-006: Frontend sizeLimit Unit Mismatch
- **Category:** Integration
- **Description:** Frontend sends `sizeLimit` in MB (user-friendly). Backend `processSplit` converts to bytes (`sizeLimitMB * 1024 * 1024`). The `splitBySize` algorithm itself works in bytes. If the Prisma schema stores the raw MB value but the route handler doesn't convert correctly, files could be split at wrong boundaries.
- **Mitigation:** Verify the split route handler passes `sizeLimit` correctly. Test with a known-size PDF.
- **Severity:** Medium (untested end-to-end)

## RISK-007: Infrastructure Availability
- **Category:** Infrastructure
- **Description:** PostgreSQL and Redis run natively (not Docker in this environment). If either service goes down, the backend will fail.
- **Mitigation:** Add a startup health-check endpoint that verifies DB and Redis connectivity.
- **Severity:** Medium
