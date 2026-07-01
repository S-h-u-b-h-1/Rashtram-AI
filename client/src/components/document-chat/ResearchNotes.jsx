"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

export function ResearchNotes({ notes, onAdd, onDelete }) {
  const [body, setBody] = useState("");
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
          className="min-h-16 flex-1 resize-none rounded-xl border border-[#8f1d2c]/10 bg-white p-3 text-xs outline-none"
        />
        <button
          type="button"
          disabled={!body.trim()}
          onClick={async () => {
            await onAdd(body);
            setBody("");
          }}
          aria-label="Add research note"
          className="grid h-10 w-10 place-items-center rounded-xl bg-[#8f1d2c] text-white disabled:opacity-35"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
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
              onClick={() => onDelete(note.id)}
              className="mt-2 inline-flex items-center gap-1 text-[9px] font-semibold text-[#914148]"
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
