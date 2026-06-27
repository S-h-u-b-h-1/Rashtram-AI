import {
  Bell,
  Download,
  PencilLine,
  ShieldAlert,
} from "lucide-react";

export function AccountSettings() {
  const actions = [
    {
      label: "Edit profile",
      description: "Update your name and profile information.",
      icon: PencilLine,
    },
    {
      label: "Export research data",
      description: "Download saved chats and summaries.",
      icon: Download,
    },
    {
      label: "Manage notifications",
      description: "Choose future legislative alerts and digests.",
      icon: Bell,
    },
    {
      label: "Delete account",
      description: "Secure account deletion is not available yet.",
      icon: ShieldAlert,
      destructive: true,
    },
  ];

  return (
    <section className="surface-card p-5 sm:p-6">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#9e4937]">
          Account controls
        </p>
        <h2 className="mt-2 font-serif text-2xl text-[#19231f]">
          Settings
        </h2>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {actions.map((action) => {
          const ActionIcon = action.icon;
          return (
            <button
              key={action.label}
              type="button"
              disabled
              className="flex cursor-not-allowed items-start gap-3 rounded-2xl border border-[#19231f]/9 bg-[#fffdf8] p-4 text-left opacity-75"
            >
              <ActionIcon
                className={`mt-0.5 h-4 w-4 shrink-0 ${
                  action.destructive ? "text-[#a33d31]" : "text-[#9f4937]"
                }`}
              />
              <span>
                <span className="block text-sm font-semibold text-[#29312d]">
                  {action.label}
                </span>
                <span className="mt-1 block text-xs leading-5 text-[#81796e]">
                  {action.description} Coming soon.
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
