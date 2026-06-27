"use client";

import React from "react";
import Link from "next/link";
import {
  GraduationCap,
  Heart,
  Leaf,
  Building,
  Shield,
  Users,
  ArrowRight,
  PieChart,
  TrendingUp,
  Activity,
  Zap,
  Check,
} from "lucide-react";

const SolutionCard = ({ icon: Icon, title, description, impact, index }) => (
  <div className="group relative bg-white p-8 hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 border border-gray-100 overflow-hidden">
    <div className="absolute inset-0 bg-gradient-to-br from-red-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

    <div className="relative z-10 flex flex-col h-full">
      <div className="flex items-start justify-between mb-6">
        <div className="w-14 h-14 bg-gradient-to-br from-[#B20F38] to-[#FF4D6D] flex items-center justify-center shadow-lg shadow-red-500/20 text-white group-hover:scale-110 transition-transform duration-500">
          <Icon className="w-7 h-7" />
        </div>
        <span className="text-gray-300 font-black text-2xl opacity-20 group-hover:opacity-10 transition-opacity">
          0{index + 1}
        </span>
      </div>

      <h3 className="text-2xl font-bold text-gray-900 mb-4 group-hover:text-[#B20F38] transition-colors">
        {title}
      </h3>
      <p className="text-gray-600 leading-relaxed mb-8 flex-grow">
        {description}
      </p>

      <div className="bg-gray-50 p-4 border border-gray-100 group-hover:bg-white group-hover:shadow-sm transition-all">
        <div className="flex items-center text-[#B20F38] font-bold text-sm mb-1">
          <TrendingUp className="w-4 h-4 mr-2" />
          PROJECTED IMPACT
        </div>
        <p className="text-gray-800 font-medium text-sm leading-snug">
          {impact}
        </p>
      </div>
    </div>
  </div>
);

const ImpactStat = ({ number, label, suffix }) => (
  <div className="flex flex-col items-center justify-center p-8 bg-white/50 backdrop-blur-md border border-white shadow-lg hover:shadow-xl transition-all hover:-translate-y-1">
    <div className="flex items-baseline mb-2 bg-clip-text text-transparent bg-gradient-to-tr from-gray-900 to-gray-600">
      <span className="text-5xl lg:text-6xl font-black tracking-tighter">
        {number}
      </span>
      <span className="text-2xl font-bold text-[#B20F38] ml-1">{suffix}</span>
    </div>
    <div className="text-sm font-bold text-gray-500 uppercase tracking-widest text-center">
      {label}
    </div>
  </div>
);

const ProcessStep = ({ number, title, description }) => (
  <div className="relative pl-12 pb-12 last:pb-0 border-l-2 border-dashed border-gray-200 last:border-0 md:pl-0 md:pb-0 md:border-l-0 md:border-t-2 md:pt-12 md:flex-1">
    <div className="absolute left-[-9px] top-0 w-4 h-4 rounded-full bg-[#B20F38] ring-4 ring-white md:top-[-9px] md:left-0"></div>

    <div className="text-[#B20F38] font-black text-6xl opacity-10 leading-none absolute top-0 right-10 md:top-6 md:left-4 select-none">
      {number}
    </div>

    <div className="relative z-10">
      <h3 className="text-xl font-bold text-gray-900 mb-3">{title}</h3>
      <p className="text-gray-600 text-sm leading-relaxed max-w-xs">
        {description}
      </p>
    </div>
  </div>
);

function SolutionPage() {
  const solutions = [
    {
      icon: GraduationCap,
      title: "Education Policy",
      description:
        "AI-driven analysis to identify gaps in learning outcomes combined with resource allocation modeling.",
      impact: "25% improvement in literacy rates expected.",
    },
    {
      icon: Heart,
      title: "Healthcare Reform",
      description:
        "Optimizing public health frameworks by analyzing disease patterns and delivery efficiency.",
      impact: "40% reduction in regional health disparities.",
    },
    {
      icon: Leaf,
      title: "Climate Action",
      description:
        "Data-backed strategies for mitigation, sustainable development, and green infrastructure.",
      impact: "30% emission reduction via smart enforcement.",
    },
    {
      icon: Building,
      title: "Urban Planning",
      description:
        "Smart city solutions balancing urbanization with quality of life and infrastructure.",
      impact: "50% higher urban livability indices.",
    },
    {
      icon: Shield,
      title: "Social Security",
      description:
        "Robust safety nets adapting to economic conditions to protect the vulnerable.",
      impact: "95% coverage of eligible beneficiaries.",
    },
    {
      icon: Users,
      title: "Future of Work",
      description:
        "Workforce adaptation strategies and skill development for an automating economy.",
      impact: "2M+ new jobs in emerging tech sectors.",
    },
  ];

  return (
    <div className="min-h-screen bg-[#FDFDFD] font-sans selection:bg-[#B20F38] selection:text-white overflow-x-hidden">
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] bg-red-50/60 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-[10%] left-[-10%] w-[500px] h-[500px] bg-gray-100/60 rounded-full blur-[80px]"></div>
      </div>

      <div className="relative z-10 pt-16">
        <section className="pt-24 pb-32 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-white to-transparent">
          <div className="max-w-7xl mx-auto text-center">
            <h1 className="text-6xl md:text-8xl font-black text-gray-900 mb-8 tracking-tighter leading-[0.9] animate-fade-in-up delay-100">
              Solve for <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#B20F38] to-[#FF8FA3]">
                Tomorrow.
              </span>
            </h1>

            <p className="text-xl md:text-2xl text-gray-500 mb-14 max-w-2xl mx-auto leading-relaxed font-medium animate-fade-in-up delay-200">
              From education to environment, we deliver the precision insights
              needed to solve humanity's complex challenges.
            </p>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto animate-fade-in-up delay-300">
              <ImpactStat number="50" label="Lives Impacted" suffix="M+" />
              <ImpactStat number="35" label="Efficiency Gain" suffix="%" />
              <ImpactStat number="2.5" label="Economic Value" suffix="T₹" />
              <ImpactStat number="200" label="Policy Areas" suffix="+" />
            </div>
          </div>
        </section>

        <section className="py-24 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row items-end justify-between mb-16 gap-6">
              <div>
                <h2 className="text-4xl font-black text-gray-900 mb-4">
                  Comprehensive <br />
                  Coverage
                </h2>
                <p className="text-lg text-gray-500 max-w-md">
                  Tailored AI models trained for every critical sector of modern
                  governance.
                </p>
              </div>
              <Link
                href="/signup"
                className="group flex items-center font-bold text-[#B20F38] text-lg hover:underline decoration-2 underline-offset-4"
              >
                View all models{" "}
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {solutions.map((solution, index) => (
                <SolutionCard key={index} {...solution} index={index} />
              ))}
            </div>
          </div>
        </section>

        <section className="py-24 px-4 sm:px-6 lg:px-8 bg-white relative">
          <div className="absolute inset-0 bg-grid-pattern opacity-[0.03]"></div>
          <div className="max-w-7xl mx-auto relative z-10">
            <div className="text-center mb-20">
              <h2 className="text-4xl font-black text-gray-900 mb-6">
                From Data to Impact
              </h2>
              <p className="text-xl text-gray-500 max-w-3xl mx-auto">
                Our methodology combines rigorous data science with deep domain
                expertise to transform signals into solutions.
              </p>
            </div>

            <div className="flex flex-col md:flex-row gap-8 lg:gap-12 justify-between">
              <ProcessStep
                number="01"
                title="Aggregation"
                description="Collecting real-time signals from thousands of verified public and private sources globally."
              />
              <ProcessStep
                number="02"
                title="Modeling"
                description="Simulating complex policy outcomes to stress-test potential solutions before any implementation."
              />
              <ProcessStep
                number="03"
                title="Optimization"
                description="Refining recommendations through feedback loops to balance diverse needs and maximize welfare."
              />
              <div className="md:pt-12">
                <div className="w-14 h-14 bg-[#B20F38] flex items-center justify-center text-white shadow-xl shadow-red-500/30 animate-pulse">
                  <Check size={28} strokeWidth={3} />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-24 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="relative rounded-2xl bg-gray-900 overflow-hidden shadow-2xl p-12 md:p-24 text-center">
              <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20"></div>
              <div className="absolute -top-24 -right-24 w-96 h-96 bg-[#B20F38] rounded-full blur-[100px] opacity-40"></div>
              <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-blue-600 rounded-full blur-[100px] opacity-20"></div>

              <div className="relative z-10">
                <h2 className="text-4xl md:text-6xl font-black text-white mb-8 tracking-tight">
                  Ready to shape <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-orange-400">
                    the future?
                  </span>
                </h2>
                <p className="text-gray-400 text-xl mb-12 max-w-2xl mx-auto">
                  Join the platform that is powering the next generation of
                  evidence-based governance.
                </p>
                <div className="flex flex-col sm:flex-row gap-5 justify-center">
                  <Link
                    href="/signup"
                    className="px-12 py-5 bg-[#B20F38] text-white font-bold text-lg rounded-lg hover:bg-[#d61a46] transition-all transform hover:scale-105 shadow-xl shadow-red-900/50"
                  >
                    Get Started Now
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default SolutionPage;
