import React from "react";
import { Timeline } from "@/components/ui/timeline";
import { Card } from "@/components/ui/card";
import { Info, Search, BarChart2, Cpu, Shield, Users, Code2, BookOpen, Globe } from "lucide-react";

// Card data for each timeline step
const timelineCards = [
  // Step 1: Challenges in Policymaking
  [
    {
      icon: <Info size={28} className="mb-2" />,
      title: "Information Overload",
      description:
        "The sheer volume of data and information available can be overwhelming, making it difficult to identify relevant insights.",
    },
    {
      icon: <Search size={28} className="mb-2" />,
      title: "Complexity and Uncertainty",
      description:
        "Policy issues are often multifaceted and interconnected, making it hard to predict outcomes and unintended consequences.",
    },
    {
      icon: <BarChart2 size={28} className="mb-2" />,
      title: "Need for Evidence-Based Decisions",
      description:
        "Decisions need to be grounded in solid evidence and rigorous analysis, but obtaining this can be time-consuming and resource-intensive.",
      fullWidth: true,
    },
  ],
  // Step 2: Rashtram AI: Augmenting Policymaking with Intelligence
  [
    {
      icon: <Cpu size={28} className="mb-2" />,
      title: "Intelligent Information Processing",
      description:
        "AI-powered tools to sift through vast amounts of information, extract key insights, and identify emerging trends.",
    },
    {
      icon: <Shield size={28} className="mb-2" />,
      title: "Risk and Impact Assessment",
      description:
        "Models to simulate policy scenarios, assess potential risks and impacts, and identify unintended consequences.",
    },
    {
      icon: <Users size={28} className="mb-2" />,
      title: "Collaborative Decision Support",
      description:
        "A platform for stakeholders to collaborate, share information, and collectively evaluate policy options.",
      fullWidth: true,
    },
  ],
  // Step 3: Embedded with Indian Values and First Principles
  [
    {
      icon: <Code2 size={28} className="mb-2" />, // Lucide 'Code2' for Constitutional Values
      title: "Constitutional Values",
      description:
        "Ensuring fairness, equality, and justice in all policy recommendations.",
    },
    {
      icon: <BookOpen size={28} className="mb-2" />, // Lucide 'BookOpen' for Dharma
      title: "Dharma",
      description:
        "Promoting ethical conduct, responsibility, and the well-being of all citizens.",
    },
    {
      icon: <Globe size={28} className="mb-2" />, // Lucide 'Globe' for First Principles
      title: "First Principles",
      description:
        "Applying fundamental truths and logical reasoning to policy analysis and decision-making.",
      fullWidth: true,
    },
  ],
];

export function DotsCardDemo({ icon, title, description, fullWidth = false }) {
  return (
    <Card variant="dots" className={fullWidth ? "bg-background w-full" : "max-w-[400px] bg-background"}>
      <div className="flex flex-col items-start">
        {icon}
        <div className="font-bold text-lg mb-1">{title}</div>
        <div className="text-sm text-muted-foreground">{description}</div>
      </div>
    </Card>
  );
}

export function TimelineDemo() {
  const data = [
    {
      title: "Challenges in Policymaking",
      content: (
        <div className="grid grid-cols-2 gap-4">
          <DotsCardDemo {...timelineCards[0][0]} />
          <DotsCardDemo {...timelineCards[0][1]} />
          <div className="col-span-2">
            <DotsCardDemo {...timelineCards[0][2]} />
          </div>
        </div>
      ),
    },
    {
      title: "Rashtram AI: Augmenting Policymaking with Intelligence",
      content: (
        <div className="grid grid-cols-2 gap-4">
          <DotsCardDemo {...timelineCards[1][0]} />
          <DotsCardDemo {...timelineCards[1][1]} />
          <div className="col-span-2">
            <DotsCardDemo {...timelineCards[1][2]} />
          </div>
        </div>
      ),
    },
    {
      title: "Embedded with Indian Values and First Principles",
      content: (
        <div className="grid grid-cols-2 gap-4">
          <DotsCardDemo {...timelineCards[2][0]} />
          <DotsCardDemo {...timelineCards[2][1]} />
          <div className="col-span-2">
            <DotsCardDemo {...timelineCards[2][2]} />
          </div>
        </div>
      ),
    },
  ];
  return (
    <div className="min-h-screen w-full">
      <Timeline data={data} />
    </div>
  );
} 