const test = require('node:test');
const assert = require('node:assert/strict');
const PDFDocument = require('pdfkit');
const { PDFProcessor } = require('../lib/pdfProcessor');

const fixture = () => new Promise((resolve, reject) => {
  const pdf = new PDFDocument({ size: 'A4', margin: 40 });
  const chunks = [];
  pdf.on('data', (chunk) => chunks.push(chunk));
  pdf.on('error', reject);
  pdf.on('end', () => resolve(Buffer.concat(chunks)));
  pdf.fontSize(12).text('Synthetic upload verification. Source transparency requires the researcher to inspect cited passages and retain the original document.');
  pdf.addPage().text('Second page: human review is required before relying on a generated policy draft. This fixture is not legal guidance.');
  pdf.end();
});

test('real PDF upload Buffer parses without XRef corruption and retains page identity', async () => {
  const buffer = await fixture();
  const original = Buffer.from(buffer);
  const parsed = await new PDFProcessor().parsePDFBuffer(buffer);
  assert.equal(parsed.numPages, 2);
  assert.equal(parsed.pages.length, 2);
  assert.match(parsed.pages[0], /Source transparency/);
  assert.match(parsed.pages[1], /Second page: human review/);
  assert.deepEqual(buffer, original, 'Parser must not mutate private upload bytes');
});
