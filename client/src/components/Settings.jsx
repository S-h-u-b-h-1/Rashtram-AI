import React, { useState, useEffect } from "react";
import {
  Settings,
  User,
  Shield,
  HelpCircle,
  Loader2,
} from "lucide-react";
import * as api from "@/lib/api";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("account");
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const data = await api.getUser();
        setUserData(data);
      } catch (err) {
        console.error("Failed to fetch user settings:", err);
        setError("Failed to load user information");
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  const menuItems = [
    { id: "account", label: "Account", icon: User },
    { id: "general", label: "General", icon: Settings },
    { id: "security", label: "Security", icon: Shield },
    { id: "support", label: "Help & Support", icon: HelpCircle },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#9b2638] animate-spin" />
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case "account":
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-6">
                Account Information
              </h3>
              <div className="space-y-6 max-w-2xl">
                <div className="flex items-center gap-6 p-6 bg-white border border-gray-100 rounded-2xl shadow-sm">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#9b2638] text-2xl font-bold text-white shadow-lg shadow-[#541018]/15">
                    {userData?.name ? userData.name.substring(0, 2).toUpperCase() : "U"}
                  </div>
                  <div>
                    <h4 className="text-xl font-semibold text-gray-900">{userData?.name || "User"}</h4>
                    <p className="text-gray-500">{userData?.email || "email@example.com"}</p>
                  </div>
                </div>

                <div className="grid gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 ml-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      defaultValue={userData?.name}
                      readOnly
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-600 focus:outline-none cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 ml-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      defaultValue={userData?.email}
                      readOnly
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-600 focus:outline-none cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case "general":
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-6">
                General Preferences
              </h3>
              <div className="space-y-6 max-w-2xl">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 ml-1">
                    Theme
                  </label>
                  <select className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#9b2638]/20 focus:border-[#9b2638] transition-all">
                    <option value="light">Light Mode</option>
                    <option value="dark">Dark Mode</option>
                    <option value="system">System Default</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        );

      case "security":
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Security</h3>
              <div className="space-y-4 max-w-2xl">
                <div className="p-6 border border-gray-200 rounded-2xl hover:border-[#9b2638]/30 transition-colors group bg-white">
                  <h4 className="font-semibold text-gray-900 mb-2 group-hover:text-[#9b2638] transition-colors">Change Password</h4>
                  <p className="text-sm text-gray-500 mb-4">
                    Update your password to keep your account secure
                  </p>
                  <button className="rounded-xl bg-gray-900 px-6 py-2.5 text-sm font-medium text-white shadow-lg shadow-gray-900/10 transition-all duration-300 hover:bg-[#9b2638] hover:shadow-[#541018]/15">
                    Update Password
                  </button>
                </div>
              </div>
            </div>
          </div>
        );

      case "support":
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Help & Support</h3>
              <div className="grid gap-4 max-w-2xl">
                {[
                  { title: "Documentation", desc: "Browse our comprehensive guides" },
                  { title: "Contact Support", desc: "Get help from our team" },
                  { title: "Community", desc: "Connect with other users" }
                ].map((item, i) => (
                  <a
                    key={i}
                    href="#"
                    className="group block rounded-2xl border border-gray-200 bg-white p-6 transition-all duration-300 hover:border-[#9b2638] hover:shadow-lg hover:shadow-[#541018]/5"
                  >
                    <h4 className="font-semibold text-gray-900 mb-1 group-hover:text-[#9b2638] transition-colors">{item.title}</h4>
                    <p className="text-sm text-gray-500">{item.desc}</p>
                  </a>
                ))}
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="max-w-7xl mx-auto p-6 md:p-12">
        <h1 className="text-4xl font-bold mb-10 text-gray-900 tracking-tight">Settings</h1>

        <div className="flex flex-col md:flex-row gap-8">
          {}
          <div className="w-full md:w-72 shrink-0">
            <nav className="space-y-2">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-300 font-medium ${
                      isActive
                        ? "scale-[1.02] bg-[#9b2638] text-white shadow-xl shadow-[#541018]/15"
                        : "text-gray-600 hover:bg-white hover:shadow-md hover:text-[#9b2638] bg-transparent"
                    }`}
                  >
                    <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                    <span className="text-base">{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {}
          <div className="flex-1 min-h-[500px]">
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
}
