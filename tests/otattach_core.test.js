// 10월 시간외 원인행위 붙임: node --test tests/otattach_core.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const zlib = require('zlib');
const C = require('../js/otattach-core.js');
const { PDFDocument } = require('../js/vendor/pdf-lib.min.js');

const JPG = fs.readFileSync(require('path').join(__dirname, 'fixtures/otattach/tiny.jpg'));

function inflate(u8) {
  try { return zlib.inflateSync(u8); }
  catch (e) { return null; }
}

function pdfWithStream(data, filter) {
  const dict = `<< /Length ${data.length}${filter ? ' /Filter /' + filter : ''} >>`;
  return Buffer.concat([
    Buffer.from('%PDF-1.4\n1 0 obj\n' + dict + '\nstream\n'),
    Buffer.from(data),
    Buffer.from('\nendstream\nendobj\n%%EOF\n')
  ]);
}

test('지급내역표에서 봇 표기·볼트 경로만 빼고 표는 남긴다', () => {
  const raw = [
    '---',
    '만든봇: 연습',
    '원본경로: 봇공유/예시',
    '---',
    '구분,시간,금액',
    '주간,2,1000',
    '봇 메모: 빼기',
    '자동생성: 예'
  ].join('\n');
  const cleaned = C.cleanPayText(raw);
  assert.match(cleaned.text, /주간,2,1000/);
  assert.equal(cleaned.text.includes('만든봇'), false);
  assert.equal(cleaned.text.includes('봇공유'), false);
  assert.equal(cleaned.text.includes('봇 메모'), false);
  assert.ok(cleaned.dropped >= 3);
});

test('봇 표기만 있는 표는 빈 내용이라 종이를 만들지 않는다', () => {
  const cleaned = C.cleanPayText('만든봇: 연습\n원본경로: 봇공유/예시\n');
  assert.equal(cleaned.text, '');
});

test('파일 이름은 칸으로 나누고, 폴더 이름보다 파일 이름을 먼저 본다', () => {
  assert.equal(C.matchSlot('지급내역/통장사본.jpg').id, 'bank');
  assert.equal(C.matchSlot('신분증/scan.jpg').id, 'idcard');
  assert.equal(C.matchSlot('10월_지급내역표.csv').id, 'pay');
  assert.equal(C.matchSlot('메모.txt'), null);
});

test('네 칸이 다 있으면 합치고, 빠지면 목록만 낸다', async () => {
  const files = [
    { name: '지급내역표.csv', text: '구분,시간,금액\n주간,2,1000\n' },
    { name: '신분증.jpg', bytes: JPG },
    { name: '재직증명서.jpg', bytes: JPG },
    { name: '통장사본.jpg', bytes: JPG }
  ];
  const ready = await C.plan(files, inflate);
  assert.equal(ready.ok, true);
  assert.equal(ready.checklistOnly, false);
  assert.equal(ready.outName, '2026-10_시간외근무수당_원인행위붙임.pdf');
  assert.deepEqual(ready.slots.map((s) => s.id), ['pay', 'idcard', 'employ', 'bank']);
  assert.equal(ready.slots[0].text.includes('주간,2,1000'), true);
  assert.equal(C.hasForbiddenText(ready.slots[0].text), false);

  const missing = await C.plan(files.slice(0, 3), inflate);
  assert.equal(missing.ok, false);
  assert.equal(missing.checklistOnly, true);
  const bank = missing.slots.find((s) => s.id === 'bank');
  assert.equal(bank.state, 'missing');
  assert.equal(bank.text, '');
  assert.equal(bank.role, '');
});

test('봇 표기가 섞인 PDF는 넣지 않고, 압축 안도 확인한다', async () => {
  const phrase = Buffer.from('만든봇\n', 'utf8');
  const comp = zlib.deflateSync(phrase);
  assert.equal(C.bytesHaveForbidden(comp), false);
  const hidden = await C.scanPdf(pdfWithStream(comp, 'FlateDecode'), inflate);
  assert.equal(hidden.forbidden, true);

  const raw = await C.scanPdf(Buffer.from('%PDF-1.4\n봇공유/예시\n%%EOF\n'), inflate);
  assert.equal(raw.forbidden, true);

  const junk = await C.scanPdf(pdfWithStream(Buffer.from('not-zlib-data-xxxx'), 'FlateDecode'), inflate);
  assert.equal(junk.unverified, true);
  assert.equal(junk.forbidden, false);

  const plan = await C.plan([
    { name: '지급내역표.pdf', bytes: pdfWithStream(comp, 'FlateDecode') },
    { name: '신분증.jpg', bytes: JPG },
    { name: '재직증명서.jpg', bytes: JPG },
    { name: '통장사본.jpg', bytes: JPG }
  ], inflate);
  assert.equal(plan.ok, false);
  assert.equal(plan.slots[0].state, 'rejected');
  assert.equal(plan.slots[0].text, '');
});

test('같은 칸의 다른 파일과 칸 밖 파일은 붙이지 않는다', async () => {
  const plan = await C.plan([
    { name: '지급내역표.csv', text: '구분,금액\n주간,1000\n' },
    { name: '신분증_나.jpg', bytes: JPG },
    { name: '신분증_가.jpg', bytes: JPG },
    { name: '재직증명서.jpg', bytes: JPG },
    { name: '통장사본.jpg', bytes: JPG },
    { name: '메모.txt', text: '만든봇: 남김' }
  ], inflate);
  assert.equal(plan.ok, true);
  assert.equal(plan.slots.find((s) => s.id === 'idcard').file, '신분증_가.jpg');
  assert.match(plan.slots.find((s) => s.id === 'idcard').note, /신분증_나\.jpg/);
  assert.deepEqual(plan.extras, ['메모.txt']);
  assert.equal(JSON.stringify(plan).includes('만든봇'), false);
});

test('JPEG 주석의 봇 표기는 빼고, 합친 PDF에도 남지 않는다', async () => {
  const comment = Buffer.from('만든봇', 'utf8');
  const seg = Buffer.concat([
    Buffer.from([0xFF, 0xFE]),
    Buffer.from([(comment.length + 2) >> 8, (comment.length + 2) & 255]),
    comment
  ]);
  const dirty = Buffer.concat([JPG.subarray(0, 2), seg, JPG.subarray(2)]);
  assert.equal(C.bytesHaveForbidden(dirty), true);
  const clean = C.stripJpegMeta(dirty);
  assert.equal(C.bytesHaveForbidden(clean), false);
  assert.equal(clean[0], 0xFF);
  assert.equal(clean[1], 0xD8);

  const built = await C.assemble([
    { jpeg: dirty },
    { jpeg: clean },
    { jpeg: clean },
    { jpeg: clean }
  ], PDFDocument, inflate);
  assert.equal(built.ok, true);
  assert.equal(C.bytesHaveForbidden(built.bytes), false);
  assert.equal(Buffer.from(built.bytes).includes(Buffer.from('pdf-lib')), false);
  assert.equal(Buffer.from(built.bytes).includes(Buffer.from('만든봇')), false);
});

test('깨끗한 PDF 쪽은 A4 한 장에 맞추고, 도구 이름을 남기지 않는다', async () => {
  const src = await PDFDocument.create();
  const a = src.addPage([200, 200]);
  a.drawRectangle({ x: 10, y: 10, width: 20, height: 20 });
  const b = src.addPage([200, 400]);
  b.drawRectangle({ x: 10, y: 10, width: 20, height: 20 });
  const bytes = await src.save();
  const built = await C.assemble([{ pdf: bytes, fitOne: true, label: '신분증' }], PDFDocument, inflate);
  assert.equal(built.ok, true);
  assert.match(built.notes.join(' '), /첫 장만/);
  const out = await PDFDocument.load(built.bytes);
  assert.equal(out.getPageCount(), 1);
  const page = out.getPage(0);
  const box = page.getMediaBox();
  assert.ok(Math.abs(box.width - C.A4W) < 0.1);
  assert.ok(Math.abs(box.height - C.A4H) < 0.1);
  assert.equal(Buffer.from(built.bytes).includes(Buffer.from('pdf-lib')), false);
});
