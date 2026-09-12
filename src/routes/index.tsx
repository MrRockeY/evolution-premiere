import { createFileRoute } from "@tanstack/react-router";
import { motion, useReducedMotion } from "motion/react";
import { ArrowDownRight, ArrowRight, Dumbbell, MapPin, Menu, MessageCircle, Phone, X } from "lucide-react";
import { useState, type FormEvent } from "react";

import equipmentDetail from "@/assets/equipment-detail.jpg";
import heroImage from "@/assets/evolution-hero.jpg";
import trainingVideo from "@/assets/evolution-training.mp4.asset.json";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const PHONE = "918507214841";
const whatsappUrl = (message: string) => `https://wa.me/${PHONE}?text=${encodeURIComponent(message)}`;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Evolution Fitness Gym Patna City | Memberships" },
      { name: "description", content: "Train at Evolution Fitness Gym Unisex Advance in Jauganj, Patna City. Strength machines, free weights, cardio and coaching. Memberships from ₹800." },
      { property: "og:title", content: "Evolution Fitness Gym — Evolve Your Limits" },
      { property: "og:description", content: "Serious training, powerful machines and personal transformation in Patna City." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/" }],
    scripts: [{
      type: "application/ld+json",
      children: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "HealthClub",
        name: "Evolution Fitness Gym Unisex Advance",
        telephone: "+91 85072 14841",
        address: { "@type": "PostalAddress", streetAddress: "Jauganj, Kanghan Ghat", addressLocality: "Patna City", addressRegion: "Bihar", addressCountry: "IN" },
        priceRange: "₹800–₹7,500",
        url: "/",
      }),
    }],
  }),
  component: Index,
});

function Index() {
  const [menuOpen, setMenuOpen] = useState(false);
  const reduceMotion = useReducedMotion();

  const submitEnquiry = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") ?? "");
    const plan = String(data.get("plan") ?? "");
    const message = `Hi Evolution Fitness, I'm ${name}. I'd like to enquire about the ${plan} membership.`;
    window.open(whatsappUrl(message), "_blank", "noopener,noreferrer");
  };

  return (
    <main className="bg-background text-foreground">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-border/60 bg-background/75 backdrop-blur-xl">
        <div className="mx-auto flex h-18 max-w-[1500px] items-center justify-between px-5 lg:px-10">
          <a href="#top" className="flex items-center gap-3" aria-label="Evolution Fitness home">
            <span className="flex size-9 items-center justify-center border border-primary text-primary"><Dumbbell className="size-5" /></span>
            <span className="font-display text-xl font-black uppercase leading-none">Evolution <span className="text-primary">Fitness</span></span>
          </a>
          <nav className="hidden items-center gap-8 text-[11px] font-bold uppercase tracking-[0.18em] lg:flex" aria-label="Main navigation">
            {[["The Gym","gym"],["Training","training"],["Memberships","memberships"],["Visit","visit"]].map(([label,id]) => <a key={id} href={`#${id}`} className="transition-colors hover:text-primary">{label}</a>)}
          </nav>
          <div className="hidden lg:block"><Button asChild variant="copper" size="editorial"><a href="#enquire">Book free trial <ArrowRight /></a></Button></div>
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label={menuOpen ? "Close menu" : "Open menu"} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X /> : <Menu />}</Button>
        </div>
        {menuOpen && <nav className="border-t border-border bg-background px-5 py-6 lg:hidden" aria-label="Mobile navigation">{[["The Gym","gym"],["Training","training"],["Memberships","memberships"],["Visit","visit"]].map(([label,id]) => <a key={id} href={`#${id}`} onClick={() => setMenuOpen(false)} className="block border-b border-border py-4 font-display text-2xl font-bold uppercase">{label}</a>)}</nav>}
      </header>

      <section id="top" className="relative flex min-h-[92svh] items-end overflow-hidden pt-18">
        <video className="absolute inset-0 size-full object-cover" autoPlay muted loop playsInline poster={heroImage} aria-label="Illustrative cinematic strength training footage">
          <source src={trainingVideo.url} type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-[linear-gradient(90deg,var(--background)_0%,color-mix(in_oklab,var(--background)_78%,transparent)_42%,color-mix(in_oklab,var(--background)_22%,transparent)_76%),linear-gradient(0deg,var(--background)_0%,transparent_48%)]" />
        <motion.div initial={reduceMotion ? false : { opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .8 }} className="relative z-10 mx-auto w-full max-w-[1500px] px-5 pb-12 lg:px-10 lg:pb-18">
          <p className="mb-5 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.24em] text-primary"><span className="h-px w-10 bg-primary" /> Patna City / Unisex Advance</p>
          <h1 className="max-w-5xl font-display text-[clamp(4.7rem,13vw,11rem)] font-black uppercase leading-[0.73]">Evolve<br/><span className="metallic-text">Your Limits.</span></h1>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row"><Button asChild variant="copper" size="editorial"><a href="#enquire">Book a free trial <ArrowDownRight /></a></Button><Button asChild variant="copperOutline" size="editorial"><a href="#memberships">View memberships</a></Button></div>
        </motion.div>
        <div className="absolute bottom-0 right-0 z-10 hidden border-l border-t border-primary/30 bg-background/70 px-8 py-5 backdrop-blur lg:block"><p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Jauganj · Kanghan Ghat</p><p className="font-display text-xl font-bold uppercase">Built for serious training</p></div>
      </section>

      <section id="gym" className="section-rule mx-auto grid max-w-[1500px] gap-10 px-5 py-20 lg:grid-cols-12 lg:px-10 lg:py-30">
        <div className="lg:col-span-5"><SectionLabel number="01" text="The Gym" /><h2 className="mt-8 font-display text-6xl font-black uppercase leading-[0.85] sm:text-8xl">No noise.<br/><span className="text-primary">Just progress.</span></h2></div>
        <div className="lg:col-span-7 lg:pt-14"><p className="max-w-2xl text-xl leading-relaxed text-muted-foreground sm:text-2xl">A modern unisex training floor in Patna City, built around focused sessions, powerful equipment and the work it takes to transform.</p><p className="mt-6 max-w-xl text-sm leading-7 text-muted-foreground">The imagery on this website is illustrative. Ask the gym team for current floor photos and equipment availability before joining.</p></div>
      </section>

      <section id="training" className="bg-card py-20 lg:py-28">
        <div className="mx-auto max-w-[1500px] px-5 lg:px-10"><SectionLabel number="02" text="Training" />
          <div className="mt-10 grid gap-10 lg:grid-cols-[1.05fr_.95fr]">
            <div className="relative min-h-[430px] overflow-hidden"><motion.img whileInView={{ scale: reduceMotion ? 1 : [1.05, 1] }} transition={{ duration: reduceMotion ? 0 : 1.2 }} viewport={{ once: true }} src={equipmentDetail} loading="lazy" width={1200} height={912} alt="Illustrative premium strength equipment and free weights" className="absolute inset-0 size-full object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" /><p className="absolute bottom-5 left-5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Illustrative campaign image</p></div>
            <div className="divide-y divide-border border-y border-border">{[
              ["01","Advanced strength machines","Controlled movement. Serious resistance."],
              ["02","Free weights","Build strength with foundational lifts."],
              ["03","Cardio","Train endurance and conditioning."],
              ["04","Coaching","Get guidance for your training journey."],
            ].map(([n,title,copy]) => <motion.article initial={reduceMotion ? false : { opacity: 0, x: 24 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, amount: .4 }} key={n} className="grid grid-cols-[3rem_1fr] gap-3 py-7"><span className="font-display text-lg text-primary">{n}</span><div><h3 className="font-display text-3xl font-bold uppercase sm:text-4xl">{title}</h3><p className="mt-2 text-sm text-muted-foreground">{copy}</p></div></motion.article>)}</div>
          </div>
        </div>
      </section>

      <section id="memberships" className="mx-auto max-w-[1500px] px-5 py-20 lg:px-10 lg:py-30"><SectionLabel number="03" text="Memberships" /><div className="mt-8 flex flex-col justify-between gap-4 md:flex-row md:items-end"><h2 className="font-display text-6xl font-black uppercase leading-[.85] sm:text-8xl">Choose your<br/><span className="text-primary">commitment.</span></h2><p className="max-w-sm text-sm leading-6 text-muted-foreground">Simple plans for consistent training. Contact the gym to confirm current terms and inclusions.</p></div>
        <div className="mt-12 grid border border-border md:grid-cols-3">{[
          ["1 Month","₹800","Start now"], ["3 Months","₹4,000*","Build momentum"], ["1 Year","₹7,500","Go all in"]
        ].map(([term,price,line],i) => <article key={term} className={`group relative p-7 sm:p-9 ${i < 2 ? "border-b border-border md:border-b-0 md:border-r" : ""}`}><p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">{term}</p><p className="my-8 font-display text-6xl font-black sm:text-7xl">{price}</p><p className="text-sm text-muted-foreground">{line}</p><Button asChild variant={i === 2 ? "copper" : "copperOutline"} size="editorial" className="mt-10 w-full"><a href={whatsappUrl(`Hi Evolution Fitness, I'd like to join the ${term} membership.`)} target="_blank" rel="noreferrer">Join now <ArrowRight /></a></Button></article>)}</div>
        <p className="mt-4 text-xs text-muted-foreground">*3-month price shown as supplied; confirm current offer and conditions directly with the gym.</p>
      </section>

      <section className="overflow-hidden bg-primary text-primary-foreground"><div className="mx-auto grid max-w-[1500px] lg:grid-cols-2"><div className="p-8 lg:p-16"><p className="text-xs font-bold uppercase tracking-[0.2em]">Ladies training</p><h2 className="mt-6 font-display text-6xl font-black uppercase leading-[.85] sm:text-8xl">Your time.<br/>Your space.</h2></div><div className="flex flex-col justify-center border-t border-primary-foreground/20 p-8 lg:border-l lg:border-t-0 lg:p-16"><p className="font-display text-6xl font-black sm:text-8xl">11 AM—2 PM</p><p className="mt-4 max-w-md text-sm leading-6 opacity-75">Dedicated ladies training timing, subject to confirmation with the gym before your visit.</p><Button asChild variant="copperOutline" size="editorial" className="mt-8 w-fit border-primary-foreground/50 text-primary-foreground hover:bg-primary-foreground/10"><a href={whatsappUrl("Hi Evolution Fitness, please confirm the current ladies training timing.")} target="_blank" rel="noreferrer">Confirm on WhatsApp</a></Button></div></div></section>

      <section className="mx-auto max-w-[1500px] px-5 py-20 lg:px-10 lg:py-28"><SectionLabel number="04" text="Testimonials" /><div className="mt-10 border-y border-border py-16 text-center"><p className="font-display text-4xl font-bold uppercase text-muted-foreground sm:text-6xl">Real member stories coming soon.</p><p className="mx-auto mt-5 max-w-lg text-sm leading-6 text-muted-foreground">Approved Google reviews will appear here once supplied by the owner. No placeholder reviews have been published.</p></div></section>

      <section id="enquire" className="bg-card py-20 lg:py-28"><div className="mx-auto grid max-w-[1500px] gap-14 px-5 lg:grid-cols-2 lg:px-10"><div><SectionLabel number="05" text="Start now" /><h2 className="mt-8 font-display text-6xl font-black uppercase leading-[.85] sm:text-8xl">Book your<br/><span className="text-primary">free trial.</span></h2><p className="mt-6 max-w-md text-muted-foreground">Send your details directly to the Evolution Fitness team on WhatsApp.</p></div><form onSubmit={submitEnquiry} className="space-y-5 border-t border-primary/50 pt-8"><label className="block text-xs font-bold uppercase tracking-[.18em]">Your name<Input name="name" required placeholder="Enter your name" className="mt-3 h-13 rounded-none border-border bg-background px-4" /></label><label className="block text-xs font-bold uppercase tracking-[.18em]">Phone number<Input name="phone" type="tel" required placeholder="Your mobile number" className="mt-3 h-13 rounded-none border-border bg-background px-4" /></label><label className="block text-xs font-bold uppercase tracking-[.18em]">Membership<select name="plan" required defaultValue="Free trial" className="mt-3 h-13 w-full rounded-none border border-border bg-background px-4 text-sm"><option>Free trial</option><option>1 Month — ₹800</option><option>3 Months — ₹4,000*</option><option>1 Year — ₹7,500</option></select></label><Button type="submit" variant="copper" size="editorial" className="w-full">Continue on WhatsApp <MessageCircle /></Button></form></div></section>

      <section id="visit" className="grid lg:grid-cols-2"><div className="min-h-[420px]"><iframe title="Map to Evolution Fitness Gym in Jauganj, Patna City" src="https://www.google.com/maps?q=Jauganj%20Kanghan%20Ghat%20Patna%20City&output=embed" className="size-full min-h-[420px] border-0 grayscale-[.65] contrast-125" loading="lazy" referrerPolicy="no-referrer-when-downgrade" /></div><div className="flex flex-col justify-center bg-background p-8 lg:p-16"><SectionLabel number="06" text="Visit Evolution" /><h2 className="mt-8 font-display text-5xl font-black uppercase sm:text-7xl">Jauganj,<br/>Patna City.</h2><p className="mt-5 flex items-start gap-3 text-muted-foreground"><MapPin className="mt-1 size-4 shrink-0 text-primary" /> Jauganj, Patna City, Kanghan Ghat</p><p className="mt-3 flex items-center gap-3 text-muted-foreground"><Phone className="size-4 text-primary" /> <a href="tel:+918507214841" className="hover:text-primary">8507214841</a></p><div className="mt-8 flex flex-wrap gap-3"><Button asChild variant="copper" size="editorial"><a href={whatsappUrl("Hi Evolution Fitness, I'd like to plan a visit.")} target="_blank" rel="noreferrer"><MessageCircle /> WhatsApp</a></Button><Button asChild variant="copperOutline" size="editorial"><a href="https://www.google.com/maps/search/?api=1&query=Jauganj+Kanghan+Ghat+Patna+City" target="_blank" rel="noreferrer"><MapPin /> Directions</a></Button></div></div></section>

      <footer className="border-t border-border px-5 py-10 lg:px-10"><div className="mx-auto flex max-w-[1500px] flex-col gap-6 sm:flex-row sm:items-end sm:justify-between"><div><p className="font-display text-3xl font-black uppercase">Evolution <span className="text-primary">Fitness</span></p><p className="mt-2 text-xs uppercase tracking-[.16em] text-muted-foreground">Gym Unisex Advance · Patna City</p></div><p className="text-xs text-muted-foreground">© 2026 Evolution Fitness. All rights reserved.</p></div></footer>
    </main>
  );
}

function SectionLabel({ number, text }: { number: string; text: string }) {
  return <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-[0.2em] text-primary"><span>{number}</span><span className="h-px w-10 bg-primary/60"/><span>{text}</span></div>;
}
