"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";

export function MobileWorkspaceSheet({ open, title, onClose, children }) {
  const closeButtonRef = useRef(null);
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    if (!open) return undefined;
    const previouslyFocused = document.activeElement;
    closeButtonRef.current?.focus();
    const closeOnEscape = (event) => {
      if (event.key === "Escape") onCloseRef.current();
      if (event.key === "Tab") {
        const nodes = [...dialogRef.current.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), summary, [tabindex="0"]')].filter((node) => node.getClientRects().length);
        const first = nodes[0], last = nodes.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[70] flex items-end bg-[#101814]/45 backdrop-blur-sm lg:hidden"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[82dvh] w-full overflow-hidden rounded-t-[1.5rem] border border-[#8f1d2c]/10 bg-[#f7f2eb] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[#8f1d2c]/10 px-4 py-3">
          <h2 className="text-sm font-semibold text-[#29312d]">{title}</h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="grid h-11 w-11 place-items-center rounded-xl border border-[#8f1d2c]/10 bg-white text-[#874047]"
            aria-label={`Close ${title.toLowerCase()}`}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="app-scrollbar max-h-[calc(82dvh-68px)] overflow-y-auto overscroll-contain pb-[max(1rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </section>
    </div>
  );
}
