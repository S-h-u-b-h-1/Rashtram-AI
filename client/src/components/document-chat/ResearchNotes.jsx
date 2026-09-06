"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

export function ResearchNotes({ notes, onAdd, onDelete }) {
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  return (
    <section>
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#874047]">
        Pinned research notes
      </p>
      <div className="mt-3 flex gap-2">
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={2}
          placeholder="Add a private note…"
          aria-label="Add a private note"
          disabled={saving}
          className="min-h-16 min-w-0 flex-1 resize-none rounded-xl border border-[#8f1d2c]/10 bg-white p-3 text-xs outline-none"
        />
        <button
          type="button"
          disabled={!body.trim() || saving || !onAdd}
          onClick={async () => {
            if (saving) return;
            setSaving(true); setError("");
            try { await onAdd(body); setBody(""); }
            catch (failure) { setError(failure.message || "Could not save the note. Try again."); }
            finally { setSaving(false); }
          }}
          aria-label="Add research note"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#8f1d2c] text-white disabled:opacity-35"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      {saving && <p role="status" className="mt-2 text-xs text-[#706a61]">Saving note…</p>}
      {error && <p role="alert" className="mt-2 text-xs text-[#8f1d2c]">{error}</p>}
      <div className="mt-3 space-y-2">
        {notes.map((note) => (
          <article
            key={note.id}
            className="rounded-xl border border-[#8f1d2c]/8 bg-[#fffaf2] p-3"
          >
            <p className="whitespace-pre-wrap text-xs leading-5 text-[#514d46]">
              {note.body}
            </p>
            <p className="mt-2 text-[9px] text-[#8a8277]">
              Saved{" "}
              {new Date(note.updated_at || note.updatedAt || note.created_at)
                .toLocaleString("en-IN")}
            </p>
            <button
              type="button"
              disabled={saving || !onDelete}
              onClick={async () => {
                setSaving(true); setError("");
                try { await onDelete(note.id); }
                catch (failure) { setError(failure.message || "Could not remove the note. Try again."); }
                finally { setSaving(false); }
              }}
              className="mt-2 inline-flex min-h-11 items-center gap-1 text-xs font-semibold text-[#914148] disabled:opacity-40"
            >
              <Trash2 className="h-3 w-3" />
              Delete
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
