"use client";

import { useRef, useState } from "react";
import {
  Check,
  FileText,
  Link2,
  Loader2,
  PanelLeftClose,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  normalizeResearchUploadError,
  researchUploadFailureStage,
  validateResearchPdfCandidate,
} from "@/lib/research-upload.mjs";

const sourceLabel = (source) =>
  source.sourceLabel ||
  (source.sourceType === "pdf_upload" ? "PDF upload" : "External web source");

export function StudySourcesPanel({
  sources,
  selectedIds,
  onToggle,
  onAddUrl,
  onAddPdf,
  onDelete,
  onRetry,
  onCollapse,
}) {
  const [url, setUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [uploadName, setUploadName] = useState("");
  const [uploadSize, setUploadSize] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState("");
  const [retryingId, setRetryingId] = useState(null);
  const fileInputRef = useRef(null);

  const submitUrl = async (event) => {
    event.preventDefault();
    if (!url.trim() || adding) return;
    setAdding(true);
    setError("");
    try {
      await onAddUrl(url.trim());
      setUrl("");
    } catch (requestError) {
      setError(requestError.message || "The link could not be added.");
    } finally {
      setAdding(false);
    }
  };

  const chooseFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      validateResearchPdfCandidate(file);
    } catch (validationError) {
      const uploadError = normalizeResearchUploadError(validationError);
      setError(uploadError.message);
      setUploadStage(researchUploadFailureStage(uploadError));
      return;
    }
    setAdding(true);
    setError("");
    setUploadName(file.name);
    setUploadSize(file.size);
    setUploadProgress(0);
    setUploadStage("Checking PDF…");
    try {
      await onAddPdf(file, {
        onProgress: setUploadProgress,
        onStatus: setUploadStage,
      });
      setUploadStage("Ready to use");
    } catch (requestError) {
      const uploadError = normalizeResearchUploadError(requestError);
      setError(uploadError.message);
      setUploadStage(researchUploadFailureStage(uploadError));
    } finally {
      setAdding(false);
    }
  };

  const retrySource = async (sourceId) => {
    if (!onRetry || retryingId) return;
    setRetryingId(String(sourceId));
    setError("");
    try {
      await onRetry(sourceId);
    } catch (requestError) {
      const uploadError = normalizeResearchUploadError(requestError);
      setError(uploadError.message);
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <section className="flex h-full min-h-0 flex-col bg-[#f8f6f1]">
      <div className="border-b border-[#8f1d2c]/10 px-4 py-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#874047]">
            Sources
          </p>
          {onCollapse && (
            <button
              type="button"
              onClick={onCollapse}
              className="hidden h-8 w-8 place-items-center rounded-lg border border-[#8f1d2c]/12 bg-white text-[#874047] transition hover:bg-[#eee0dc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8f1d2c]/30 lg:grid"
              aria-label="Collapse sources"
              title="Collapse sources"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="mt-1 flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-[#29312d]">
            Your study shelf
          </h2>
          <span className="rounded-full bg-[#eee0dc] px-2 py-1 text-[10px] font-bold text-[#8f1d2c]">
            {selectedIds.length} selected
          </span>
        </div>
        <p className="mt-2 text-[11px] leading-5 text-[#706a61]">
          Select the records you want Rashtram AI to use for this conversation.
        </p>
        <form onSubmit={submitUrl} className="mt-4 space-y-2">
          <label className="sr-only" htmlFor="research-source-url">
            Add a website link
          </label>
          <div className="flex items-center gap-2 rounded-xl border border-[#8f1d2c]/12 bg-white px-3 py-2">
            <Link2 className="h-4 w-4 shrink-0 text-[#8f1d2c]" />
            <input
              id="research-source-url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="Paste a website or PDF link"
              className="min-w-0 flex-1 bg-transparent text-xs text-[#29312d] outline-none placeholder:text-[#a79e91]"
              type="url"
            />
            <button
              type="submit"
              disabled={!url.trim() || adding}
              className="grid h-7 w-7 place-items-center rounded-lg bg-[#8f1d2c] text-white disabled:opacity-35"
              aria-label="Add website source"
            >
              {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            </button>
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={adding}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#8f1d2c]/20 bg-white px-3 py-2.5 text-xs font-semibold text-[#874047] transition hover:border-[#8f1d2c]/40 disabled:opacity-45"
          >
            <Upload className="h-3.5 w-3.5" />
            Add a PDF to study
          </button>
          <p className="text-[10px] text-[#8a8277]">Maximum PDF size: 50 MB</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            onChange={chooseFile}
            className="hidden"
          />
        </form>
        {uploadName && (
          <div className="mt-3 rounded-xl border border-[#8f1d2c]/10 bg-white p-3" aria-live="polite">
            <div className="flex items-center justify-between gap-2 text-[10px]">
              <span className="min-w-0 truncate font-semibold text-[#514d46]">{uploadName}</span>
              <span className="shrink-0 text-[#8a8277]">{(uploadSize / 1024 / 1024).toFixed(1)} MB</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#eee0dc]">
              <div className="h-full rounded-full bg-[#8f1d2c] transition-[width] duration-200" style={{ width: `${uploadProgress}%` }} />
            </div>
            <p className="mt-2 text-[10px] text-[#874047]">{uploadStage}{uploadProgress > 0 && uploadProgress < 100 ? ` · ${uploadProgress}%` : ""}</p>
          </div>
        )}
        {error && <p className="mt-2 text-[11px] leading-4 text-[#a33d42]" role="alert">{error}</p>}
      </div>

      <div className="app-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {!sources.length ? (
          <div className="rounded-2xl border border-dashed border-[#8f1d2c]/15 bg-white px-4 py-8 text-center">
            <FileText className="mx-auto h-6 w-6 text-[#b2837d]" />
            <p className="mt-3 text-xs font-semibold text-[#514d46]">No study sources yet</p>
            <p className="mt-1 text-[11px] leading-5 text-[#8a8277]">Add a policy page, official PDF, or research paper.</p>
          </div>
        ) : sources.map((source) => {
          const selected = selectedIds.includes(String(source.id));
          return (
            <article
              key={source.id}
              className={`group rounded-2xl border p-3 transition ${selected ? "border-[#8f1d2c]/35 bg-[#fffaf0] shadow-sm" : "border-[#8f1d2c]/8 bg-white hover:border-[#8f1d2c]/20"}`}
            >
              <div className="flex items-start gap-2">
                <button
                  type="button"
                  onClick={() => source.status === "ready" && onToggle(String(source.id))}
                  disabled={source.status !== "ready"}
                  className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border disabled:cursor-not-allowed disabled:opacity-35 ${selected ? "border-[#8f1d2c] bg-[#8f1d2c] text-white" : "border-[#b8afa2] bg-white text-transparent"}`}
                  aria-label={selected ? `Remove ${source.title} from context` : `Use ${source.title} in context`}
                >
                  <Check className="h-3 w-3" />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-xs font-semibold leading-5 text-[#29312d]">{source.title}</p>
                  <p className="mt-1 truncate text-[10px] uppercase tracking-[0.1em] text-[#8a8277]">{sourceLabel(source)}{source.languageCode ? ` · ${source.languageCode}` : ""}</p>
                  <p className={`mt-1 text-[10px] font-semibold ${source.status === "ready" ? "text-[#34725b]" : source.status === "failed" ? "text-[#a33d42]" : "text-[#a06b42]"}`}>
                    {source.status === "ready"
                      ? `${source.metadata?.partialValid ? "Partially ready" : "Ready to use"}${source.metadata?.pageCount ? ` · ${source.metadata.pageCount} pages` : ""}`
                      : source.status === "failed" ? "Preparation failed" : "Preparing evidence"}
                  </p>
                  {source.status === "failed" &&
                    source.metadata?.durableOriginal === true &&
                    source.metadata?.uploadStage === "failed_retryable" && (
                      <button
                        type="button"
                        onClick={() => retrySource(source.id)}
                        disabled={Boolean(retryingId)}
                        className="mt-2 inline-flex items-center gap-1 rounded-lg border border-[#8f1d2c]/15 px-2 py-1 text-[10px] font-semibold text-[#874047] disabled:opacity-45"
                      >
                        {retryingId === String(source.id) && (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        )}
                        Retry preparation
                      </button>
                    )}
                </div>
                <button
                  type="button"
                  onClick={() => onDelete(source.id)}
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-lg text-[#a79e91] opacity-0 transition hover:bg-[#f4dfdc] hover:text-[#8f1d2c] group-hover:opacity-100 focus:opacity-100"
                  aria-label={`Remove ${source.title}`}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
              {source.sourceUrl && (
                <a href={source.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 block truncate pl-7 text-[10px] text-[#874047] hover:underline">
                  {source.sourceUrl}
                </a>
              )}
              {source.metadata?.storageWarning && (
                <p className="mt-2 pl-7 text-[10px] leading-4 text-[#a06b42]">{source.metadata.storageWarning}</p>
              )}
              {source.errorMessage && <p className="mt-2 pl-7 text-[10px] leading-4 text-[#a33d42]">{source.errorMessage}</p>}
            </article>
          );
        })}
      </div>
      {selectedIds.length > 0 && (
        <div className="border-t border-[#8f1d2c]/10 px-4 py-3">
          <button type="button" onClick={() => selectedIds.forEach((id) => onToggle(id))} className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#874047]">
            <X className="h-3 w-3" /> Clear source context
          </button>
        </div>
      )}
    </section>
  );
}
