"use client";

import { ExternalLink, FileText, RefreshCw } from "lucide-react";

export function DocumentPdfViewer({
  document,
  processing,
  processingError,
  onRetry,
}) {
  return (
    <section className="flex min-h-0 flex-col border-r border-[#8f1d2c]/8 bg-[#d8d1c7]">
      <div className="flex shrink-0 items-center justify-between border-b border-[#8f1d2c]/8 bg-[#f7f2eb] px-4 py-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#874047]">
            Original document
          </p>
          <p className="mt-0.5 text-[11px] text-[#777066]">
            Read alongside the evidence brief and research chat
          </p>
        </div>
        {document.pdfUrl && (
          <a
            href={document.pdfUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#8f1d2c]/10 bg-white px-2.5 py-2 text-[10px] font-semibold text-[#8f1d2c]"
          >
            Open PDF
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      <div className="relative min-h-0 flex-1 p-3">
        {document.pdfUrl ? (
          <iframe
            src={`${document.pdfUrl}#view=FitH&toolbar=1&navpanes=0`}
            title={`Official PDF: ${document.title}`}
            className="h-full min-h-[560px] w-full rounded-xl border-0 bg-white shadow-[0_12px_35px_rgba(26,30,28,0.12)]"
            loading="eager"
          />
        ) : (
          <div className="grid h-full min-h-[560px] place-items-center rounded-xl border border-dashed border-[#8f1d2c]/15 bg-[#f1ece3] p-8 text-center">
            <div>
              <FileText className="mx-auto h-8 w-8 text-[#9b9387]" />
              <p className="mt-4 text-sm font-semibold text-[#514d46]">
                Original PDF unavailable
              </p>
              <p className="mt-2 max-w-sm text-xs leading-5 text-[#81796e]">
                Verified metadata remains available. Grounded document chat
                begins when an official PDF is connected.
              </p>
            </div>
          </div>
        )}

        {(processing || processingError) && (
          <div className="absolute inset-x-6 bottom-6 rounded-2xl border border-[#8f1d2c]/10 bg-[#fffaf0]/95 p-4 shadow-lg backdrop-blur">
            {processing ? (
              <>
                <p className="text-xs font-semibold text-[#8f1d2c]">
                  Preparing AI Research Workspace
                </p>
                <p className="mt-1 text-[11px] leading-5 text-[#706a61]">
                  Detecting language, extracting text, and preparing grounded
                  passages. Scanned documents may take longer.
                </p>
              </>
            ) : (
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold text-[#914148]">
                    Processing failed
                  </p>
                  <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-[#706a61]">
                    {processingError}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onRetry}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#8f1d2c] px-3 py-2 text-[10px] font-semibold text-white"
                >
                  <RefreshCw className="h-3 w-3" />
                  Retry
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
