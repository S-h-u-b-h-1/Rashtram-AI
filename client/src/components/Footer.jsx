"use client";

import {
  Blocks,
  CodeXml,
  CreditCard,
  Handshake,
  Scale,
  Webhook,
  Vault,
  Vote
} from "lucide-react";
import { Footer } from "./blocks/footer";

export default function FooterDemo() {
  return (
    <>
    <Footer
    
      brand={{
        name: "RashtramAI",
        description: "Rashtram AI - Advanced AI Solutions",
      }}
      socialLinks={[
        {
          name: "Twitter",
          href: "#",
        },
        {
          name: "Github",
          href: "#",
        },
        {
          name: "Discord",
          href: "#",
        },
      ]}
      columns={[
        {
          title: "Product",
          links: [
            {
              name: "Features",
              Icon: Blocks,
              href: "#features",
            },
            {
              name: "Pricing",
              Icon: CreditCard,
              href: "#pricing",
            },
            {
              name: "Integrations",
              Icon: Webhook,
              href: "#integrations",
            },
            {
              name: "API Documentation",
              Icon: CodeXml,
              href: "#",
            },
          ],
        },
        {
          title: "Links",
          links: [
            {
              name: "Solutions",
              Icon: Vote,
              href: "/soultions",
            },
            {
              name: "Resources",
              Icon: Vault,
              href: "/resources",
            },
            {
              name: "Pricing",
              Icon: CreditCard,
              href: "/pricing",
            },
          ],
        },
        {
          title: "Legal",
          links: [
            {
              name: "Privacy Policy",
              Icon: Scale,
              href: "/legal/privacy",
            },
            {
              name: "Terms of Service",
              Icon: Handshake,
              href: "/legal/terms",
            },
          ],
        },
      ]}
      copyright=" "
    />
    <h1 className="hidden md:block text-9xl font-bold text-center bg-gradient-to-b from-white via-[#0000002a] to-white bg-clip-text text-transparent md-hidden">RASHTRAM AI</h1>
    </>
  );
}
