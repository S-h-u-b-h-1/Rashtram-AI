export const MAX_RESEARCH_PDF_BYTES = 50 * 1024 * 1024;
export const MAX_COMPATIBILITY_PDF_BYTES = 3 * 1024 * 1024;

const safeUploadError = (message, { code, status } = {}) => {
  const error = new Error(message);
  if (code) error.code = code;
  if (status) error.status = status;
  return error;
};

export const validateResearchPdfCandidate = (file) => {
  if (!file || !Number.isFinite(Number(file.size))) {
    throw safeUploadError("Choose a PDF file to upload.", {
      code: "INVALID_DOCUMENT",
      status: 422,
    });
  }
  if (Number(file.size) > MAX_RESEARCH_PDF_BYTES) {
    throw safeUploadError("This file exceeds the 50 MB upload limit.", {
      code: "FILE_TOO_LARGE",
      status: 413,
    });
  }
  if (Number(file.size) < 1) {
    throw safeUploadError("The selected PDF is empty or has an invalid size.", {
      code: "INVALID_DOCUMENT",
      status: 422,
    });
  }
  const mimeType = String(file.type || "application/pdf").toLowerCase();
  if (mimeType !== "application/pdf") {
    throw safeUploadError("The uploaded file is not a valid PDF.", {
      code: "INVALID_DOCUMENT",
      status: 422,
    });
  }
  return file;
};

export const normalizeResearchUploadError = (error) => {
  const code = String(error?.code || "").toUpperCase();
  const status = Number(error?.status || 0);
  const originalMessage = String(error?.message || "").trim();

  if (code === "FILE_TOO_LARGE" || status === 413) {
    return safeUploadError("This file exceeds the 50 MB upload limit.", {
      code: "FILE_TOO_LARGE",
      status: 413,
    });
  }
  if (code === "STORAGE_UNAVAILABLE" || status === 503) {
    return safeUploadError(
      "Private document storage is temporarily unavailable. Please retry later.",
      { code: "STORAGE_UNAVAILABLE", status: 503 },
    );
  }
  if (code === "INVALID_DOCUMENT") {
    return safeUploadError(
      originalMessage || "The uploaded file is not a valid PDF.",
      { code: "INVALID_DOCUMENT", status: status || 422 },
    );
  }
  if (
    error instanceof TypeError ||
    /failed to fetch|networkerror|network request failed/i.test(originalMessage)
  ) {
    return safeUploadError(
      "The upload service could not be reached. Check your connection and try again.",
      { code: "UPLOAD_NETWORK_ERROR" },
    );
  }
  return safeUploadError(
    originalMessage || "The PDF could not be uploaded. Please try again.",
    { code: code || "UPLOAD_FAILED", status: status || undefined },
  );
};

export const researchUploadFailureStage = (error) => {
  const code = String(error?.code || "").toUpperCase();
  if (code === "FILE_TOO_LARGE") return "File too large";
  if (code === "STORAGE_UNAVAILABLE") return "Storage unavailable";
  if (code === "INVALID_DOCUMENT") return "Invalid PDF";
  if (code === "UPLOAD_NETWORK_ERROR") return "Upload service unreachable";
  return "PDF not uploaded";
};
