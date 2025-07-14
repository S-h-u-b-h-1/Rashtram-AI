"use client"

import { HeroSection } from "@/components/blocks/hero-section"
import { TimelineDemo } from "@/components/TimelineDemo";
import { Cta4 } from "@/components/ui/cta-4";
export function HeroSectionDemo() {
  return (
    <HeroSection
      badge={{
        text: "Introducing Rashtram AI",
        action: {
          text: "Learn more",
          href: "/login",
        },
      }}
      title="Your Personal Think Tank for Public Policy"
      description="Rashtram AI is a platform that helps you create and manage your public policy. It is a platform that helps you create and manage your public policy."
      actions={[
        {
          text: "Get Started",
          href: "/signup",
          variant: "default",
        }
      ]}
      image={{
        light: "https://www.launchuicomponents.com/app-light.png",
        dark: "https://www.launchuicomponents.com/app-dark.png",
        alt: "UI Components Preview",
      }}
    />
  )
}
export function GetStarted(){
  return (
    <Cta4
      title="Ready to Transform Policymaking?"
      description="Join the growing community of policymakers leveraging Rashtram AI to create a better future."
      buttonText="Get Started"
      buttonUrl="/signup"
      items={[
        "Accurate Policy Analysis",
        "Real-time Data Insights",
        "Customizable Policy Frameworks",
        "Scalable Decision Making",
        "Comprehensive Compliance Monitoring"
      ]}
    />
  )
}

export default function Home() {
  return (
    <>
      <HeroSectionDemo />
      <TimelineDemo />
      <GetStarted  className = 'w-full'/>
    </>
  );
}
