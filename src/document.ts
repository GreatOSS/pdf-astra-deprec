import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';

export type Annotation = {
  id: string; kind: 'text' | 'highlight' | 'image';
  x: number; y: number; width: number; height: number; angle: number;
  text?: string; size?: number; data?: string;
};
export type PageState = { source: number; rotation: number; annotations: Annotation[] };
export type DocumentState = { pages: PageState[] };

export class History {
  private past: DocumentState[] = [];
  private future: DocumentState[] = [];
  constructor(public current: DocumentState) {}
  get canUndo() { return this.past.length > 0; }
  get canRedo() { return this.future.length > 0; }
  change(edit: (draft: DocumentState) => void) {
    const draft = structuredClone(this.current);
    edit(draft);
    if (JSON.stringify(draft) === JSON.stringify(this.current)) return;
    this.past.push(this.current);
    this.current = draft;
    this.future = [];
  }
  undo() {
    const previous = this.past.pop();
    if (previous) { this.future.push(this.current); this.current = previous; }
  }
  redo() {
    const next = this.future.pop();
    if (next) { this.past.push(this.current); this.current = next; }
  }
}

export function validateText(text: string) {
  // Standard PDF Helvetica supports WinAnsi. Fail before editing, never at export.
  // Full Unicode font embedding is a planned improvement.
  const fontPromise = PDFDocument.create().then(doc => doc.embedFont(StandardFonts.Helvetica));
  return fontPromise.then(font => { font.encodeText(text); return font.widthOfTextAtSize(text, 1); });
}

export async function exportDocument(bytes: Uint8Array, state: DocumentState) {
  const doc = await PDFDocument.load(bytes);
  const originals = doc.getPages();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  // Reuse pages in the original document to retain its resources and metadata.
  const ordered = state.pages.map(p => originals[p.source]);
  while (doc.getPageCount()) doc.removePage(0);
  for (const [index, page] of ordered.entries()) {
    doc.addPage(page);
    const model = state.pages[index];
    page.setRotation(degrees(model.rotation));
    for (const a of model.annotations) {
      const base = { x: a.x, y: a.y, rotate: degrees(a.angle) };
      if (a.kind === 'text') {
        page.drawText(a.text!, { ...base, size: a.size!, font, color: rgb(0.09, 0.19, 0.18) });
      } else if (a.kind === 'highlight') {
        page.drawRectangle({ ...base, width: a.width, height: a.height, color: rgb(1, 0.82, 0.18), opacity: 0.35 });
      } else {
        const image = a.data!.startsWith('data:image/png') ? await doc.embedPng(a.data!) : await doc.embedJpg(a.data!);
        page.drawImage(image, { ...base, width: a.width, height: a.height });
      }
    }
  }
  doc.setProducer('FolioVale · pdf-lib');
  return doc.save();
}

export async function sampleDocument() {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const titles = ['A little room to think.', 'Make your mark.', 'Ready for what comes next.'];
  for (let i = 0; i < titles.length; i++) {
    const page = doc.addPage([595, 842]);
    page.drawRectangle({ x: 0, y: 720, width: 595, height: 122, color: rgb(0.09, 0.24, 0.22) });
    page.drawText('FOLIOVALE  /  FIELD NOTES', { x: 48, y: 782, font: bold, size: 12, color: rgb(0.94, 0.88, 0.73) });
    page.drawText(titles[i], { x: 48, y: 665, font: bold, size: 28, color: rgb(0.09, 0.24, 0.22) });
    const lines = [
      'Good tools give your ideas space to breathe.',
      'This is a real PDF, with selectable text and three pages.',
      '',
      'Try something small:',
      '1. Highlight a sentence you want to remember.',
      '2. Add a note or an image in the open space below.',
      '3. Rotate or reorder a page, then try Undo.',
      '4. Export your PDF and open it again.',
      '',
      'Your original stays untouched. Your documents stay on your device.',
    ];
    lines.forEach((line, n) => page.drawText(line, { x: 48, y: 614 - n * 27, font: regular, size: 12, color: rgb(0.22, 0.29, 0.28) }));
    page.drawLine({ start: { x: 48, y: 94 }, end: { x: 547, y: 94 }, thickness: 1, color: rgb(0.8, 0.83, 0.79) });
    page.drawText(`FolioVale sample document                                 ${i + 1} / 3`, { x: 48, y: 68, font: regular, size: 10, color: rgb(0.4, 0.45, 0.43) });
  }
  return doc.save();
}
