import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, degrees } from 'pdf-lib';
import { History, exportDocument, sampleDocument, validateText, type DocumentState } from '../src/document';

test('edits are immutable and undo/redo preserve page and annotation content', () => {
  const initial: DocumentState = { pages: [{ source: 0, rotation: 0, annotations: [] }, { source: 1, rotation: 0, annotations: [] }] };
  const history = new History(initial);
  history.change(d => { d.pages.reverse(); d.pages[0].rotation = 90; });
  assert.equal(initial.pages[0].source, 0);
  const edited = structuredClone(history.current);
  history.undo(); assert.deepEqual(history.current, initial);
  history.redo(); assert.deepEqual(history.current, edited);
  history.undo(); history.change(d => { d.pages.pop(); });
  assert.equal(history.canRedo, false);
});

test('export keeps original bytes intact and preserves order, rotation, crop box and annotations', async () => {
  const original = await PDFDocument.load(await sampleDocument());
  original.getPage(1).setCropBox(10, 20, 500, 750);
  original.getPage(1).setRotation(degrees(90));
  const bytes = await original.save(); const before = bytes.slice();
  const state: DocumentState = { pages: [
    { source: 1, rotation: 180, annotations: [
      { id: 'text', kind: 'text', text: 'Saved note', size: 18, x: 60, y: 200, width: 90, height: 18, angle: 90 },
      { id: 'highlight', kind: 'highlight', x: 100, y: 400, width: 180, height: 22, angle: 0 },
      { id: 'image', kind: 'image', x: 80, y: 100, width: 30, height: 30, angle: 180, data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==' },
    ] },
    { source: 0, rotation: 0, annotations: [] },
  ] };
  const output = await exportDocument(bytes, state);
  assert.deepEqual(bytes, before);
  const reopened = await PDFDocument.load(output);
  assert.equal(reopened.getPageCount(), 2);
  assert.equal(reopened.getPage(0).getRotation().angle, 180);
  assert.deepEqual(reopened.getPage(0).getCropBox(), { x: 10, y: 20, width: 500, height: 750 });
  assert.equal(reopened.getPage(1).getRotation().angle, 0);
  // Inspect with an independent PDF engine, including actual exported text.
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const pdf = await getDocument({ data: output.slice(), useSystemFonts: true }).promise;
  const text = (await (await pdf.getPage(1)).getTextContent()).items.map(i => 'str' in i ? i.str : '').join(' ');
  assert.match(text, /Make your mark/);
  assert.match(text, /Saved note/);
  await pdf.loadingTask.destroy();
});

test('unsupported text is rejected before it can become an unexportable edit', async () => {
  assert.ok(await validateText('Café — déjà vu') > 0);
  await assert.rejects(validateText('日本語'));
});
