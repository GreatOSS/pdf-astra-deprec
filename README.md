# FolioVale

**Your PDFs, at ease.** A free, open-source, local-first PDF viewer and editor.

**[Open FolioVale](https://greatoss.github.io/pdf/)** · [Report a problem](https://github.com/GreatOSS/pdf/issues) · [Product direction](docs/NAME-AND-DIRECTION.md)

FolioVale runs in your browser. Documents are processed on your device, without accounts, uploads, watermarks or analytics. This is an early **0.1 preview**, developed from scratch in **GreatOSS/pdf**.

## What works today

- PDF.js rendering with selectable text, page navigation, zoom and fit width.
- Add text, area highlights and PNG/JPEG images.
- Rotate, reorder and delete pages; undo and redo edits.
- Export an edited PDF without overwriting the original.
- Recover the last document and its edits after reloading the browser.
- Responsive desktop/mobile controls, touch placement and keyboard shortcuts.

Choose **Open a PDF**, drop a file, or use the built-in sample. **Help** explains the tools and shortcuts. **Export PDF** starts a download; check your browser downloads for the saved copy. Reopened exports contain flattened additions, so individual added annotations are no longer editable as separate items.

## Run locally

Requires Node.js 24 and npm.

```sh
git clone https://github.com/GreatOSS/pdf.git
cd pdf
npm ci
npm run dev
```

Open the localhost URL printed by Vite. For the production app:

```sh
npm run build
npm run preview
```

Deploy the contents of `dist/` to a static HTTPS host. Relative asset paths support subdirectory hosting. Runtime fonts, character maps and the PDF worker are included; PDFs never need a backend. A packaged desktop installer and guaranteed offline/PWA installation are not available yet.

## Keeping your work

Edits leave the source file untouched. “Changes to export” means the current state differs from the last exported state. Download-start confirmation is not a claim that the operating system has finished writing the file.

The most recent session (including PDF bytes and images) is kept in **IndexedDB on this browser profile**. This is convenience recovery, not a backup: browser storage can be cleared or denied. Export important work. **Close & forget document** or **Forget** on the welcome screen deletes that session. Undo history is in memory and is not restored after a reload. Closing a tab with unexported edits requests the browser's leave confirmation.

## Preview boundaries

FolioVale adds content; it does not rewrite existing PDF text. Text additions currently support Helvetica's Latin/WinAnsi repertoire on a single line. Unsupported characters are rejected before an edit is created. Images use automatic sizing and can be removed/re-added; move/resize handles are planned.

No OCR, secure redaction, form filling, interactive document links, password-protected editing, digital signature validation, or multi-file merge yet. Highlights do not hide or remove underlying content. Editing may invalidate digital signatures. Some PDF structures such as outlines, tagged reading order and form references need additional compatibility work when pages are deleted or reordered. Verify important exports with your target reader.

## Development and verification

```sh
npm test                     # model + export correctness, independent PDF.js readback
npm run fixtures             # local representative PDFs in ignored test-output/
npx playwright install chromium
npm run test:browser         # production build + desktop/mobile browser workflows
```

CI runs the same checks. Website deployment is gated on tests. See [testing notes](docs/TESTING.md) for actual hands-on coverage and remaining rough edges. Please include your browser/OS and reproduction steps in reports. Only attach documents you are comfortable making public.

## Name, license and dependencies

[Naming checks and research](docs/NAME-AND-DIRECTION.md) record why **FolioVale** was selected. The repository remains **GreatOSS/pdf**.

FolioVale is MIT licensed. PDF rendering uses [PDF.js](https://github.com/mozilla/pdf.js) (Apache-2.0); PDF writing uses [pdf-lib](https://github.com/Hopding/pdf-lib) (MIT). Dependency license notices are retained in bundled artifacts and installed packages.
