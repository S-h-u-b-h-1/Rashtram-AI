import React from 'react';
import Link from 'next/link';
import { Brain, Users, GraduationCap, Heart, Leaf, Building, Shield, TrendingUp,CheckCircle,ArrowRight,Target,Lightbulb,Globe} from 'lucide-react';

const SolutionCard = ({ icon: Icon, title, description, impact }) => (
  <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border border-gray-100">
    <div className="flex items-center mb-4">
      <div className="bg-gradient-to-r from-red-500 to-red-600 p-3 rounded-lg">
        <Icon className="w-6 h-6 text-white" />
      </div>
      <h3 className="text-xl font-bold text-gray-800 ml-4">{title}</h3>
    </div>
    <p className="text-gray-600 mb-4 leading-relaxed">{description}</p>
    <div className="bg-gradient-to-r from-red-50 to-red-100 p-3 rounded-lg">
      <p className="text-sm font-semibold text-green-700 flex items-center">
        <TrendingUp className="w-4 h-4 mr-2" />
        {impact}
      </p>
    </div>
  </div>
);

const ImpactMetric = ({ number, label, description }) => (
  <div className="text-center p-6 bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow duration-300">
    <div className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-red-600 to-red-700 mb-2">
      {number}
    </div>
    <div className="text-lg font-semibold text-gray-800 mb-2">{label}</div>
    <div className="text-sm text-gray-600">{description}</div>
  </div>
);

const ProcessStep = ({ step, title, description, isLast }) => (
  <div className="flex items-start">
    <div className="flex flex-col items-center mr-6">
      <div className="bg-gradient-to-r from-red-500 to-red-600 text-white rounded-full w-10 h-10 flex items-center justify-center font-bold text-lg">
        {step}
      </div>
      {!isLast && <div className="w-0.5 h-16 bg-gradient-to-b from-red-500 to-red-600 mt-4"></div>}
    </div>
    <div className="flex-1 pb-8">
      <h4 className="text-xl font-bold text-gray-800 mb-2">{title}</h4>
      <p className="text-gray-600 leading-relaxed">{description}</p>
    </div>
  </div>
);

function Solutionpage() {
  const solutions = [
    {
      icon: GraduationCap,
      title: "Education Policy",
      description: "AI-driven analysis of educational gaps and evidence-based policy recommendations for improving learning outcomes and accessibility.",
      impact: "Potential to improve literacy rates by 25% through targeted interventions"
    },
    {
      icon: Heart,
      title: "Healthcare Reform",
      description: "Comprehensive healthcare policy frameworks addressing public health challenges, resource allocation, and preventive care strategies.",
      impact: "Estimated 40% reduction in healthcare disparities through optimized resource distribution"
    },
    {
      icon: Leaf,
      title: "Environmental Policy",
      description: "Data-driven environmental protection policies focusing on climate change mitigation, sustainable development, and green infrastructure.",
      impact: "Projected 30% reduction in carbon emissions through smart policy implementation"
    },
    {
      icon: Building,
      title: "Urban Development",
      description: "Smart city planning policies that balance economic growth with quality of life, addressing housing, transportation, and infrastructure needs.",
      impact: "Enhanced urban livability index by 50% through integrated planning approaches"
    },
    {
      icon: Shield,
      title: "Social Security",
      description: "Comprehensive social protection frameworks ensuring economic security, elderly care, and support for vulnerable populations.",
      impact: "Expanded social safety net coverage to reach 95% of eligible beneficiaries"
    },
    {
      icon: Users,
      title: "Employment & Labor",
      description: "Future-ready employment policies addressing skill development, job creation, and workforce adaptation to technological changes.",
      impact: "Projected creation of 2M+ jobs through strategic skill development programs"
    }
  ];

  const processSteps = [
    {
      title: "Data Collection & Analysis",
      description: "Gathering comprehensive data from multiple sources including demographic studies, economic indicators, and social metrics to understand the current landscape."
    },
    {
      title: "AI-Powered Policy Generation",
      description: "Utilizing advanced machine learning algorithms to analyze patterns, predict outcomes, and generate evidence-based policy recommendations."
    },
    {
      title: "Impact Assessment",
      description: "Simulating policy outcomes using predictive models to assess potential social, economic, and environmental impacts before implementation."
    },
    {
      title: "Stakeholder Integration",
      description: "Incorporating feedback from citizens, experts, and institutions to refine and validate policy recommendations for maximum effectiveness."
    }
  ];

  return (
    <div className="min-h-screen pt-16 bg-gradient-to-br from-gray-50 via-red-50 to-white">
      <section className="py-20 px-4 sm:px-6 lg:px-8 pd-100">
        <div className="max-w-6xl mx-auto text-center">
          <div className="flex items-center justify-center mb-6">
            <h1 className="text-5xl sm:text-6xl font-bold text-gray-900">
              Rashtram <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-600 to-red-700">AI</span>
            </h1>
          </div>
          <p className="text-xl sm:text-2xl text-gray-600 mb-8 max-w-4xl mx-auto leading-relaxed">
            Revolutionizing public policy through artificial intelligence, creating evidence-based solutions 
            that address society's most pressing challenges and improve lives at scale.
          </p>
          <div className="flex flex-wrap justify-center gap-4 mb-12">
            <div className="bg-white px-6 py-3 rounded-full shadow-md flex items-center">
              <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
              <span className="text-gray-700 font-medium">Evidence-Based</span>
            </div>
            <div className="bg-white px-6 py-3 rounded-full shadow-md flex items-center">
              <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
              <span className="text-gray-700 font-medium">Data-Driven</span>
            </div>
            <div className="bg-white px-6 py-3 rounded-full shadow-md flex items-center">
              <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
              <span className="text-gray-700 font-medium">Socially Impactful</span>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Our Policy Solutions</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Comprehensive AI-generated policy frameworks addressing critical societal challenges 
              with measurable impact and sustainable outcomes.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {solutions.map((solution, index) => (
              <SolutionCard key={index} {...solution} />
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-red-600 to-red-700">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-white mb-4">Projected Societal Impact</h2>
            <p className="text-xl text-red-100 max-w-3xl mx-auto">
              Our AI-generated policies are designed to create measurable, positive change across key social indicators.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <ImpactMetric 
              number="50M+" 
              label="Lives Impacted" 
              description="Through improved policy implementation"
            />
            <ImpactMetric 
              number="35%" 
              label="Efficiency Gain" 
              description="In public service delivery"
            />
            <ImpactMetric 
              number="₹2.5T" 
              label="Economic Value" 
              description="Generated through optimized policies"
            />
            <ImpactMetric 
              number="200+" 
              label="Policy Areas" 
              description="Covered across various sectors"
            />
          </div>
        </div>
      </section>

      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">How Rashtram AI Works</h2>
            <p className="text-xl text-gray-600">
              Our sophisticated process combines cutting-edge AI technology with deep policy expertise 
              to generate actionable, evidence-based recommendations.
            </p>
          </div>
          <div className="space-y-0">
            {processSteps.map((step, index) => (
              <ProcessStep 
                key={index}
                step={index + 1}
                title={step.title}
                description={step.description}
                isLast={index === processSteps.length - 1}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl font-bold text-gray-900 mb-6">Transforming Governance for Tomorrow</h2>
              <p className="text-lg text-gray-600 mb-6 leading-relaxed">
                Rashtram AI represents a paradigm shift in how we approach public policy. By leveraging 
                artificial intelligence, we're making governance more responsive, efficient, and effective 
                in addressing the complex challenges of modern society.
              </p>
              <div className="space-y-4">
                <div className="flex items-start">
                  <Target className="w-6 h-6 text-red-600 mr-3 mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-gray-900">Precision Policy Making</h4>
                    <p className="text-gray-600">Targeted interventions based on comprehensive data analysis</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <Lightbulb className="w-6 h-6 text-red-600 mr-3 mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-gray-900">Innovation-Driven Solutions</h4>
                    <p className="text-gray-600">Creative approaches to traditional governance challenges</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <Globe className="w-6 h-6 text-red-600 mr-3 mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-gray-900">Scalable Impact</h4>
                    <p className="text-gray-600">Solutions designed to benefit millions across diverse communities</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-2xl p-8 text-white">
                <h3 className="text-2xl font-bold mb-4">Ready to Transform Policy Making?</h3>
                <p className="text-red-100 mb-6">
                  Join us in revolutionizing how societies address their most critical challenges through 
                  intelligent, data-driven policy solutions.
                </p>
                <Link href="/signup" className="bg-white text-red-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors duration-300 flex items-center">
                  Explore Solutions
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Solutionpage;