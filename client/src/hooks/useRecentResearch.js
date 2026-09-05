"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getRecentDocumentChats, getResearchHistory } from "@/lib/api";
import { resumeChatHref } from "@/lib/research-workspace.mjs";

export function useRecentResearch(limit = 6) {
  const { user } = useAuth();
  const owner = String(user?.id || user?._id || "");
  const [state, setState] = useState({ owner: "", items: [], loading: true, error: "" });
  useEffect(() => {
    let active = true;
    if (!owner) return undefined;
    Promise.allSettled([getRecentDocumentChats(30), getResearchHistory()]).then(([single, multi]) => {
      if (!active) return;
      const chats = [
        ...(single.status === "fulfilled" ? single.value.chats || [] : []),
        ...(multi.status === "fulfilled" ? multi.value.chats || [] : []),
      ].map((chat) => ({ ...chat, href: resumeChatHref(chat) })).filter((chat) => chat.href);
      const items = [...new Map(chats.map((chat) => [chat.href, chat])).values()]
        .sort((a, b) => (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0)).slice(0, limit);
      setState({ owner, items, loading: false, error: single.status === "rejected" || multi.status === "rejected" ? "Some recent research could not be loaded." : "" });
    });
    return () => { active = false; };
  }, [owner, limit]);
  return state.owner === owner ? state : { items: [], loading: true, error: "" };
}
