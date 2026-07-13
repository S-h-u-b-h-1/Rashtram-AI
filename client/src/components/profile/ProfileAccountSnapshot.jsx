import {
  ArrowRight,
  Building2,
  Languages,
  MapPin,
  Settings2,
  ShieldCheck,
  UserRound,
} from "lucide-react";

export function ProfileAccountSnapshot({ account, user, onOpen }) {
  const details = account?.profile || {};
  const rows = [
    { label: "Organization", value: details.organization, icon: Building2 },
    {
      label: "Role",
      value: details.designation || details.role,
      icon: UserRound,
    },
    { label: "Location", value: details.location, icon: MapPin },
    { label: "Language", value: details.languagePreference, icon: Languages },
  ].filter((item) => item.value);

  return (
    <aside
      className="surface-card overflow-hidden"
      aria-labelledby="account-snapshot-title"
    >
      <div className="border-b border-[#8f1d2c]/8 bg-[#f6f2eb] p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#874047]">
              Account overview
            </p>
            <h2
              id="account-snapshot-title"
              className="mt-1.5 font-serif text-xl text-[#8f1d2c]"
            >
              Your details
            </h2>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-[#e8f0eb] px-2.5 py-1 text-[9px] font-semibold text-[#34725b]">
            <ShieldCheck className="h-3 w-3" />
            {user.authenticationProvider}
          </span>
        </div>
        {details.bio ? (
          <p className="mt-3 line-clamp-3 text-xs leading-5 text-[#706a61]">
            {details.bio}
          </p>
        ) : (
          <p className="mt-3 text-xs leading-5 text-[#91887d]">
            Add a short bio and professional details to make this workspace
            feel like yours.
          </p>
        )}
      </div>
      <dl className="divide-y divide-[#8f1d2c]/7 px-5">
        {rows.map((item) => {
          const ItemIcon = item.icon;
          return (
            <div key={item.label} className="flex items-center gap-3 py-3">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#eee5d9] text-[#874047]">
                <ItemIcon className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0">
                <dt className="text-[9px] uppercase tracking-[0.1em] text-[#91887d]">
                  {item.label}
                </dt>
                <dd className="mt-0.5 truncate text-xs font-semibold text-[#514d46]">
                  {item.value}
                </dd>
              </div>
            </div>
          );
        })}
        {!rows.length && (
          <div className="py-5 text-xs leading-5 text-[#81796e]">
            No optional account details have been added yet.
          </div>
        )}
      </dl>
      <div className="grid gap-2 border-t border-[#8f1d2c]/8 p-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
        <button
          type="button"
          onClick={() => onOpen("details")}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#8f1d2c] px-3 text-[11px] font-semibold text-white"
        >
          <Settings2 className="h-3.5 w-3.5" />
          Edit details
        </button>
        <button
          type="button"
          onClick={() => onOpen("security")}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#8f1d2c]/10 bg-white px-3 text-[11px] font-semibold text-[#8f1d2c]"
        >
          Security
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </aside>
  );
}
