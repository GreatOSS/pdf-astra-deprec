# FolioVale: name and direction

Decision: **FolioVale**, 27 September 2026. “Folio” evokes documents; “vale” evokes a quiet space. Display name: FolioVale. Package identifier: `foliovale`. Canonical repository: **GreatOSS/pdf**, kept independent of the product name.

## Naming checks

- GitHub REST repository search `q=foliovale`: zero matching repositories (complete results).
- npm registry `npm view foliovale name version`: E404, no package registered under that exact name.
- PyPI `https://pypi.org/pypi/foliovale/json`: HTTP 404.
- DuckDuckGo exact-name search `"FolioVale"`: results were unrelated `port.foliovale` Instagram portfolio/audio accounts. No obvious PDF/software product conflict in returned results.
- Google exact-name and name-plus-PDF queries were attempted; returned an access/interstitial page, so are **not** counted as successful negative checks.
- Reviewed existing PDF tool names and positioning: PDFgear, Stirling PDF, Adobe Acrobat, PDF.js, Okular, SumatraPDF, PDF Arranger. No obvious name collision.

These are practical discoverability checks, not trademark clearance or a claim of exclusive ownership. No previous product exists in this fresh repository, so no compatibility aliases are needed. No legacy implementation was imported.

## Research and first scope

Sources reviewed on 27 September 2026:

- https://www.pdfgear.com/ — prominently offers no-sign-up reading, editing, annotation, page organization and export across devices. Clear reference for straightforward onboarding.
- https://www.stirlingpdf.com/ — privacy, deployment choice, reading, editing and document operations. A large feature set should not come at the expense of navigability.
- https://github.com/Stirling-Tools/Stirling-PDF/issues/8205 — user request for visible Save / Save As feedback. Implement distinct unexported-change status and explicit download-start feedback.
- https://github.com/Stirling-Tools/Stirling-PDF/issues/8204 — user request to clear file history. Implement an obvious Close & forget control and a Forget action for recovery.
- GreatOSS/pdf issue and PR lists: empty at project start. Archived project issue backlog is outside this fresh implementation.

First deliverable: a browser app with bundled PDF.js rendering, selectable text, page navigation/zoom, additive text/highlight/image annotations, page organization, undo/redo, local session recovery and real PDF export. No server receives documents. No remote fonts, analytics or runtime CDN dependencies.

Explicit preview limits: no rewriting existing PDF text, merging, OCR, form filling, secure redaction, signature validation, or password-protected editing. Text additions initially use Helvetica/WinAnsi and reject unsupported characters before adding an edit. Images initially have automatic sizing and can be deleted/re-added; dragging/resizing is a next UX priority. Original document links/forms are not interactive in this initial reader.

## Next priorities

1. Improve compatibility corpus: complex fonts, scanned PDFs, nonzero crop origins, forms, links, signed documents, large files and hostile/malformed files.
2. Browser automation for crash recovery and cross-page export invariants, plus recurring actual desktop/mobile app interaction.
3. Annotation move/resize, multiline and Unicode text; accessible non-pointer placement.
4. Search, thumbnails, continuous reading, bookmarks and form interaction.
5. Installation/offline experience, multi-file merge and recovery management.

Correctness wins over claiming completeness. Keep preview labeling until compatibility and recovery evidence supports stronger claims.
