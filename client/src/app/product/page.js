"use client";

import React, { useState } from 'react';
import Link from "next/link";
import { Brain, MessageSquare, Database, Shield, BookOpen, CheckCircle,ArrowRight,Search,FileText,Users,Clock,Star,Quote,ExternalLink,Zap,Target,Globe,Award,TrendingUp,BarChart3} from 'lucide-react';

const FeatureCard = ({ icon: Icon, title, description, highlight }) => (
<div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border border-gray-100">
    <div className="flex items-center mb-4">
    <div className="bg-gradient-to-r from-red-500 to-red-600 p-3 rounded-lg">
        <Icon className="w-6 h-6 text-white" />
    </div>
    <h3 className="text-xl font-bold text-gray-800 ml-4">{title}</h3>
    </div>
    <p className="text-gray-600 mb-4 leading-relaxed">{description}</p>
    {highlight && (
    <div className="bg-gradient-to-r from-red-50 to-red-100 p-3 rounded-lg">
        <p className="text-sm font-semibold text-red-700 flex items-center">
        <Star className="w-4 h-4 mr-2" />
        {highlight}
        </p>
    </div>
    )}
</div>
);

const DataSourceCard = ({ name, type, coverage, reliability, description }) => (
<div className="bg-white rounded-lg p-6 border border-gray-200 hover:border-red-300 transition-colors duration-300">
    <div className="flex items-start justify-between mb-4">
    <div>
        <h4 className="text-lg font-bold text-gray-800">{name}</h4>
        <span className="inline-block bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs font-medium mt-1">
        {type}
        </span>
    </div>
    <div className="flex items-center">
        <div className="flex">
        {[...Array(5)].map((_, i) => (
            <Star 
            key={i} 
            className={`w-4 h-4 ${i < reliability ? 'text-yellow-400 fill-current' : 'text-gray-300'}`} 
            />
        ))}
        </div>
    </div>
    </div>
    <p className="text-gray-600 text-sm mb-3">{description}</p>
    <div className="flex justify-between items-center text-sm">
    <span className="text-gray-500">Coverage: <span className="font-medium text-gray-700">{coverage}</span></span>
    <ExternalLink className="w-4 h-4 text-red-500" />
    </div>
</div>
);

const ChatDemo = () => {
const [messages, setMessages] = useState([
    {
    type: 'user',
    content: 'What are the current education policy challenges in India?'
    },
    {
    type: 'bot',
    content: 'Based on recent data analysis, India faces several key education policy challenges:',
    details: [
        '• Learning poverty affects 55% of children (World Bank, 2022)',
        '• Digital divide impacts 40% of students in rural areas (UNICEF, 2023)',
        '• Teacher shortage of 1.2 million positions (Ministry of Education, 2023)'
    ],
    sources: [
        'World Bank Education Statistics 2022',
        'UNICEF Digital Learning Report 2023',
        'Ministry of Education Annual Report 2023'
    ]
    }
]);

return (
    <div className="bg-gray-50 rounded-xl p-6 max-w-2xl">
    <div className="space-y-4 mb-4 max-h-80 overflow-y-auto">
        {messages.map((message, index) => (
        <div key={index} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-xs lg:max-w-md px-4 py-3 rounded-lg ${
            message.type === 'user' 
                ? 'bg-red-500 text-white' 
                : 'bg-white text-gray-800 shadow-md'
            }`}>
            <p className="text-sm">{message.content}</p>
            {message.details && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                {message.details.map((detail, i) => (
                    <p key={i} className="text-xs text-gray-600 mb-1">{detail}</p>
                ))}
                </div>
            )}
            {message.sources && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                <p className="text-xs font-medium text-gray-700 mb-2">Sources:</p>
                {message.sources.map((source, i) => (
                    <div key={i} className="flex items-center text-xs text-red-600 mb-1">
                    <FileText className="w-3 h-3 mr-1" />
                    {source}
                    </div>
                ))}
                </div>
            )}
            </div>
        </div>
        ))}
    </div>
    <div className="flex items-center space-x-2">
        <input 
        type="text" 
        placeholder="Ask about policy recommendations..."
        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
        disabled
        />
        <button className="bg-red-500 text-white p-2 rounded-lg hover:bg-red-600 transition-colors">
        <ArrowRight className="w-5 h-5" />
        </button>
    </div>
    </div>
);
};

const StatCard = ({ number, label, description }) => (
<div className="text-center p-6 bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow duration-300">
    <div className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-red-600 to-red-700 mb-2">
    {number}
    </div>
    <div className="text-lg font-semibold text-gray-800 mb-2">{label}</div>
    <div className="text-sm text-gray-600">{description}</div>
</div>
);

function ProductPage() {
const features = [
    {
    icon: MessageSquare,
    title: "Intelligent Conversations",
    description: "Natural language processing that understands complex policy queries and provides contextual, actionable responses.",
    highlight: "99.2% accuracy in policy interpretation"
    },
    {
    icon: Database,
    title: "Comprehensive Data Integration",
    description: "Access to 500+ verified data sources including government databases, research institutions, and international organizations.",
    highlight: "Real-time data synchronization"
    },
    {
    icon: FileText,
    title: "Automatic Citations",
    description: "Every response includes proper citations and source references, ensuring transparency and credibility in policy recommendations.",
    highlight: "APA, MLA, and Chicago citation formats"
    },
    {
    icon: Shield,
    title: "Verified Information",
    description: "Multi-layer verification process ensures all data is accurate, up-to-date, and comes from authoritative sources.",
    highlight: "Triple verification protocol"
    },
    {
    icon: Search,
    title: "Advanced Analytics",
    description: "Deep analysis capabilities that identify patterns, trends, and correlations across multiple policy domains.",
    highlight: "Predictive policy modeling"
    },
    {
    icon: Clock,
    title: "Real-time Updates",
    description: "Continuous monitoring and updating of policy data to ensure recommendations reflect the latest developments.",
    highlight: "24/7 data monitoring"
    }
];

const dataSources = [
    {
    name: "Government of India Open Data",
    type: "Official Government",
    coverage: "National",
    reliability: 5,
    description: "Comprehensive datasets from various ministries and departments covering demographics, economics, and social indicators."
    },
    {
    name: "World Bank Open Data",
    type: "International Organization",
    coverage: "Global",
    reliability: 5,
    description: "Economic and development indicators, poverty statistics, and policy impact assessments from 190+ countries."
    },
    {
    name: "NITI Aayog Reports",
    type: "Policy Think Tank",
    coverage: "National",
    reliability: 5,
    description: "Strategic policy documents, development goals tracking, and evidence-based policy recommendations."
    },
    {
    name: "Census of India",
    type: "Demographic Survey",
    coverage: "National",
    reliability: 5,
    description: "Detailed population statistics, socio-economic data, and demographic trends across states and districts."
    },
    {
    name: "Reserve Bank of India",
    type: "Financial Institution",
    coverage: "National",
    reliability: 5,
    description: "Monetary policy data, financial inclusion statistics, and economic indicators for policy formulation."
    },
    {
    name: "UN Sustainable Development Goals",
    type: "International Framework",
    coverage: "Global",
    reliability: 5,
    description: "Progress tracking and best practices for achieving sustainable development goals across nations."
    }
];

return (
    <div className="min-h-screen pt-16 bg-gradient-to-br from-gray-50 via-red-50 to-white">
    <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
            <div className="flex items-center justify-center mb-6">
            <h1 className="text-5xl sm:text-6xl font-bold text-gray-900">
                Rashtram <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-600 to-red-700">AI</span>
            </h1>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-800 mb-6">
            Intelligent Policy Assistant
            </h2>
            <p className="text-xl text-gray-600 mb-8 max-w-4xl mx-auto leading-relaxed">
            Meet our advanced AI chatbot that transforms policy research and development. 
            Get instant access to verified data, comprehensive analysis, and evidence-based 
            recommendations with complete source citations.
            </p>
            <div className="flex flex-wrap justify-center gap-4 mb-12">
            <div className="bg-white px-6 py-3 rounded-full shadow-md flex items-center">
                <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                <span className="text-gray-700 font-medium">500+ Data Sources</span>
            </div>
            <div className="bg-white px-6 py-3 rounded-full shadow-md flex items-center">
                <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                <span className="text-gray-700 font-medium">Real-time Citations</span>
            </div>
            <div className="bg-white px-6 py-3 rounded-full shadow-md flex items-center">
                <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                <span className="text-gray-700 font-medium">99.2% Accuracy</span>
            </div>
            </div>
        </div>
        </div>
    </section>

    <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Product Features</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Discover the powerful capabilities that make Rashtram AI the most trusted 
            policy assistant for researchers, policymakers, and analysts.
            </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
            <FeatureCard key={index} {...feature} />
            ))}
        </div>
        </div>
    </section>


    <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-red-600 to-red-700">
        <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-white mb-4">Trusted by Policy Professionals</h2>
            <p className="text-xl text-red-100 max-w-3xl mx-auto">
            Our AI assistant is backed by comprehensive data and delivers reliable insights 
            that drive informed policy decisions.
            </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <StatCard 
            number="500+" 
            label="Data Sources" 
            description="Verified and authoritative"
            />
            <StatCard 
            number="99.2%" 
            label="Accuracy Rate" 
            description="In policy interpretation"
            />
            <StatCard 
            number="24/7" 
            label="Data Updates" 
            description="Real-time synchronization"
            />
            <StatCard 
            number="10K+" 
            label="Citations" 
            description="Generated daily"
            />
        </div>
        </div>
    </section>

    <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Trusted Data Sources</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Our AI draws from the most authoritative and comprehensive data sources 
            to ensure every recommendation is backed by credible evidence.
            </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {dataSources.map((source, index) => (
            <DataSourceCard key={index} {...source} />
            ))}
        </div>
        <div className="text-center mt-12">
            <p className="text-gray-600 mb-6">
            And 490+ more verified sources including academic institutions, 
            research organizations, and international bodies.
            </p>
            <button className="bg-gradient-to-r from-red-500 to-red-600 text-white px-8 py-3 rounded-lg font-semibold hover:from-red-600 hover:to-red-700 transition-all duration-300 flex items-center mx-auto">
            View All Sources
            <ExternalLink className="w-5 h-5 ml-2" />
            </button>
        </div>
        </div>
    </section>

    <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
            <h2 className="text-4xl font-bold text-gray-900 mb-6">Transparent & Verifiable</h2>
            <p className="text-lg text-gray-600 mb-6 leading-relaxed">
                Every response from Rashtram AI includes complete source citations, 
                allowing you to verify information and dive deeper into the data. 
                Our transparent approach builds trust and ensures accountability.
            </p>
            <div className="space-y-4">
                <div className="flex items-start">
                <Quote className="w-6 h-6 text-red-600 mr-3 mt-1 flex-shrink-0" />
                <div>
                    <h4 className="font-semibold text-gray-900">Automatic Citation Generation</h4>
                    <p className="text-gray-600">Every fact and figure is automatically linked to its original source</p>
                </div>
                </div>
                <div className="flex items-start">
                <Award className="w-6 h-6 text-red-600 mr-3 mt-1 flex-shrink-0" />
                <div>
                    <h4 className="font-semibold text-gray-900">Academic Standards</h4>
                    <p className="text-gray-600">Citations follow established academic and professional formats</p>
                </div>
                </div>
                <div className="flex items-start">
                <BarChart3 className="w-6 h-6 text-red-600 mr-3 mt-1 flex-shrink-0" />
                <div>
                    <h4 className="font-semibold text-gray-900">Data Lineage Tracking</h4>
                    <p className="text-gray-600">Complete traceability from raw data to final recommendations</p>
                </div>
                </div>
            </div>
            </div>
            <div className="bg-gray-50 rounded-2xl p-8">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Sample Citation Format</h3>
            <div className="bg-white rounded-lg p-4 border-l-4 border-red-500 mb-4">
                <p className="text-sm text-gray-700 mb-2">
                <strong>Policy Recommendation:</strong> Increase education budget allocation by 15%
                </p>
                <div className="text-xs text-gray-600 space-y-1">
                <p><strong>Source 1:</strong> Ministry of Education. (2023). Annual Report on Education Statistics. Government of India.</p>
                <p><strong>Source 2:</strong> World Bank. (2023). Education Expenditure Analysis: India. World Bank Open Data.</p>
                <p><strong>Source 3:</strong> NITI Aayog. (2023). Education Policy Impact Assessment. Policy Research Division.</p>
                </div>
            </div>
            <div className="flex items-center text-sm text-red-600">
                <ExternalLink className="w-4 h-4 mr-2" />
                <span>All sources are clickable and lead to original documents</span>
            </div>
            </div>
        </div>
        </div>
    </section>

    <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-red-600 to-red-700">
        <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-4xl font-bold text-white mb-6">Ready to Transform Your Policy Research?</h2>
        <p className="text-xl text-red-100 mb-8 max-w-2xl mx-auto">
            Experience the power of AI-driven policy analysis with complete transparency, 
            verified data, and comprehensive citations.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup" className="bg-white text-red-600 px-8 py-4 rounded-lg font-semibold hover:bg-gray-100 transition-colors duration-300 flex items-center justify-center">
            Start Free Trial
            <ArrowRight className="w-5 h-5 ml-2" />
            </Link>
            <Link href="/contact" className="border-2 border-white text-white px-8 py-4 rounded-lg font-semibold hover:bg-white hover:text-red-600 transition-colors duration-300 flex items-center justify-center">
            Schedule Demo
            <Users className="w-5 h-5 ml-2" />
            </Link>
        </div>
        </div>
    </section>
    </div>
);
}

export default ProductPage;