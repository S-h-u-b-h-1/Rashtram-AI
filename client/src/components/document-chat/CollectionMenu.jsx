"use client";

import Link from "next/link";
import { FolderPlus, Loader2 } from "lucide-react";
import { useState } from "react";
import {
  addResearchCollectionItem,
  getProfile,
} from "@/lib/api";

export function CollectionMenu({ document }) {
  const [open, setOpen] = useState(false);
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (!next || collections.length) return;
    try {
      setLoading(true);
      const response = await getProfile();
      setCollections(response.account?.collections || []);
    } catch (error) {
      setNotice(error.message);
    } finally {
      setLoading(false);
    }
  };

  const add = async (collectionId) => {
    try {
      setLoading(true);
      await addResearchCollectionItem(collectionId, {
        documentType: document.type || document.documentType,
        documentId: document.id || document.documentId,
        title: document.title,
        metadata: {
          sourceUrl: document.sourceUrl,
          pdfUrl: document.pdfUrl,
        },
      });
      setNotice("Added to collection.");
    } catch (error) {
      setNotice(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        className="grid h-9 w-9 place-items-center rounded-xl bg-white/8 text-white/70 hover:text-white"
        aria-label="Add document to a research collection"
        aria-expanded={open}
      >
        <FolderPlus className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-30 w-64 rounded-2xl border border-[#8f1d2c]/10 bg-[#f7f2eb] p-3 text-[#29312d] shadow-2xl">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#874047]">
            Research collections
          </p>
          {loading && (
            <Loader2 className="mx-auto my-4 h-4 w-4 animate-spin text-[#8f1d2c]" />
          )}
          {!loading &&
            collections.map((collection) => (
              <button
                key={collection.id}
                type="button"
                onClick={() => add(collection.id)}
                className="mt-2 block w-full rounded-xl bg-white px-3 py-2 text-left text-xs font-semibold hover:bg-[#eee0dc]"
              >
                {collection.name}
              </button>
            ))}
          {!loading && !collections.length && (
            <Link
              href="/app/profile"
              className="mt-3 block rounded-xl bg-white px-3 py-3 text-xs text-[#514d46]"
            >
              Create a collection in your profile.
            </Link>
          )}
          {notice && (
            <p className="mt-3 text-[10px] text-[#874047]">{notice}</p>
          )}
        </div>
      )}
    </div>
  );
}
