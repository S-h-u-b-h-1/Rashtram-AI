"use client";

import { useEffect, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionTemplate,
  useMotionValue,
  useSpring,
} from "framer-motion";
import {
  ArrowRight,
  ChevronDown,
  FileText,
  Lightbulb,
  PenLine,
  ShieldAlert,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import {
  FEATURED_RESEARCH_WORKFLOWS,
  flattenResearchWorkflows,
  RESEARCH_WORKFLOW_GROUPS,
} from "@/lib/research-workflows";

const ICONS = {
  executive_brief: FileText,
  evidence_table: FileText,
  plain_language: Lightbulb,
  implementation_risks: ShieldAlert,
  stakeholder_map: Users,
  institutional_impact: Users,
  compliance_burden: ShieldAlert,
  causal_loop: Lightbulb,
  policy_brief: PenLine,
  argument_critique: ShieldAlert,
  op_ed_outline: PenLine,
};

const featuredWorkflows = flattenResearchWorkflows().filter((workflow) =>
  FEATURED_RESEARCH_WORKFLOWS.includes(workflow.id),
);

const WORKFLOW_PANEL_STORAGE_KEY = "rashtram:research-workflows-hidden";

function WorkflowButton({ workflow, disabled, onRun, compact = false }) {
  const Icon = ICONS[workflow.id] || Sparkles;
  return (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={() => onRun(workflow)}
      whileHover={disabled ? undefined : { y: -4, scale: 1.01 }}
      whileTap={disabled ? undefined : { scale: 0.975 }}
      transition={{ type: "spring", stiffness: 360, damping: 25 }}
      className={[
        "group rounded-2xl border border-[#8f1d2c]/10 bg-white text-left transition hover:border-[#8f1d2c]/25 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-45",
        compact ? "p-3" : "p-4",
      ].join(" ")}
    >
      <span className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#eee0dc] text-[#8f1d2c]">
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0">
          <span className="block text-xs font-bold text-[#29312d]">
            {workflow.title}
          </span>
          <span className="mt-1 line-clamp-2 block text-[11px] leading-5 text-[#706a61]">
            {workflow.description}
          </span>
        </span>
      </span>
    </motion.button>
  );
}

export function ResearchWorkflowPanel({
  disabled = false,
  document,
  onRunWorkflow,
}) {
  const [hidden, setHidden] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const pointerX = useMotionValue(480);
  const pointerY = useMotionValue(120);
  const smoothX = useSpring(pointerX, { stiffness: 90, damping: 28 });
  const smoothY = useSpring(pointerY, { stiffness: 90, damping: 28 });
  const cursorGlow = useMotionTemplate`radial-gradient(420px circle at ${smoothX}px ${smoothY}px, rgba(143, 29, 44, 0.105), transparent 58%)`;

  useEffect(() => {
    try {
      setHidden(
        window.localStorage.getItem(WORKFLOW_PANEL_STORAGE_KEY) === "1",
      );
    } catch {
      setHidden(false);
    }
  }, []);

  const updatePointer = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    pointerX.set(event.clientX - bounds.left);
    pointerY.set(event.clientY - bounds.top);
  };

  const hideWorkflows = () => {
    setHidden(true);
    try {
      window.localStorage.setItem(WORKFLOW_PANEL_STORAGE_KEY, "1");
    } catch {
      // Non-persistent hide is still useful if browser storage is unavailable.
    }
  };

  const showWorkflows = () => {
    setHidden(false);
    try {
      window.localStorage.removeItem(WORKFLOW_PANEL_STORAGE_KEY);
    } catch {
      // Nothing else to do; the visible state has already been restored.
    }
  };

  const runWorkflow = (workflow) => {
    if (disabled) return;
    onRunWorkflow?.({
      ...workflow,
      prompt: workflow.prompt(document),
    });
  };

  if (hidden) {
    return (
      <motion.div
        className="border-b border-[#8f1d2c]/8 bg-[#f7f2eb] px-4 py-3 sm:px-6"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: "easeOut" }}
      >
        <div className="flex flex-col gap-2 rounded-2xl border border-[#8f1d2c]/10 bg-[#fffaf0] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold text-[#8f1d2c]">
              Research workflows are hidden.
            </p>
            <p className="mt-0.5 text-[11px] text-[#706a61]">
              Keep the chat focused, or bring them back when you need structured
              outputs.
            </p>
          </div>
          <button
            type="button"
            onClick={showWorkflows}
            className="inline-flex w-fit items-center gap-2 rounded-full border border-[#8f1d2c]/15 bg-white px-3 py-2 text-xs font-bold text-[#8f1d2c] transition hover:-translate-y-0.5 hover:border-[#8f1d2c]/30"
          >
            Show workflows
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.section
      className="relative overflow-hidden border-b border-[#8f1d2c]/8 bg-[#f7f2eb] px-4 py-4 sm:px-6"
      initial={{ opacity: 0, y: 12, scale: 0.992 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
      onPointerMove={updatePointer}
    >
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: cursorGlow }}
      />
      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#874047]">
            Research workflows
          </p>
          <h2 className="mt-1 font-serif text-xl text-[#8f1d2c]">
            Start with an output, not a blank prompt
          </h2>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-[#706a61]">
            Run structured, evidence-grounded policy workflows on this document.
            Rashtram AI keeps citations attached and marks missing evidence.
          </p>
        </div>
        <button
          type="button"
          onClick={hideWorkflows}
          aria-label="Hide research workflows"
          className="inline-flex h-9 w-fit items-center gap-2 rounded-full border border-[#8f1d2c]/12 bg-white px-3 text-xs font-bold text-[#8f1d2c] transition hover:-translate-y-0.5 hover:border-[#8f1d2c]/25 hover:shadow-sm"
        >
          <X className="h-3.5 w-3.5" />
          Hide
        </button>
      </div>

      <div className="relative mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {featuredWorkflows.map((workflow) => (
          <WorkflowButton
            key={workflow.id}
            workflow={workflow}
            disabled={disabled}
            onRun={runWorkflow}
          />
        ))}
      </div>

      <div className="relative mt-3 overflow-hidden rounded-2xl border border-[#8f1d2c]/8 bg-[#fffaf0]">
        <button
          type="button"
          onClick={() => setShowAll((current) => !current)}
          aria-expanded={showAll}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-xs font-bold text-[#8f1d2c] transition hover:bg-[#f3ebe1]"
        >
          <span>{showAll ? "Hide all workflows" : "Show all workflows"}</span>
          <motion.span
            animate={{ rotate: showAll ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="h-4 w-4" />
          </motion.span>
        </button>
        <AnimatePresence initial={false}>
          {showAll ? (
            <motion.div
              key="workflow-groups"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              className="overflow-hidden border-t border-[#8f1d2c]/8"
            >
              <div className="grid gap-4 p-4 xl:grid-cols-3">
                {RESEARCH_WORKFLOW_GROUPS.map((group) => (
                  <section key={group.id}>
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#874047]">
                      {group.title}
                    </p>
                    <p className="mt-1 text-[11px] leading-5 text-[#706a61]">
                      {group.description}
                    </p>
                    <div className="mt-3 grid gap-2">
                      {group.workflows.map((workflow) => (
                        <WorkflowButton
                          key={workflow.id}
                          workflow={workflow}
                          disabled={disabled}
                          onRun={runWorkflow}
                          compact
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </motion.section>
  );
}
