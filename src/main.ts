import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import 'pdfjs-dist/web/pdf_viewer.css';
import './style.css';
import { PDFDocument } from 'pdf-lib';
import { History, exportDocument, sampleDocument, validateText, type Annotation } from './document';
import { loadSession, storeSession, type Session } from './storage';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const button = (id: string, fn: () => unknown) => $(id).addEventListener('click', () => { void fn(); });
const disabled = (id: string, value: boolean) => { $<HTMLButtonElement>(id).disabled = value; };
const svgNS = 'http://www.w3.org/2000/svg';
let pdf: pdfjs.PDFDocumentProxy | undefined;
let bytes: Uint8Array;
let name = '';
let history: History;
let current = 0;
let scale = 1;
let fit = true;
let exported = '';
let selected: string | undefined;
let tool: 'select' | 'text' | 'highlight' | 'image' = 'select';
let image: { data: string; width: number; height: number } | undefined;
let viewport: ReturnType<pdfjs.PDFPageProxy['getViewport']> | undefined;
let renderTask: pdfjs.RenderTask | undefined;
let textTask: pdfjs.TextLayer | undefined;
let generation = 0;
let opening = false;
let rendering = false;
let noticeTimer: ReturnType<typeof setTimeout>;
let persistQueue = Promise.resolve();
let recovery: Session | undefined;

function notice(message: string, error = false) {
  $('notice').textContent = message;
  $('notice').classList.toggle('error', error);
  $('notice').hidden = false;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => { $('notice').hidden = true; }, error ? 14000 : 6500);
}
function dirty() { return !!history && JSON.stringify(history.current) !== exported; }
function persist(clear = false) {
  const snapshot: Session | undefined = clear ? undefined : { bytes, name, state: history.current, exported };
  persistQueue = persistQueue.catch(() => {}).then(() => storeSession(snapshot)).then(() => {
    $('session-status').textContent = 'Session saved in this browser';
  }).catch(() => {
    $('session-status').textContent = 'Recovery unavailable — export to keep your work';
    notice('This browser could not save session recovery. Export a PDF to keep your changes.', true);
  });
}
function update() {
  if (!pdf) return;
  const pages = history.current.pages;
  current = Math.max(0, Math.min(current, pages.length - 1));
  $('filename').textContent = name;
  $('filename').title = name;
  $('save-state').textContent = dirty() ? 'Changes to export' : 'No unexported changes';
  $('save-state').classList.toggle('dirty', dirty());
  disabled('undo', !history.canUndo); disabled('redo', !history.canRedo);
  disabled('previous', current === 0); disabled('next', current === pages.length - 1);
  disabled('move-up', current === 0); disabled('move-down', current === pages.length - 1);
  disabled('delete-page', pages.length === 1);
  $('page-count').textContent = String(pages.length);
  $('page-total').textContent = `of ${pages.length}`;
  $<HTMLInputElement>('page-number').value = String(current + 1);
  $<HTMLInputElement>('page-number').max = String(pages.length);
  $('page-list').replaceChildren(...pages.map((page, index) => {
    const el = document.createElement('button');
    el.className = 'page-item';
    el.setAttribute('aria-label', `Go to page ${index + 1}, original page ${page.source + 1}`);
    el.setAttribute('aria-current', String(index === current));
    const thumbnail = document.createElement('span');
    thumbnail.className = 'mini-page'; thumbnail.textContent = String(index + 1);
    const label = document.createElement('span');
    label.textContent = `Page ${index + 1}`;
    const detail = document.createElement('small');
    detail.textContent = `Original ${page.source + 1}${page.rotation ? ` · ${page.rotation}°` : ''}${page.annotations.length ? ' · edited' : ''}`;
    label.append(detail); el.append(thumbnail, label);
    el.onclick = () => go(index);
    return el;
  }));
}
function change(fn: Parameters<History['change']>[0], rerender = false) {
  history.change(fn);
  selected = undefined;
  update(); persist();
  if (rerender) void render(); else drawAnnotations();
}
function go(index: number) {
  if (!pdf) return;
  current = Math.max(0, Math.min(index, history.current.pages.length - 1));
  selected = undefined;
  update(); void render();
  $('page-scroll').scrollTop = 0;
}
async function render() {
  if (!pdf) return;
  const token = ++generation;
  rendering = true;
  renderTask?.cancel(); textTask?.cancel();
  const previous = renderTask;
  $('page-loading').textContent = 'Rendering…';
  $('page-surface').style.visibility = 'hidden';
  try {
    await previous?.promise.catch(() => {});
    if (token !== generation) return;
    const model = history.current.pages[current];
    const page = await pdf.getPage(model.source + 1);
    if (token !== generation) return;
    const natural = page.getViewport({ scale: 1, rotation: model.rotation });
    if (fit) scale = Math.min(2, Math.max(0.2, ($('page-scroll').clientWidth - 40) / natural.width));
    viewport = page.getViewport({ scale, rotation: model.rotation });
    const canvas = $<HTMLCanvasElement>('pdf-canvas');
    // Bound bitmap memory while keeping text crisp on high-density screens.
    const density = Math.min(devicePixelRatio || 1, 2, Math.sqrt(16_000_000 / (viewport.width * viewport.height)));
    canvas.width = Math.floor(viewport.width * density); canvas.height = Math.floor(viewport.height * density);
    canvas.style.width = `${viewport.width}px`; canvas.style.height = `${viewport.height}px`;
    $('page-surface').style.width = `${viewport.width}px`; $('page-surface').style.height = `${viewport.height}px`;
    $('text-layer').replaceChildren();
    $('text-layer').style.setProperty('--scale-factor', String(scale));
    $('text-layer').style.setProperty('--total-scale-factor', String(scale));
    renderTask = page.render({ canvas, viewport, transform: [density, 0, 0, density, 0, 0] });
    await renderTask.promise;
    if (token !== generation) return;
    textTask = new pdfjs.TextLayer({ textContentSource: page.streamTextContent(), container: $('text-layer'), viewport });
    await textTask.render();
    if (token !== generation) return;
    $('zoom-value').textContent = `${Math.round(scale * 100)}%`;
    drawAnnotations();
    $('page-loading').textContent = '';
    $('page-surface').style.visibility = 'visible';
  } catch (error) {
    if (token === generation) {
      $('page-loading').textContent = 'Could not render this page';
      notice(`Unable to display this page: ${error instanceof Error ? error.message : 'unknown error'}`, true);
    }
  } finally { if (token === generation) rendering = false; }
}
function drawAnnotations() {
  if (!viewport || !pdf) return;
  const svg = $('annotation-layer');
  svg.setAttribute('viewBox', `0 0 ${viewport.width} ${viewport.height}`);
  svg.replaceChildren();
  const group = document.createElementNS(svgNS, 'g');
  group.setAttribute('transform', `matrix(${viewport.transform.join(' ')})`);
  svg.append(group);
  for (const a of history.current.pages[current].annotations) {
    const wrapper = document.createElementNS(svgNS, 'g');
    wrapper.setAttribute('transform', `translate(${a.x} ${a.y}) rotate(${a.angle}) scale(1 -1)`);
    wrapper.dataset.id = a.id;
    wrapper.setAttribute('role', 'button');
    wrapper.setAttribute('tabindex', '0');
    wrapper.setAttribute('aria-label', `${a.kind === 'text' ? a.text : a.kind} annotation. Select then press Delete to remove.`);
    const hit = document.createElementNS(svgNS, 'rect');
    hit.setAttribute('x', '-2'); hit.setAttribute('y', String(-a.height - 2));
    hit.setAttribute('width', String(a.width + 4)); hit.setAttribute('height', String(a.height + 4));
    hit.setAttribute('fill', 'transparent');
    if (selected === a.id) { hit.setAttribute('stroke', '#167bcb'); hit.setAttribute('stroke-width', String(2 / scale)); }
    wrapper.append(hit);
    if (a.kind === 'text') {
      const text = document.createElementNS(svgNS, 'text');
      text.textContent = a.text!;
      text.setAttribute('font-size', String(a.size)); text.setAttribute('font-family', 'Arial, Helvetica, sans-serif');
      text.setAttribute('fill', '#17302e');
      wrapper.append(text);
    } else if (a.kind === 'highlight') {
      const rect = document.createElementNS(svgNS, 'rect');
      rect.setAttribute('y', String(-a.height)); rect.setAttribute('width', String(a.width)); rect.setAttribute('height', String(a.height));
      rect.setAttribute('fill', '#ffd12e'); rect.setAttribute('fill-opacity', '.35'); wrapper.append(rect);
    } else {
      const image = document.createElementNS(svgNS, 'image');
      image.setAttribute('href', a.data!); image.setAttribute('y', String(-a.height));
      image.setAttribute('width', String(a.width)); image.setAttribute('height', String(a.height)); wrapper.append(image);
    }
    wrapper.addEventListener('click', e => { if (tool === 'select') { e.stopPropagation(); selected = a.id; drawAnnotations(); notice('Annotation selected. Press Delete or use Remove selected.', false); showRemove(); } });
    wrapper.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selected = a.id; drawAnnotations(); showRemove(); } });
    group.append(wrapper);
  }
  if (!selected) document.getElementById('remove-annotation')?.remove();
}
function showRemove() {
  document.getElementById('remove-annotation')?.remove();
  const remove = document.createElement('button'); remove.id = 'remove-annotation'; remove.className = 'danger';
  remove.textContent = 'Remove selected'; remove.onclick = removeSelected;
  document.querySelector('.navigation')!.append(remove);
}
function removeSelected() {
  if (selected) { const id = selected; change(d => { d.pages[current].annotations = d.pages[current].annotations.filter(a => a.id !== id); }); }
}
function setTool(next: typeof tool) {
  tool = next; selected = undefined; drawAnnotations();
  for (const kind of ['select', 'text', 'highlight', 'image']) $( `tool-${kind}`).setAttribute('aria-pressed', String(kind === tool));
  $('page-surface').dataset.tool = tool;
  $('tool-options').hidden = tool === 'select';
  $('text-option').hidden = tool !== 'text'; $('size-option').hidden = tool !== 'text';
  $('tool-hint').textContent = tool === 'text' ? 'Enter text, then click the page to place it.' : tool === 'highlight' ? 'Drag across the area to highlight. Escape to finish.' : 'Click the page to place your image. Escape to finish.';
}
async function openDocument(data: Uint8Array, filename: string, restored?: Session) {
  if (opening) return;
  if (dirty() && !confirm('Open another document? Export first if you want to keep the current changes.')) return;
  opening = true; notice('Opening your PDF…');
  let candidate: pdfjs.PDFDocumentProxy | undefined;
  try {
    const editable = await PDFDocument.load(data);
    const assets = import.meta.env.DEV ? `${import.meta.env.BASE_URL}node_modules/pdfjs-dist/` : `${import.meta.env.BASE_URL}pdfjs/`;
    candidate = await pdfjs.getDocument({ data: data.slice(), cMapUrl: `${assets}cmaps/`, cMapPacked: true, standardFontDataUrl: `${assets}standard_fonts/`, wasmUrl: `${assets}wasm/`, iccUrl: `${assets}iccs/` }).promise;
    const state = restored?.state ?? { pages: editable.getPages().map((p, source) => ({ source, rotation: ((p.getRotation().angle % 360) + 360) % 360, annotations: [] })) };
    if (!state.pages.length) throw new Error('This document has no pages.');
    ++generation; renderTask?.cancel(); textTask?.cancel();
    await renderTask?.promise.catch(() => {});
    await pdf?.loadingTask.destroy();
    pdf = candidate; candidate = undefined;
    bytes = data; name = filename; history = new History(state); exported = restored?.exported ?? JSON.stringify(state);
    current = 0; fit = true; viewport = undefined; selected = undefined;
    $('welcome').hidden = true; $('editor').hidden = false;
    document.title = `${name} — FolioVale`;
    setTool('select'); update(); persist(); await render();
    notice(restored ? 'Session restored. Export to keep a PDF copy.' : 'PDF opened. Your original file stays untouched.');
  } catch (error) {
    await candidate?.loadingTask.destroy();
    const message = error instanceof Error ? error.message : 'Invalid PDF';
    notice(/encrypt|password/i.test(message) ? 'Password-protected PDFs are not supported yet. Open an unlocked copy.' : `Could not open this PDF. Your current document is safe. ${message}`, true);
  } finally { opening = false; }
}
async function openFile(file?: File) {
  if (!file) return;
  try { await openDocument(new Uint8Array(await file.arrayBuffer()), file.name); }
  catch { notice('The file could not be read. Please try again.', true); }
}
async function exportPDF() {
  if (!pdf) return;
  disabled('export', true);
  const snapshot = history.current; const source = bytes; const filename = name;
  notice('Preparing your PDF…');
  try {
    const output = await exportDocument(source, snapshot);
    const url = URL.createObjectURL(new Blob([new Uint8Array(output)], { type: 'application/pdf' }));
    const link = document.createElement('a'); link.href = url;
    link.download = `${filename.replace(/\.pdf$/i, '')}-foliovale.pdf`;
    document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 60_000);
    if (bytes === source) { exported = JSON.stringify(snapshot); update(); persist(); }
    notice('PDF download started. Check your downloads for the exported copy.');
  } catch (error) { notice(`Export failed. Your edits are still here. ${error instanceof Error ? error.message : ''}`, true); }
  finally { disabled('export', false); }
}

button('open-welcome', () => $('pdf-input').click()); button('open-other', () => $('pdf-input').click());
$('pdf-input').addEventListener('change', e => { const input = e.target as HTMLInputElement; void openFile(input.files?.[0]); input.value = ''; });
button('sample', async () => openDocument(await sampleDocument(), 'Welcome to FolioVale.pdf'));
button('export', exportPDF);
button('help-button', () => $<HTMLDialogElement>('help-dialog').showModal());
button('tool-select', () => setTool('select')); button('tool-text', () => { setTool('text'); $('annotation-text').focus(); });
button('tool-highlight', () => setTool('highlight')); button('tool-image', () => $('image-input').click());
$('image-input').addEventListener('change', async e => {
  const input = e.target as HTMLInputElement; const file = input.files?.[0]; input.value = '';
  if (!file) return;
  if (!['image/png', 'image/jpeg'].includes(file.type)) { notice('Choose a PNG or JPEG image.', true); return; }
  if (file.size > 20 * 1024 * 1024) { notice('Please choose an image smaller than 20 MB.', true); return; }
  try {
    const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
    const img = new Image(); img.src = data; await img.decode();
    image = { data, width: img.naturalWidth, height: img.naturalHeight }; setTool('image');
  } catch { notice('This image could not be read.', true); }
});
button('undo', () => { history.undo(); selected = undefined; update(); persist(); void render(); });
button('redo', () => { history.redo(); selected = undefined; update(); persist(); void render(); });
button('rotate', () => change(d => { d.pages[current].rotation = (d.pages[current].rotation + 90) % 360; }, true));
button('move-up', () => { const index = current; if (index > 0) { current--; change(d => { [d.pages[index - 1], d.pages[index]] = [d.pages[index], d.pages[index - 1]]; }, true); } });
button('move-down', () => { const index = current; if (index < history.current.pages.length - 1) { current++; change(d => { [d.pages[index + 1], d.pages[index]] = [d.pages[index], d.pages[index + 1]]; }, true); } });
button('delete-page', () => { if (history.current.pages.length > 1) { change(d => { d.pages.splice(current, 1); }, true); notice('Page deleted. Undo brings it back.'); } });
button('previous', () => go(current - 1)); button('next', () => go(current + 1));
$('page-number').addEventListener('change', () => { const value = $<HTMLInputElement>('page-number').valueAsNumber; go(Number.isFinite(value) ? value - 1 : current); });
button('zoom-out', () => { fit = false; scale = Math.max(0.25, scale / 1.25); void render(); });
button('zoom-in', () => { fit = false; scale = Math.min(4, scale * 1.25); void render(); });
button('fit', () => { fit = true; void render(); });
let resizeTimer: ReturnType<typeof setTimeout>;
new ResizeObserver(() => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { if (pdf && fit) void render(); }, 150); }).observe($('page-scroll'));

function point(event: PointerEvent) {
  const box = $('page-surface').getBoundingClientRect();
  return { x: Math.max(0, Math.min(box.width, event.clientX - box.left)), y: Math.max(0, Math.min(box.height, event.clientY - box.top)) };
}
let drag: { x: number; y: number; pointer: number } | undefined;
let preview: SVGRectElement | undefined;
$('page-surface').addEventListener('pointerdown', e => {
  if (!pdf || rendering || e.button !== 0 || tool !== 'highlight') return;
  e.preventDefault(); drag = { ...point(e), pointer: e.pointerId };
  $('page-surface').setPointerCapture(e.pointerId);
  preview = document.createElementNS(svgNS, 'rect'); preview.setAttribute('fill', '#ffd12e'); preview.setAttribute('fill-opacity', '.35'); $('annotation-layer').append(preview);
});
$('page-surface').addEventListener('pointermove', e => {
  if (!drag || !preview) return;
  const p = point(e);
  for (const [key, value] of Object.entries({ x: Math.min(p.x, drag.x), y: Math.min(p.y, drag.y), width: Math.abs(p.x - drag.x), height: Math.abs(p.y - drag.y) })) preview.setAttribute(key, String(value));
});
$('page-surface').addEventListener('pointercancel', () => { drag = undefined; preview?.remove(); });
$('page-surface').addEventListener('pointerup', async e => {
  if (!pdf || !viewport || rendering || e.button !== 0) return;
  const p = point(e);
  const model = history.current.pages[current];
  const v = viewport;
  let annotation: Annotation | undefined;
  if (tool === 'highlight' && drag) {
    const start = drag; drag = undefined; preview?.remove();
    if (Math.abs(p.x - start.x) < 4 || Math.abs(p.y - start.y) < 4) return;
    const [x, y] = v.convertToPdfPoint(Math.min(p.x, start.x), Math.max(p.y, start.y));
    annotation = { id: crypto.randomUUID(), kind: 'highlight', x, y, width: Math.abs(p.x - start.x) / scale, height: Math.abs(p.y - start.y) / scale, angle: model.rotation };
  } else if (tool === 'text') {
    const text = $<HTMLInputElement>('annotation-text').value.trim();
    const size = $<HTMLInputElement>('font-size').valueAsNumber;
    if (!text) { notice('Enter the text you want to add, then click the page.', true); $('annotation-text').focus(); return; }
    if (!Number.isFinite(size) || size < 8 || size > 96) { notice('Choose a text size from 8 to 96.', true); return; }
    let width: number;
    try { width = await validateText(text) * size; } catch { notice('This preview supports Latin text and common punctuation. Some of these characters need a font we do not support yet.', true); return; }
    if (model !== history.current.pages[current] || v !== viewport) return;
    if (width * scale > v.width) { notice('This line is wider than the page. Use shorter text or a smaller size.', true); return; }
    const [x, y] = v.convertToPdfPoint(Math.min(p.x, v.width - width * scale), Math.max(size * scale, Math.min(p.y, v.height - size * scale * 0.25)));
    annotation = { id: crypto.randomUUID(), kind: 'text', x, y, width, height: size, size, text, angle: model.rotation };
  } else if (tool === 'image' && image) {
    const width = Math.min(180, v.width / scale * 0.4, v.height / scale * 0.4 * image.width / image.height);
    const height = width * image.height / image.width;
    const [x, y] = v.convertToPdfPoint(Math.min(p.x, v.width - width * scale), Math.min(p.y + height * scale, v.height));
    annotation = { id: crypto.randomUUID(), kind: 'image', x, y, width, height, data: image.data, angle: model.rotation };
  }
  if (annotation) { const item = annotation; change(d => { d.pages[current].annotations.push(item); }); }
});
document.addEventListener('keydown', e => {
  const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target instanceof HTMLElement && e.target.isContentEditable);
  if (e.key === 'Escape') { setTool('select'); return; }
  if (!pdf || $<HTMLDialogElement>('help-dialog').open) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); void exportPDF(); }
  if (typing) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); $(e.shiftKey ? 'redo' : 'undo').click(); }
  if ((e.key === 'Delete' || e.key === 'Backspace') && selected) { e.preventDefault(); removeSelected(); }
});
window.addEventListener('beforeunload', e => { if (dirty()) { e.preventDefault(); e.returnValue = ''; } });
document.addEventListener('dragover', e => { if (e.dataTransfer?.types.includes('Files')) e.preventDefault(); });
document.addEventListener('drop', e => {
  if (!e.dataTransfer?.files.length) return;
  e.preventDefault();
  if (e.dataTransfer.files.length > 1) notice('Opening the first file. Multi-file merging is not available yet.');
  void openFile(e.dataTransfer.files[0]);
});
button('close-document', async () => {
  if (dirty() && !confirm('Forget this session and its unexported changes? Export a PDF first if you want to keep them.')) return;
  ++generation; renderTask?.cancel(); textTask?.cancel();
  await renderTask?.promise.catch(() => {}); await pdf?.loadingTask.destroy(); pdf = undefined;
  history = new History({ pages: [] }); exported = JSON.stringify(history.current);
  bytes = new Uint8Array(); name = ''; recovery = undefined;
  selected = undefined; image = undefined; viewport = undefined;
  persist(true); $('editor').hidden = true; $('welcome').hidden = false; $('recovery').hidden = true;
  $('pdf-canvas').setAttribute('width', '0'); $('text-layer').replaceChildren(); $('annotation-layer').replaceChildren();
  document.title = 'FolioVale — Your PDFs, at ease'; notice('Document closed. Local session recovery removed.');
});
button('restore', async () => { if (recovery) await openDocument(recovery.bytes, recovery.name, recovery); });
button('discard-recovery', () => { recovery = undefined; persist(true); $('recovery').hidden = true; });
void loadSession().then(session => { recovery = session; if (session && !pdf) { $('recovery-name').textContent = session.name; $('recovery').hidden = false; } }).catch(() => {});
