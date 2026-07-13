import {
  CalendarDays,
  KeyRound,
  LogOut,
  Mail,
  PencilLine,
  ShieldCheck,
} from "lucide-react";
import { formatDate } from "@/lib/document-links";

export function ProfileIdentity({ user, role, onSignOut }) {
  return (
    <section className="relative overflow-hidden rounded-[1.8rem] bg-[#8f1d2c] p-6 text-white sm:p-8">
      <div className="policy-grid absolute inset-0 opacity-20" />
      <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
        <div
          className="grid h-20 w-20 shrink-0 place-items-center rounded-3xl bg-[#a85a52] bg-cover bg-center font-serif text-2xl font-semibold"
          style={
            user.avatar
              ? { backgroundImage: `url("${user.avatar}")` }
              : undefined
          }
          aria-label={user.avatar ? `${user.name} profile photo` : undefined}
        >
          {!user.avatar && user.initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#c1a06f]">
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
              {role || user.accountType}
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
        <div className="flex flex-wrap gap-2 sm:self-start">
          <a
            href="#account-settings"
            className="inline-flex h-10 items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 text-xs font-semibold text-white transition hover:bg-white/15"
          >
            <PencilLine className="h-3.5 w-3.5" />
            Edit profile
          </a>
          <button
            type="button"
            onClick={onSignOut}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-white/15 px-4 text-xs font-semibold text-white/75 transition hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      </div>
    </section>
  );
}
