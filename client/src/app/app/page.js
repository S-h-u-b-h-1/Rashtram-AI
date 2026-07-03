"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import ActsUI from "@/components/Acts";
import BillsListUI from "@/components/Bills";
import { IntelligenceDashboard } from "@/components/intelligence/IntelligenceDashboard";
import ProtectedRoute from "@/components/ProtectedRoute";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { DocumentExplorer } from "@/components/documents/DocumentExplorer";
import Policies from "@/components/Policies";

function AllDocuments({ initialQuery = "" }) {
  return (
    <DocumentExplorer
      title="All legislative documents"
      description="Search every supported central and state document type through one repository, filter engine, semantic index, and research workspace."
      initialQuery={initialQuery}
    />
  );
}

const VIEWS = {
  documents: {
    activeKey: "documents",
    title: "Universal Document Catalogue",
    content: AllDocuments,
  },
  bills: {
    activeKey: "bills",
    title: "Parliament Bills",
    content: BillsListUI,
  },
  acts: {
    activeKey: "acts",
    title: "Parliament Acts",
    content: ActsUI,
  },
  policies: {
    activeKey: "policies",
    title: "Policies & Strategy",
    content: Policies,
  },
};

function WorkspacePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const viewKey = searchParams.get("view");
  const selectedView = VIEWS[viewKey];
  const ActiveContent = selectedView?.content || IntelligenceDashboard;
  const activeKey = selectedView?.activeKey || "dashboard";
  const title = selectedView?.title || "Parliament Intelligence Brief";
  const initialQuery = searchParams.get("q") || "";
  const demoMode = searchParams.get("demo") === "1";

  const navigateToView = (view) => {
    if (view === "bills") router.push("/app?view=bills");
    else if (view === "acts") router.push("/app?view=acts");
    else if (view === "documents") router.push("/app?view=documents");
    else if (view === "policies") router.push("/app?view=policies");
    else if (view === "state-bills") router.push("/app/state-bills");
    else if (view === "egazette") router.push("/app/egazette");
    else router.push("/app");
  };

  return (
    <WorkspaceShell activeKey={activeKey} title={title}>
      <AnimatePresence mode="wait">
        <motion.div
          key={activeKey}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2 }}
        >
          {activeKey === "dashboard" ? (
            <ActiveContent onNavigate={navigateToView} demoMode={demoMode} />
          ) : (
            <ActiveContent initialQuery={initialQuery} />
          )}
        </motion.div>
      </AnimatePresence>
    </WorkspaceShell>
  );
}

export default function App() {
  return (
    <ProtectedRoute>
      <Suspense fallback={null}>
        <WorkspacePage />
      </Suspense>
    </ProtectedRoute>
  );
}
