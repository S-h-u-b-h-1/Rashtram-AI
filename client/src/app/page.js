"use client"

import Navbar from "@/components/Navbar";
import { HeroSection } from "@/components/blocks/hero-section"
import { Icons } from "@/components/ui/icons"

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
          href: "/docs/getting-started",
          variant: "default",
        },
        {
          text: "GitHub",
          href: "https://github.com/your-repo",
          variant: "glow",
          icon: <Icons.gitHub className="h-5 w-5" />,
        },
      ]}
      image={{
        light: "https://www.launchuicomponents.com/app-light.png",
        dark: "https://www.launchuicomponents.com/app-dark.png",
        alt: "UI Components Preview",
      }}
    />
  )
}

export default function Home() {
  return (
    <>
      <HeroSectionDemo />
    </>
  );
}
