import {
  BookOpenText,
  FileText,
  Landmark,
  Newspaper,
  Scale,
  ScrollText,
  ShieldCheck,
} from "lucide-react";
import { humanize } from "@/lib/document-links";

const TYPES = [
  ["bill", "Bills", FileText, "Potential changes entering the legislative pipeline."],
  ["act", "Acts", Scale, "Enacted law that may create current rights or duties."],
  ["gazette", "Gazettes", Newspaper, "Official publication giving legal changes public effect."],
  ["policy", "Policies", Landmark, "Government direction shaping implementation priorities."],
  ["committee_report", "Committee reports", BookOpenText, "Parliamentary scrutiny and recommendations."],
  ["rule", "Rules", ShieldCheck, "Detailed legal requirements made under an Act."],
  ["notification", "Notifications", ScrollText, "Operational dates, exemptions, appointments, and changes."],
];

export function MajorDevelopments({ developments = [] }) {
  const counts = new Map(
    developments.map((item) => [item.documentType, item.documentCount]),
  );
  return (
    <section className="surface-card p-5 sm:p-6">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#874047]">
        Last 30 days
      </p>
      <h2 className="mt-2 font-serif text-2xl text-[#8f1d2c]">
        Major legislative developments
      </h2>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {TYPES.map(([type, label, Icon, why]) => (
          <article
            key={type}
            className="rounded-2xl border border-[#8f1d2c]/8 bg-[#f6f2eb] p-4"
          >
            <Icon className="h-4 w-4 text-[#874047]" />
            <p className="mt-4 font-serif text-3xl text-[#8f1d2c]">
              {Number(counts.get(type) || 0).toLocaleString("en-IN")}
            </p>
            <p className="mt-1 text-xs font-semibold text-[#514d46]">
              {humanize(label)}
            </p>
            <p className="mt-2 text-[10px] leading-4 text-[#81796e]">{why}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
