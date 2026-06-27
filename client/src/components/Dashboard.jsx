"use client";

import React, { useState, useEffect } from "react";
import * as api from "@/lib/api";
import Link from "next/link";

const Dashboard = () => {
  const [data, setData] = useState({
    recentBills: [],
    recentActs: [],
    stats: { totalBills: 0, totalActs: 0, totalChats: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState("");
  const [animateStats, setAnimateStats] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const dashboardData = await api.getDashboardData();
        setData(dashboardData);
        setLastUpdated(
          new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        );
        setAnimateStats(true);
      } catch (err) {
        console.error("Failed to fetch dashboard data:", err);
        setError("Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#B20F38]"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-red-500">
        {error}
      </div>
    );
  }

  const stats = [
    {
      label: "Total Chats",
      value: data.stats.totalChats,
    },
    {
      label: "Bill Analysis",
      value: data.stats.totalBills,
    },
    {
      label: "Act Research",
      value: data.stats.totalActs,
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Dashboard
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Overview of your parliamentary research
          </p>
        </div>
        <div className="text-xs font-medium px-3 py-1 bg-gray-100 text-gray-600 border border-gray-200">
          Updated: {lastUpdated}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat, idx) => (
          <div
            key={idx}
            className={`bg-white border border-gray-200 p-6 transition-all duration-300 hover:border-gray-300 hover:shadow-sm ${
              animateStats
                ? "translate-y-0 opacity-100"
                : "translate-y-4 opacity-0"
            }`}
            style={{ transitionDelay: `${idx * 100}ms` }}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-gray-500 text-sm font-medium">
                  {stat.label}
                </p>
                <p className="text-3xl font-bold text-gray-900 mt-2 tracking-tight">
                  {stat.value}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white border border-gray-200 p-6 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              Recent Bill Chats
            </h2>
            <Link
              href="#"
              onClick={() =>
                document.querySelector("button:nth-child(2)").click()
              }
              className="text-sm text-[#B20F38] font-medium hover:underline"
            >
              View All
            </Link>
          </div>
          <div className="space-y-4 flex-1">
            {data.recentBills.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                No recent bill chats found.
              </div>
            ) : (
              data.recentBills.map((bill, idx) => (
                <div
                  key={bill._id}
                  className="flex items-center justify-between p-3 hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100 group cursor-pointer"
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  <div className="flex-1 min-w-0 pr-4">
                    <p className="font-medium text-gray-900 truncate group-hover:text-[#B20F38] transition-colors">
                      {bill.billTitle}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      {new Date(bill.lastMessageAt).toLocaleDateString()} •{" "}
                      {bill.billStatus || "Unknown Status"}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(bill.lastMessageAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white border border-gray-200 p-6 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              Recent Act Chats
            </h2>
            <Link
              href="#"
              onClick={() =>
                document.querySelector("button:nth-child(3)").click()
              }
              className="text-sm text-blue-600 font-medium hover:underline"
            >
              View All
            </Link>
          </div>
          <div className="space-y-4 flex-1">
            {data.recentActs.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                No recent act chats found.
              </div>
            ) : (
              data.recentActs.map((act, idx) => (
                <div
                  key={act._id}
                  className="flex items-center justify-between p-3 hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100 group cursor-pointer"
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  <div className="flex-1 min-w-0 pr-4">
                    <p className="font-medium text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                      {act.actTitle}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      {new Date(act.updatedAt).toLocaleDateString()} •{" "}
                      {act.actStatus || "Active"}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(act.updatedAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
