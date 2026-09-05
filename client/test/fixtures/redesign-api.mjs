// Local visual/interaction fixture only; never imported by the application.
// Does not contact a database, model, object store, or production API.
import http from 'node:http';
const date = '2026-09-05T10:00:00.000Z';
const documents = [
  { id: '101', title: 'Digital Personal Data Protection Act, 2023', type: 'act', authority: 'Ministry of Electronics and Information Technology', jurisdiction: 'India', year: 2023 },
  { id: '102', title: 'Digital Personal Data Protection Bill, 2022', type: 'bill', authority: 'Ministry of Electronics and Information Technology', jurisdiction: 'India', year: 2022 },
  { id: '103', title: 'Digital lending — research fixture', type: 'circular', authority: 'Reserve Bank of India', jurisdiction: 'India', year: 2025 },
].map((item) => ({ ...item, documentType: item.type, publicationDate: `${item.year}-08-11`, researchReady: true, comparisonReady: true, draftUsable: true, capabilities: { chatReady: true, comparisonReady: true }, sourceUrl: 'https://www.meity.gov.in/', pdfUrl: null, summary: 'Illustrative QA overview. This is fixture content, not legal analysis.', status: item.type === 'bill' ? 'Bill' : 'Published', timeline: [], graph: {}, recommendations: [] }));
const user = { id: 'visual-qa', name: 'Research Preview', email: 'visual-qa@example.invalid' };
const messages = new Map(), sources = [], drafts = [], reports = [], comparisons = [];
const fixtureCitation = { id: 'D101-P1', passage: 1, documentId: '101', documentTitle: documents[0].title, authority: documents[0].authority, content: 'Illustrative passage for testing source inspection. This is not legal evidence.', snippet: 'Illustrative QA passage.', sourceUrl: documents[0].sourceUrl, pageStart: 1 };
drafts.push({ id: '1', title: 'University AI usage policy — QA fixture', brief: { objective: 'Create a university AI usage policy for research and teaching.', audience: 'Students and researchers', geography: 'India' }, documentIds: ['101', '102'], sourceIds: [], createdAt: date, draftText: '# University AI usage policy\n\nIllustrative QA draft, not legal guidance.\n\n## Purpose\nUse AI responsibly in research and teaching.\n\n## Source transparency\nResearchers should document the sources used and check citations. [D101-P1]\n\n## Review\nA human reviewer must approve the policy before adoption.', citations: [fixtureCitation] });
comparisons.push({ id: '1', title: 'DPDP source comparison — QA fixture', documentIds: ['101', '102'], version: 1, createdAt: date, result: { documents: documents.slice(0, 2), executiveSummary: 'Illustrative comparison output for interface testing only.', similarities: [{ point: 'Both sources concern personal data.', citations: ['D101-P1'] }], differences: [{ topic: 'Instrument type', analysis: 'An Act and a Bill must remain clearly distinguished.', citations: ['D101-P1'] }], citations: [fixtureCitation] }, recommendedDocuments: [] });
reports.push({ id: '1', title: 'Selected-source research report — QA fixture', researchQuestion: 'What do these selected sources cover?', documentIds: ['101', '102'], selectedDocumentIds: ['101', '102'], createdAt: date, sections: { executiveSummary: 'Illustrative QA report. Not legal guidance.', keyFindings: ['A research report retains its selected source scope.'], limitations: ['Sample content only; no legal conclusions have been verified.'] }, evidence: [fixtureCitation] });
const headers = { 'Access-Control-Allow-Origin': 'http://localhost:5050', 'Access-Control-Allow-Headers': 'Content-Type,auth-token,x-research-session', 'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS' };
const json = (res, value, code = 200) => { res.writeHead(code, { ...headers, 'Content-Type': 'application/json' }); res.end(JSON.stringify(value)); };
const source = (body) => ({ id: String(sources.length + 1), title: body.fileName || 'External government source — QA fixture', sourceType: body.fileName ? 'pdf_upload' : 'url', sourceUrl: body.url || '', status: 'ready', createdAt: date, metadata: { pageCount: 2 } });
http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, headers); res.end(); return; }
  const url = new URL(req.url, 'http://localhost:5081'), path = url.pathname.replace(/^\/api/, '');
  let raw = ''; for await (const chunk of req) raw += chunk;
  const body = raw ? JSON.parse(raw) : {};
  const doc = documents.find((item) => item.id === path.split('/').at(-1)) || documents[0];
  if (path === '/auth/me') return json(res, { user, profile: {}, preferences: {}, onboarding: { required: false } });
  if (path === '/auth/capabilities') return json(res, { google: { enabled: false } });
  if (path === '/documents' || path === '/documents/search') return json(res, { documents, pagination: { total: 3, page: 1, totalPages: 1 }, filters: { types: ['act', 'bill', 'circular', 'rule', 'regulation', 'policy', 'report', 'gazette'], jurisdictions: ['India'], years: [2023, 2025] } });
  if (/^\/documents\/\d+\/readiness$/.test(path)) return json(res, { researchReady: true, comparisonReady: true });
  if (/^\/documents\/\d+$/.test(path)) return json(res, { document: doc });
  if (path.startsWith('/document-chat/document/')) return json(res, { document: doc });
  if (path === '/research-sources/capabilities') return json(res, { directUpload: false, compatibilityUpload: true, storageStatus: 'available', maxCompatibilityPdfBytes: 3145728, maxPdfBytes: 52428800 });
  if (path === '/research-sources') return json(res, { sources });
  if (['/research-sources/url', '/research-sources/upload'].includes(path)) { const item = source(body); sources.push(item); return json(res, { source: item }, 201); }
  if (path === '/document-chat/session') return json(res, { chat: { messages: [], conversationEpoch: 0 } });
  if (path === '/document-chat/message') { const list = messages.get(String(body.documentId)) || []; list.push({ ...body, _id: `message-${list.length}` }); messages.set(String(body.documentId), list); return json(res, { chat: { messages: list } }); }
  if (path === '/document-chat/history') {
    if (url.searchParams.has('documentId')) return json(res, { chat: { messages: messages.get(url.searchParams.get('documentId')) || [], conversationEpoch: 0 }, notes: [] });
    return json(res, { chats: [...messages.entries()].map(([documentId, items]) => ({ id: documentId, documentId, title: documents.find((item) => item.id === documentId)?.title, messages: items, updatedAt: date })) });
  }
  if (path === '/documents/chat/history') return json(res, { messages: messages.get('multi') || [] });
  if (path === '/document-chat' || path === '/documents/chat') {
    const key = path === '/document-chat' ? String(body.documentId) : 'multi';
    const list = messages.get(key) || [];
    const evidence = [{ passage: 1, documentTitle: 'Illustrative QA source', authority: 'QA fixture', publicationDate: date, pageStart: 1, sourceUrl: 'https://www.meity.gov.in/', content: 'This passage is provided only to test the citation interaction.' }];
    const answer = 'This is a **visual QA answer**, not legal guidance. It demonstrates a readable response with a source reference [1].';
    const metadata = { persistence: { saved: true, conversationEpoch: 0 }, sourceIds: body.sourceIds || [], workflowTitle: body.workflow?.title };
    list.push({ _id: `user-${list.length}`, sender: 'user', text: body.message, timestamp: date, metadata }, { _id: `answer-${list.length}`, sender: 'assistant', text: answer, sources: evidence, timestamp: date, metadata }); messages.set(key, list);
    res.writeHead(200, { ...headers, 'Content-Type': 'text/event-stream' });
    for (const event of [{ type: 'meta', sources: evidence, metadata }, { type: 'content', content: answer }, { type: 'done', persisted: true }]) res.write(`data: ${JSON.stringify(event)}\n\n`);
    res.end(); return;
  }
  if (path === '/profile/research-history') return json(res, { chats: [], reports });
  if (path === '/profile/comparisons') return json(res, { comparisons });
  if (/^\/documents\/compare(?:\/\d+(?:\/regenerate)?)?$/.test(path)) return json(res, { comparison: comparisons[0], comparisonId: '1', ...comparisons[0].result });
  if (path === '/documents/recommend-for-comparison') return json(res, { recommendations: [] });
  if (path === '/policy-drafts') return json(res, { drafts });
  if (/^\/policy-drafts\/\d+$/.test(path)) return json(res, { draft: drafts[0] });
  if (path === '/policy-drafts/generate') { res.writeHead(200, { ...headers, 'Content-Type': 'text/event-stream' }); for (const event of [{ type: 'meta', citations: drafts[0].citations }, { type: 'content', content: drafts[0].draftText }, { type: 'done', draftId: '1', draftText: drafts[0].draftText }]) res.write(`data: ${JSON.stringify(event)}\n\n`); res.end(); return; }
  if (/^\/product-intelligence\/reports(?:\/\d+)?$/.test(path)) return json(res, { report: reports[0] });
  if (path === '/profile') return json(res, { user, recentChats: [], account: { profile: { name: user.name, email: user.email, preferences: {} }, savedContent: [], savedSearches: [], collections: [], sessions: [], notes: [], analytics: {} }, activityInsights: {}, graphInsights: [], userActivityStats: {} });
  if (path === '/product-intelligence/watchlists') return json(res, { watchlists: [] });
  if (path === '/product-intelligence/alerts') return json(res, { alerts: [] });
  if (path === '/recommendations/problem') return json(res, { recommendations: documents });
  if (path === '/dashboard/intelligence') return json(res, { sourceHealth: [], platformCoverage: {} });
  return json(res, { success: true });
}).listen(5081, '127.0.0.1', () => console.log('Local-only redesign fixture API: http://localhost:5081/api'));
