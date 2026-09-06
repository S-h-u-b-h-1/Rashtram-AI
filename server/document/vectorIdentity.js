const crypto = require("node:crypto");

const sha256 = (value) => crypto.createHash("sha256")
  .update(String(value || ""))
  .digest("hex");

const normalizeFamily = (value) => {
  const family = String(value || "document").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return family || "document";
};

const embeddingContractHash = ({
  embeddingProvider,
  embeddingModel,
  embeddingDimension,
  vectorNamespace,
  embeddingInputHash,
}) => sha256([
  embeddingProvider,
  embeddingModel,
  String(embeddingDimension || ""),
  vectorNamespace,
  embeddingInputHash,
].map((value) => String(value || "").trim()).join("\0"));

const canonicalVectorId = ({
  family,
  documentId,
  chunkIndex,
  embeddingText,
  embeddingInputHash = sha256(embeddingText),
  config,
}) => {
  const contractHash = embeddingContractHash({
    ...config,
    embeddingInputHash,
  });
  return `${normalizeFamily(family)}-${documentId}-chunk-${Number(chunkIndex)}-${contractHash.slice(0, 24)}`;
};

const canonicalRoutingVectorId = ({
  family,
  documentId,
  groupIndex,
  representationText,
  representationHash = sha256(representationText),
  config,
}) => {
  const contractHash = embeddingContractHash({
    ...config,
    embeddingInputHash: representationHash,
  });
  return `large-${normalizeFamily(family)}-${documentId}-group-${Number(groupIndex)}-${contractHash.slice(0, 24)}`;
};

const parseVectorIdentity = (value) => {
  const id = String(value || "");
  const chunk = id.match(/^(bill|act|gazette|policy)-(\d+)-chunk-(\d+)(?:-([a-f0-9]{24}))?$/);
  if (chunk) {
    return {
      kind: "chunk",
      family: chunk[1],
      documentId: chunk[2],
      position: Number(chunk[3]),
      contractHash: chunk[4] || null,
      canonical: Boolean(chunk[4]),
    };
  }
  const routing = id.match(/^large-(bill|act|gazette|policy)-(\d+)-group-(\d+)(?:-([a-f0-9]{24}))?$/);
  if (routing) {
    return {
      kind: "routing",
      family: routing[1],
      documentId: routing[2],
      position: Number(routing[3]),
      contractHash: routing[4] || null,
      canonical: Boolean(routing[4]),
    };
  }
  return null;
};

module.exports = {
  canonicalRoutingVectorId,
  canonicalVectorId,
  embeddingContractHash,
  parseVectorIdentity,
  sha256,
};
