import { mkdir, writeFile } from 'node:fs/promises';
import { PDFDocument, degrees } from 'pdf-lib';
import { sampleDocument } from '../src/document';

await mkdir('test-output', { recursive: true });
await writeFile('test-output/sample.pdf', await sampleDocument());
const doc = await PDFDocument.load(await sampleDocument());
doc.getPage(0).setCropBox(20, 40, 550, 770);
doc.getPage(0).setRotation(degrees(90));
await writeFile('test-output/rotated-cropped.pdf', await doc.save());
await writeFile('test-output/image.png', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64'));
await writeFile('test-output/invalid.pdf', 'This is not a PDF.');
