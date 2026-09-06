const { createPublicListingConnector, parseListing, dateFromText } = require('./publicListingConnector');
const { createSnapshot } = require('../core/sourceSnapshots');
const { publicationIdentity } = require('../core/publicationIdentity');

// Discovery candidates only: registration does not enable scheduled ingestion.
// Publisher URLs are kept separate from PDF URLs and readiness is never asserted here.
const definitions = [
  { name: 'research-nipfp', authority: 'National Institute of Public Finance and Policy', group: 'think-tank', url: 'https://www.nipfp.org.in/publication-index-page/working-paper-index-page/', collection: 'working-papers', documentType: 'report', allowedHosts: ['nipfp.org.in'] },
  { name: 'research-ceew', authority: 'Council on Energy, Environment and Water', group: 'think-tank', url: 'https://www.ceew.in/publications/page', collection: 'policy-research', documentType: 'report', allowedHosts: ['ceew.in'], detailPattern: /\/publications\/[^/?]+$/ },
  { name: 'research-university-iima', authority: 'Indian Institute of Management Ahmedabad', group: 'academic', url: 'https://iima.ac.in/faculty-research/research-publications/publication/search', collection: 'academic-research', documentType: 'report', allowedHosts: ['iima.ac.in'] },
  { name: 'research-university-apu', authority: 'Azim Premji University', group: 'academic', url: 'https://publications.azimpremjiuniversity.edu.in/cgi/latest', collection: 'academic-research', documentType: 'report', allowedHosts: ['azimpremjiuniversity.edu.in'], detailPattern: /\/\d+\/?$/ },
  { name: 'union-budget', authority: 'Ministry of Finance', group: 'government', url: 'https://www.indiabudget.gov.in/', collection: 'budget-documents', documentType: 'report', allowedHosts: ['indiabudget.gov.in'] },
  { name: 'cag-reports', authority: 'Comptroller and Auditor General of India', group: 'government', url: 'https://cag.gov.in/en/audit-report', collection: 'audit-reports', documentType: 'report', allowedHosts: ['cag.gov.in'], detailPattern: /\/audit-report\/details\// },
  { name: 'ministry-home-circulars', authority: 'Ministry of Home Affairs', group: 'ministry', url: 'https://www.mha.gov.in/en/notifications/circular?page=0', collection: 'circulars', documentType: 'circular', allowedHosts: ['mha.gov.in'] },
  { name: 'ministry-home-notifications', authority: 'Ministry of Home Affairs', group: 'ministry', url: 'https://www.mha.gov.in/en/notifications/notice', collection: 'notifications', documentType: 'notification', allowedHosts: ['mha.gov.in'] },
  { name: 'ministry-education-notices', authority: 'Ministry of Education', group: 'ministry', url: 'https://www.education.gov.in/circulars-orders-notification', collection: 'circulars-orders-notifications', allowedHosts: ['education.gov.in'] },
  { name: 'research-takshashila', authority: 'Takshashila Institution', group: 'think-tank', url: 'https://takshashila.org.in/pages/publications/', collection: 'policy-research', documentType: 'report', allowedHosts: ['takshashila.org.in'], detailPattern: /\/content\/publications\/[^/]+\.html/ },
];

const expansionConnectors = definitions.map((definition) => {
  if (definition.name === 'cag-reports') return require('./cagReportsConnector').cagReportsConnector;
  const config = {
    ...definition,
    ministry: definition.group === 'ministry' ? definition.authority : undefined,
    metadata: { publisherGroup: definition.group, onboardingStatus: 'pilot', textQuality: 'not_checked' },
    linkPattern: definition.detailPattern
      ? new RegExp(`\\.(?:pdf|csv|xlsx?)(?:$|[?#])|${definition.detailPattern.source}`, 'i')
      : /\.(?:pdf|csv|xlsx?)(?:$|[?#])/i,
  };
  if (definition.name === 'cag-reports') {
    config.linkSelector = 'a[href*="/audit-report/details/"]';
  }
  if (definition.name === 'research-nipfp' || definition.name === 'research-university-iima') {
    config.itemSelector = definition.name === 'research-nipfp' ? '.faculty' : '.rnp-journal-publications-box';
    config.title = ($, anchor, item) => item.find('h1,h2,h3,h4,h5').first().text().trim();
    config.extraFields = ($, anchor, item) => {
      const nipfp = definition.name === 'research-nipfp';
      const publisherId = nipfp ? item.text().match(/Working Paper No\.\s*(\d+)/i)?.[1]
        : anchor.attr('href')?.match(/WP-No-(\d{4}-\d{2}-\d{2})/i)?.[1];
      const landing = item.find(nipfp ? 'a[href*="working-paper-index-page/"]' : 'a[href*="/publication/"]').first().attr('href');
      const landingUrl = landing ? new URL(landing,definition.url).toString() : null;
      const authors = nipfp ? item.find('li').filter((_,li)=>$(li).find('span').first().text().trim()==='Authors').first().clone().children().remove().end().text().trim()
        : item.children('p').eq(1).text().trim();
      const dateText = nipfp ? item.find('.misc-details-job').clone().children().remove().end().text().trim() : item.children('p').first().text();
      const year = dateText.match(/\b(?:19|20)\d{2}\b/)?.[0];
      const month = require('../core/hindiPublicationMonth').hindiPublicationMonth(dateText);
      const publicationDateRaw = year ? (nipfp && month ? `${year}-${String(month).padStart(2,'0')}` : year) : null;
      return {sourceRecordId:publicationIdentity({publisher:definition.name,publisherId,landingUrl,resourceUrl:new URL(anchor.attr('href'),definition.url).toString()}),
        ...(landingUrl?{sourceUrl:landingUrl,detailUrl:landingUrl}:{}),publicationDate:null,publicationDateRaw,
        metadata:{...config.metadata,publisherId:publisherId||null,authors,publicationType:'working-paper',dateText,publisherPage:landingUrl}};
    };
  }
  config.recordFilter = (record) => !/^(download|view(?: file)?|pdf|full report)$/i.test(record.title.trim());
  if (['ministry-home-circulars', 'research-nipfp'].includes(definition.name)) {
    config.nextPageUrl = ($, pageUrl) => {
      const current = new URL(pageUrl);
      const page = Number(current.searchParams.get('page') || (definition.name === 'research-nipfp' ? 1 : 0));
      let next = null;
      $('a[href]').each((_, element) => {
        try {
          const candidate = new URL($(element).attr('href'), pageUrl);
          if (candidate.origin === current.origin && candidate.pathname === current.pathname &&
              Number(candidate.searchParams.get('page')) === page + 1 && candidate.searchParams.has('page')) next = candidate.href;
        } catch { /* Ignore malformed navigation. */ }
      });
      return next;
    };
  }
  if (definition.name === 'union-budget') {
    config.extraFields = ($, anchor) => {
      const edition = $('h1,h2').text().match(/Union Budget Documents\s+(\d{4}-\d{4})/i)?.[1];
      if (!edition) throw new Error('Budget edition is not explicitly identified by the publisher');
      const resourceUrl = new URL(anchor.attr('href'), definition.url).href;
      const title = anchor.attr('title') || anchor.text();
      const subtype = /speech/i.test(title) ? 'budget-speech' : /highlight/i.test(title) ? 'budget-highlights'
        : /finance bill/i.test(title) ? 'finance-bill' : /receipt/i.test(title) ? 'receipts'
          : /expenditure/i.test(title) ? 'expenditure' : 'budget-document';
      return {sourceRecordId:publicationIdentity({publisher:definition.name,resourceUrl,edition:JSON.stringify([edition,subtype])}),
        publicationDate:null,publicationDateRaw:null,
        metadata:{...config.metadata,edition,financialYear:edition,publicationType:subtype,
          publisherPage:definition.url,dateSemantics:'not_published_on_listing'}};
    };
  }
  if (definition.group === 'ministry') {
    config.title = ($, anchor, row) => row.find('td').eq(definition.name === 'ministry-home-notifications' ? 2 : 1).text().trim() || anchor.text();
  }
  if (definition.name === 'research-takshashila') {
    config.title = ($, anchor) => anchor.find('.listing-title').clone().children().remove().end().text().trim() || anchor.text();
    config.extraFields = ($, anchor) => ({ publicationDate: dateFromText(anchor.find('.listing-date').text().replace(/SEPT\b/gi, 'Sep')),
      metadata:{...config.metadata,authors:anchor.find('.listing-author').text().trim(),publicationType:'research-publication'} });
  }
  if (definition.name === 'ministry-home-circulars') {
    // This listing uses US-style dates, unlike many Indian publishers.
    config.publicationDate = (text) => {
      const match = text.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/);
      return match ? `${match[3]}-${match[1]}-${match[2]}` : null;
    };
  }
  const base = createPublicListingConnector(config);
  const collectListing = base.collect.bind(base);
  base.collect = async (options = {}, context) => {
    require('../../../document/sourceRights').assertCollectionRights(definition.name);
    const result = await collectListing({ ...options, maxPages: config.nextPageUrl ? Math.min(3, Math.max(1, Number(options.maxPages) || 2)) : 1 }, context);
    if (!definition.detailPattern) return result;
    const candidates = result.records;
    result.records = candidates.filter((record) => record.pdfUrl || record.mimeType !== 'text/html');
    const details = candidates.filter((record) => !record.pdfUrl && record.mimeType === 'text/html')
      .slice(0, Math.min(5, Math.max(1, Number(options.limit) || 3)));
    for (const parent of details) {
      try {
        const response = await context.fetcher.getText(parent.sourceUrl);
        const files = parseListing(response.body, response.url || parent.sourceUrl, {
          ...config, linkSelector: 'a[href]',
          extraFields: undefined,
          linkPattern: /\.(?:pdf|csv|xlsx?)(?:$|[?#])/i,
          recordFilter: definition.name === 'cag-reports' ? (record) => /\/download_audit_report\//.test(record.sourceUrl) : undefined,
          title: () => parent.title,
        });
        // Full-report links win over chapters. For unverified publishers attach
        // only the selected file: sharing a page is not proof of association.
        const full = files.find((file) => /(?:full[_ -]?report|SFAR-State-Finance)/i.test(file.pdfUrl || ''));
        const selectedFiles = (full ? [full] : files).slice(0, 1);
        result.records.push(...selectedFiles.map((record) => ({ ...record,
          sourceRecordId: publicationIdentity({publisher:definition.name, landingUrl:parent.sourceUrl}),
          sourceUrl: parent.sourceUrl,
          detailUrl: parent.sourceUrl,
          resources: (definition.name === 'cag-reports' ? files : [record]).flatMap((file) => file.resources),
          publicationDate: parent.publicationDate || record.publicationDate,
          publicationDateRaw: parent.publicationDateRaw || record.publicationDateRaw || parent.publicationDate,
          metadata: { ...record.metadata, ...parent.metadata, publisherPage: parent.sourceUrl },
        })));
        result.snapshots.push(createSnapshot({ sourceName: definition.name, sourceUrl: parent.sourceUrl,
          body: response.body, responseStatus: response.status, recordCount: files.length }));
        if (!files.length) result.diagnostics.push({ type: 'empty-source', message: `No downloadable document found on ${parent.sourceUrl}` });
      } catch (error) {
        result.errors.push({ stage: 'detail', url: parent.sourceUrl, message: error.message });
      }
    }
    result.records = result.records.filter((record, index, all) => all.findIndex((other) => other.sourceRecordId === record.sourceRecordId) === index)
      .slice(0, Math.max(1, Number(options.limit) || 10));
    return result;
  };
  return base;
});

module.exports = { definitions, expansionConnectors };
