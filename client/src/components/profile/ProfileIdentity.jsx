import {
  Building2,
  CalendarDays,
  KeyRound,
  Mail,
  MapPin,
  Pencil,
  ShieldCheck,
} from "lucide-react";
import { formatDate } from "@/lib/document-links";

export function ProfileIdentity({ user, profile, onEdit }) {
  const professionalLine = [profile?.designation, profile?.organization]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className="relative overflow-hidden rounded-[1.8rem] bg-[#8f1d2c] px-5 py-6 text-white shadow-[0_24px_65px_rgba(86,20,30,0.2)] sm:px-7 sm:py-7 lg:px-9 lg:py-8">
      <div className="policy-grid pointer-events-none absolute inset-0 opacity-20" />
      <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full border border-white/10 bg-white/[0.035]" />
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-center">
          <div
            className="grid h-20 w-20 shrink-0 place-items-center rounded-[1.35rem] border border-white/15 bg-[#a85a52] bg-cover bg-center font-serif text-2xl font-semibold shadow-[0_12px_30px_rgba(30,10,15,0.2)] sm:h-24 sm:w-24"
            style={
              user.avatar
                ? { backgroundImage: `url("${user.avatar}")` }
                : undefined
            }
            aria-label={user.avatar ? `${user.name} profile photo` : undefined}
          >
            {!user.avatar && user.initials}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/12 bg-white/[0.08] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-[#ecd9b9]">
                {user.accountType}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.08] px-2.5 py-1 text-[9px] font-medium text-white/70">
                <KeyRound className="h-3 w-3" />
                {user.authenticationProvider} account
              </span>
            </div>
            <h2 className="mt-3 break-words font-serif text-3xl leading-none sm:text-4xl lg:text-[2.65rem]">
              {user.name}
            </h2>
            {professionalLine && (
              <p className="mt-2 text-sm text-white/68">{professionalLine}</p>
            )}
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-white/58 sm:text-xs">
              <span className="inline-flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" />
                {user.email}
              </span>
              {profile?.organization && (
                <span className="inline-flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" />
                  {profile.organization}
                </span>
              )}
              {profile?.location && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  {profile.location}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" />
                Joined {formatDate(user.joinedAt)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-3 sm:flex-row lg:flex-col lg:items-end">
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#fffaf0] px-4 text-xs font-semibold text-[#8f1d2c] shadow-sm transition hover:-translate-y-0.5 hover:bg-white"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit profile
          </button>
          <p className="inline-flex items-center gap-1.5 text-[10px] text-white/48">
            <ShieldCheck className="h-3.5 w-3.5 text-[#d4b782]" />
            Account details are private by default
          </p>
        </div>
      </div>
    </section>
  );
}
