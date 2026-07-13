import Link from "next/link";

const proposedTiers = [
  {
    name: "Academic pilot",
    audience: "Students, faculty, and research programmes",
    features: ["Catalogue search", "Grounded document research", "Policy comparison", "Saved research workspace"],
  },
  {
    name: "Professional pilot",
    audience: "Policy researchers, legal and compliance professionals",
    features: ["Higher research limits", "Research exports", "Watchlist validation", "Structured feedback and onboarding"],
  },
  {
    name: "Institutional pilot",
    audience: "Universities, think tanks, and professional teams",
    features: ["Pilot workspace", "Curated document collections", "Usage evaluation", "Implementation support"],
  },
];

export default function PricingPage() {
  return (
    <main className="bg-white px-4 py-28 text-[#29312d] md:py-40">
      <section className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#874047]">Pilot access</p>
          <h1 className="mt-4 font-serif text-4xl text-[#8f1d2c] sm:text-5xl">Commercial pricing is not yet launched.</h1>
          <p className="mt-5 text-base leading-7 text-[#706a61]">
            Rashtram AI is currently validating research quality and institutional use cases. The tiers below describe proposed pilot segments, not purchasable plans or final prices.
          </p>
        </div>
        <div className="mt-14 grid gap-5 lg:grid-cols-3">
          {proposedTiers.map((tier) => (
            <article key={tier.name} className="rounded-2xl border border-[#8f1d2c]/10 bg-[#f7f2eb] p-7">
              <h2 className="font-serif text-2xl text-[#8f1d2c]">{tier.name}</h2>
              <p className="mt-2 text-sm leading-6 text-[#706a61]">{tier.audience}</p>
              <ul className="mt-6 space-y-3 text-sm text-[#514d46]">
                {tier.features.map((feature) => <li key={feature}>• {feature}</li>)}
              </ul>
              <p className="mt-7 text-xs font-semibold uppercase tracking-[0.12em] text-[#874047]">Pricing to be validated during pilots</p>
            </article>
          ))}
        </div>
        <div className="mt-10 text-center">
          <Link href="/contact" className="inline-flex rounded-xl bg-[#8f1d2c] px-6 py-3 text-sm font-semibold text-white hover:bg-[#68131f]">Discuss a pilot</Link>
        </div>
      </section>
    </main>
  );
}
