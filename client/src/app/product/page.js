"use client";

import React from "react";
import Link from "next/link";
import {
  Brain,
  MessageSquare,
  Database,
  Shield,
  FileText,
  Search,
  Clock,
  Star,
  ArrowRight,
  CheckCircle,
  ExternalLink,
  Sparkles,
  Zap,
  Layers,
} from "lucide-react";

const FeatureCard = ({ icon: Icon, title, description, delay }) => (
  <div
    className="group relative bg-white/70 backdrop-blur-lg p-8 border border-gray-100/50 hover:border-[#B20F38]/30 hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 overflow-hidden"
    style={{ animationDelay: delay }}
  >
    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-red-100 to-transparent rounded-full blur-3xl -mr-16 -mt-16 transition-all duration-500 group-hover:bg-red-200/50"></div>

    <div className="relative z-10">
      <div className="w-14 h-14 bg-gradient-to-br from-white to-gray-50 flex items-center justify-center mb-6 shadow-sm border border-gray-100 group-hover:scale-110 transition-transform duration-500">
        <Icon className="w-7 h-7 text-[#B20F38]" />
      </div>
      <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-[#B20F38] transition-colors duration-300">
        {title}
      </h3>
      <p className="text-gray-600 leading-relaxed group-hover:text-gray-700">
        {description}
      </p>
    </div>
  </div>
);

const StatBox = ({ number, label }) => (
  <div className="relative text-center p-8 bg-white/60 backdrop-blur-md border border-white/50 shadow-sm hover:shadow-lg transition-all duration-300 group">
    <div className="text-4xl md:text-5xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-[#B20F38] to-[#FF4D6D] mb-3 group-hover:scale-105 transition-transform duration-300">
      {number}
    </div>
    <div className="text-sm font-bold text-gray-500 uppercase tracking-widest">
      {label}
    </div>
  </div>
);

const DataSourceItem = ({ name, type }) => (
  <div className="flex items-center justify-between p-5 bg-white/80 backdrop-blur-sm border border-gray-100 hover:border-red-100 hover:shadow-lg hover:shadow-red-50/50 transition-all duration-300 group cursor-default">
    <div className="flex items-center space-x-4">
      <div className="w-2.5 h-2.5 bg-gray-300 group-hover:bg-[#B20F38] group-hover:scale-125 transition-all duration-300"></div>
      <span className="font-semibold text-gray-700 group-hover:text-gray-900 transition-colors">
        {name}
      </span>
    </div>
    <span className="text-xs font-bold text-[#B20F38]/80 bg-red-50/80 px-3 py-1.5 uppercase tracking-wider group-hover:bg-[#B20F38] group-hover:text-white transition-all duration-300">
      {type}
    </span>
  </div>
);

function ProductPage() {
  const features = [
    {
      icon: MessageSquare,
      title: "Intelligent Conversations",
      description:
        "Natural language processing that understands complex policy queries and provides contextual, actionable responses tailored to your needs.",
      delay: "0ms",
    },
    {
      icon: Database,
      title: "Comprehensive Data",
      description:
        "Access to 500+ verified data sources including government databases, research institutions, and international organizations.",
      delay: "100ms",
    },
    {
      icon: FileText,
      title: "Automatic Citations",
      description:
        "Every response includes proper citations and source references (APA, MLA, etc.), ensuring almost academic-grade integrity.",
      delay: "200ms",
    },
    {
      icon: Shield,
      title: "Verified Information",
      description:
        "Multi-layer verification process ensures all data is accurate, up-to-date, and comes from authoritative, trusted sources.",
      delay: "0ms",
    },
    {
      icon: Layers,
      title: "Advanced Analytics",
      description:
        "Deep analysis capabilities that identify patterns, trends, and correlations across multiple policy domains instantly.",
      delay: "100ms",
    },
    {
      icon: Clock,
      title: "Real-time Updates",
      description:
        "Continuous monitoring and updating of policy data to ensure recommendations reflect the absolute latest developments.",
      delay: "200ms",
    },
  ];

  const dataSources = [
    { name: "Government of India Open Data", type: "Official" },
    { name: "World Bank Open Data", type: "Global" },
    { name: "NITI Aayog Reports", type: "Think Tank" },
    { name: "Census of India", type: "Demographic" },
    { name: "Reserve Bank of India", type: "Financial" },
    { name: "UN Sustainable Development Goals", type: "Global" },
  ];

  return (
    <div className="min-h-screen bg-[#FAFAFA] font-sans overflow-x-hidden selection:bg-[#B20F38] selection:text-white">
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-0 w-[50vw] h-[50vh] bg-red-100/40 rounded-full blur-[120px] -translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 right-0 w-[40vw] h-[40vh] bg-blue-50/40 rounded-full blur-[100px] translate-x-1/3 translate-y-1/3"></div>
      </div>

      <div className="relative z-10 pt-16">
        <section className="pt-20 pb-32 px-4 sm:px-6 lg:px-8 bg-gray-50">
          <div className="max-w-7xl mx-auto text-center">
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-black text-gray-900 mb-8 tracking-tighter leading-tight animate-fade-in-up delay-100">
              Intelligence{" "}
              <span className="relative inline-block">
                <span className="relative z-10 text-transparent bg-clip-text bg-gradient-to-r from-[#B20F38] to-[#E11D48]">
                  Verified
                </span>
                <span className="absolute bottom-2 left-0 w-full h-3 bg-red-100/50 -rotate-2 -z-10 rounded-full"></span>
              </span>{" "}
              <br />
              for the Future
            </h1>

            <p className="text-xl md:text-2xl text-gray-600 mb-12 max-w-3xl mx-auto leading-relaxed animate-fade-in-up delay-200">
              Rashtram AI transforms policy research with complete transparency.
              Real sourcing, real-time data, real impact.
            </p>

            <div className="flex flex-col sm:flex-row gap-5 justify-center animate-fade-in-up delay-300">
              <Link
                href="/signup"
                className="px-10 py-4 bg-[#B20F38] text-white font-bold text-lg shadow-lg shadow-red-600/20 hover:shadow-red-600/40 hover:-translate-y-1 transition-all"
              >
                Start Free Trial
              </Link>
              <Link
                href="#features"
                className="px-10 py-4 bg-white text-gray-700 border border-gray-200 font-bold text-lg shadow-sm hover:shadow-md hover:-translate-y-1 hover:text-[#B20F38] hover:border-red-100 transition-all flex items-center justify-center"
              >
                Explore Features
              </Link>
            </div>
          </div>
        </section>

        <section className="px-4 -mt-16 sm:px-6 lg:px-8 pb-24 relative z-20">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatBox number="500+" label="Data Sources" />
              <StatBox number="99.2%" label="Accuracy" />
              <StatBox number="24/7" label="Monitoring" />
              <StatBox number="10K+" label="Daily Citations" />
            </div>
          </div>
        </section>

        <section id="features" className="py-24 px-4 sm:px-6 lg:px-8 relative">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-20">
              <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-6">
                Built for Precision
              </h2>
              <p className="text-xl text-gray-500 max-w-2xl mx-auto">
                Sophisticated tools designed for the rigorous demands of modern
                policy making.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {features.map((feature, index) => (
                <FeatureCard key={index} {...feature} />
              ))}
            </div>
          </div>
        </section>

        <section className="py-24 px-4 sm:px-6 lg:px-8 bg-white/50 relative overflow-hidden">
          <div className="absolute inset-0 bg-grid-pattern opacity-[0.03]"></div>
          <div className="max-w-6xl mx-auto relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-16">
              <div className="lg:col-span-2 space-y-8">
                <span className="text-[#B20F38] font-bold tracking-wider uppercase text-sm">
                  Transparency First
                </span>
                <h2 className="text-4xl font-black text-gray-900 leading-tight">
                  Trusted by <br />
                  <span className="text-gray-400">the Best</span>
                </h2>
                <p className="text-lg text-gray-600 leading-relaxed">
                  We don’t just generate text; we synthesize knowledge from the
                  world’s most credible institutions. Every claim is verifiable.
                </p>
                <Link
                  href="/signup"
                  className="inline-flex items-center text-[#B20F38] font-bold text-lg hover:underline decoration-2 underline-offset-4 cursor-pointer group"
                >
                  Verify our sources{" "}
                  <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>

              <div className="lg:col-span-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {dataSources.map((source, index) => (
                    <DataSourceItem key={index} {...source} />
                  ))}
                  <div className="flex items-center justify-center p-5 bg-gradient-to-r from-red-50 to-white border border-dashed border-red-200 text-gray-500 font-medium cursor-pointer hover:bg-red-50 transition-colors">
                    + 490 more sources
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-24 px-4 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto">
            <div className="relative rounded-2xl overflow-hidden bg-[#B20F38] text-white shadow-2xl shadow-red-900/30 px-8 py-20 md:px-20 text-center">
              <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl translate-x-1/2 -translate-y-1/2"></div>
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-black/10 rounded-full blur-3xl -translate-x-1/3 translate-y-1/3"></div>

              <div className="relative z-10">
                <h2 className="text-4xl md:text-5xl font-black mb-6 tracking-tight">
                  Ready to see the difference?
                </h2>
                <p className="text-red-100 text-xl mb-10 max-w-2xl mx-auto font-light">
                  Join a community of forward-thinking policymakers and
                  researchers leveraging AI for public good.
                </p>
                <div className="flex flex-col sm:flex-row gap-5 justify-center">
                  <Link
                    href="/signup"
                    className="px-10 py-4 bg-white text-[#B20F38] font-bold text-lg rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    Get Started Free
                  </Link>
                  <Link
                    href="/contact"
                    className="px-10 py-4 border border-white text-white font-bold text-lg rounded-lg hover:bg-white hover:text-[#B20F38] transition-colors"
                  >
                    Book a Demo
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

export default ProductPage;
