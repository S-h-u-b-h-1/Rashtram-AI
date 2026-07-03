const DocumentRepository = require("../document/DocumentRepository");
const { normalizeDocumentType } = require("../document/documentTypes");

const mapDocument = (value) => {
  const document = value?.documentType
    ? value
    : DocumentRepository.mapDocument(value);
  if (!document) return null;
  return {
    id: document.id,
    title: document.title,
    link: document.sourceUrl,
    status: document.status,
    year: document.year,
    pdf: document.pdfUrl,
    ministry: document.ministry,
    category: document.category,
    jurisdiction: document.jurisdiction,
    jurisdictionLevel: document.jurisdictionLevel,
    source: document.source,
  };
};

const listDocuments = async (options) => {
  const result = await DocumentRepository.find({
    type: options.documentType,
    jurisdictionLevel: options.jurisdictionLevel,
    jurisdiction: options.jurisdiction,
    search: options.search,
    status: options.status,
    year: options.year,
    page: options.page,
    limit: options.limit,
    sortBy: "year",
  });
  return {
    documents: result.documents.map(mapDocument),
    pagination: result.pagination,
  };
};

const getStatuses = async (documentType = "bill") => {
  const filters = await DocumentRepository.getFilterOptions({
    type: normalizeDocumentType(documentType),
    jurisdictionLevel: "parliament",
  });
  return filters.statuses || [];
};

const getYears = async (documentType = "act") => {
  const filters = await DocumentRepository.getFilterOptions({
    type: normalizeDocumentType(documentType),
    jurisdictionLevel: "parliament",
  });
  return filters.years || [];
};

const getDocumentById = async (id, documentType) => {
  const document = await DocumentRepository.getById(id);
  if (
    !document ||
    document.type !== normalizeDocumentType(documentType)
  ) {
    return null;
  }
  return mapDocument(document);
};

const findDocumentBySourceUrl = async (sourceUrl, documentType) =>
  mapDocument(
    await DocumentRepository.findBySourceUrl(sourceUrl, documentType),
  );

const updateDocumentPdf = (id, pdfUrl) =>
  DocumentRepository.updatePDF(id, pdfUrl);

module.exports = {
  findDocumentBySourceUrl,
  getDocumentById,
  getStatuses,
  getYears,
  listDocuments,
  mapDocument,
  updateDocumentPdf,
};
