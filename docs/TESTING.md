# Verification log

## 27 September 2026 — initial 0.1 preview

### Automated

- TypeScript strict checking and Vite production build passed.
- 3 model/export tests passed: immutable undo/redo and branching; source-byte preservation, page order/rotation/crop box plus text/image/highlight export; unsupported-character rejection. Exported text was read back using PDF.js, independent of pdf-lib's writer.
- 4 Playwright production-build tests passed across desktop Chromium and Pixel 7 emulation: text annotation → rotate → reorder → undo/redo → reload recovery → export → reopen and inspect actual PDF text; malformed input preserves work; forget clears IndexedDB; no viewport-wide horizontal overflow.
- `npm audit --omit=dev`: zero known vulnerabilities at check time.

### Actual application interaction

Used the browser MCP and graphical desktop tools, not just source inspection:

- Opened the built-in three-page sample. Read and scrolled the rendered pages. Selected a word from the PDF text layer with a double-click.
- Added text, dragged an area highlight, uploaded a PNG, placed it, selected it, removed it, and used undo/redo to restore/remove it.
- Rotated an annotated page, moved it later, downloaded an edited PDF and reopened that downloaded file. Inspected screenshots before export and after reopening: text, highlight and image remained attached to the rotated page in the expected positions.
- Tested a malformed PDF; the existing document remained open. Deleted a page, reloaded through the browser's unsaved-work warning, and restored the two-page edited session with its unexported-change indication.
- Tested the 390×844 responsive layout and a separate touch-enabled mobile browser context: tapped to add a text annotation, selected/removed it, then restored it with Undo. No horizontal page overflow.
- Opened the 14-page PDF.js [TraceMonkey paper](https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf). Verified embedded-font/two-column rendering and text availability. Exercised zoom/fit and scrolled using the desktop computer tool.
- Opened the generated rotated/nonzero-crop-origin PDF, added “Crop check”, exported and reopened it. Visually verified upright added text at the intended position against the rotated original page content. No browser console errors were recorded.

### Problems reproduced and fixed

- Tall PDF pages escaped their grid row and overlapped the footer. Set explicit zero minimum heights on the grid/flex scroll children; rechecked the desktop and mobile page rendering.
- Page organization controls fell below a long page list. Gave the desktop page list its own scroll area, keeping controls at the bottom of the sidebar. Reloaded the 14-page paper and exercised Rotate/Undo again; the controls stayed inside the sidebar.
- Close & forget now also releases in-memory source/session references, in addition to deleting the persisted recovery entry.

### Remaining coverage and rough edges

- Preview, not a broad compatibility certification. Firefox, Safari, real mobile hardware, screen readers, scanned/image-heavy files, interactive forms, outlines/tagging, digital signatures and very large documents still need coverage.
- Unicode/multiline text, annotation drag/resize, keyboard-only annotation placement, document search, continuous reading and real thumbnails remain priorities.
- Image placement currently has fixed automatic sizing; exported additions become page content and cannot be separately selected after reopening.
- Session recovery restores the document and edits, not undo history or reading position. Persistence writes the full session; large documents need storage/performance profiling.
- Startup bundle is comparatively large; PDF libraries should load on demand in a future performance pass.

Local screenshots and downloaded test PDFs are retained under the maintainer's browser artifact directory and ignored `test-output/`. No user documents or private data are checked in.

### Publication verification

- Initial implementation published as `c1efedd` to GreatOSS/pdf. [GitHub CI](https://github.com/GreatOSS/pdf/actions/runs/36301920239) passed.
- Initial Pages run failed because repository Pages hosting was not enabled. Enabled GitHub Actions as the Pages source, reran the workflow, and [deployment succeeded](https://github.com/GreatOSS/pdf/actions/runs/36301920260).
- Opened the actual public site at https://greatoss.github.io/pdf/, loaded the sample, added text, exported and reopened the downloaded PDF. The added text appeared in the reopened PDF's text layer. No browser console errors; observed network requests were same-origin static GETs, with no document uploads.
