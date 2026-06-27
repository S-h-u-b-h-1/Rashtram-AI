import { CalendarDays, KeyRound, Mail, ShieldCheck } from "lucide-react";
import { formatDate } from "@/lib/document-links";

export function ProfileIdentity({ user }) {
  return (
    <section className="relative overflow-hidden rounded-[1.8rem] bg-[#19231f] p-6 text-white sm:p-8">
      <div className="policy-grid absolute inset-0 opacity-20" />
      <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
        <div className="grid h-20 w-20 shrink-0 place-items-center rounded-3xl bg-[#d97745] font-serif text-2xl font-semibold">
          {user.initials}
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#efb36f]">
            Research profile
          </p>
          <h2 className="mt-2 truncate font-serif text-3xl sm:text-4xl">
            {user.name}
          </h2>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-white/55">
            <span className="inline-flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" />
              {user.email}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" />
              {user.accountType}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <KeyRound className="h-3.5 w-3.5" />
              {user.authenticationProvider}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              Joined {formatDate(user.joinedAt)}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
