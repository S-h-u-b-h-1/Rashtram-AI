"use client";

import {
  ArrowRight,
  FileText,
  Lightbulb,
  PenLine,
  ShieldAlert,
  Sparkles,
  Users,
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

function WorkflowButton({ workflow, disabled, onRun, compact = false }) {
  const Icon = ICONS[workflow.id] || Sparkles;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onRun(workflow)}
      className={[
        "group rounded-2xl border border-[#8f1d2c]/10 bg-white text-left transition hover:-translate-y-0.5 hover:border-[#8f1d2c]/25 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-45",
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
    </button>
  );
}

export function ResearchWorkflowPanel({
  disabled = false,
  document,
  onRunWorkflow,
}) {
  const runWorkflow = (workflow) => {
    if (disabled) return;
    onRunWorkflow?.({
      ...workflow,
      prompt: workflow.prompt(document),
    });
  };

  return (
    <section className="border-b border-[#8f1d2c]/8 bg-[#f7f2eb] px-4 py-4 sm:px-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
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
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {featuredWorkflows.map((workflow) => (
          <WorkflowButton
            key={workflow.id}
            workflow={workflow}
            disabled={disabled}
            onRun={runWorkflow}
          />
        ))}
      </div>

      <details className="mt-3 rounded-2xl border border-[#8f1d2c]/8 bg-[#fffaf0]">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-xs font-bold text-[#8f1d2c] marker:hidden">
          <span>Show all workflows</span>
          <ArrowRight className="h-4 w-4" />
        </summary>
        <div className="grid gap-4 border-t border-[#8f1d2c]/8 p-4 xl:grid-cols-3">
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
      </details>
    </section>
  );
}
