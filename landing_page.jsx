"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

const translations = {
  en: {
    hero_title: "Ælberd Atuev",
    hero_subtitle: "Trilingual Entrepreneur · Creative Technologist · Futurist Systems Architect · France, Essonne (91)",
    badge1: "E-commerce & Operations",
    badge2: "Web & Product",
    badge3: "Creative Tech",
    about_title: "About",
    about_text: "Entrepreneur working at the intersection of technology, design, marketing and operations. I build complete ecosystems: brand, product, infrastructure and user experience. Aesthetics, structure and efficiency are equally important to me.",
    do_title: "What I Do",
    do1_title: "E-commerce & Operations",
    do1_text: "Order flows, fulfillment logic, storage architecture, inventory systems and scalable processes.",
    do2_title: "Web & Product",
    do2_text: "Front-end development, UX/UI architecture, interface systems and digital product design.",
    do3_title: "Marketing & Growth",
    do3_text: "Brand positioning, visual storytelling, conversion-driven user journeys.",
    do4_title: "Creative Technology",
    do4_text: "AI experiments, automation, multi-agent systems, fusion of tech, art and culture.",
    identity_title: "Identity",
    identity_text: "Trilingual native speaker (French, Russian, Chechen). Entrepreneurial mindset. Martial arts. Futurism. Systems thinking. Avant-garde aesthetics.",
    culture_title: "Cultural Footprint",
    footer: "Ælberd Atuev · Essonne (91) · Trilingual · Futurist Systems Builder",
    rightCard_title: "ARCHIVE / SIGNAL",
    rightCard_text: "Luxury-tech minimalism. Industrial silence. Avant-garde structure. High contrast. No noise — only intention.",
  },
  ru: {
    hero_title: "Ælberd Atuev",
    hero_subtitle: "Трилингв · Предприниматель · Creative Technologist · Футурист-архитектор систем · France, Essonne (91)",
    badge1: "E-commerce & операции",
    badge2: "Веб & продукт",
    badge3: "Creative Tech",
    about_title: "Обо мне",
    about_text: "Предприниматель на стыке технологий, дизайна, маркетинга и операционных процессов. Создаю целые экосистемы: бренд, продукт, инфраструктура, пользовательский опыт. Эстетика, структура и эффективность для меня равнозначны.",
    do_title: "Чем занимаюсь",
    do1_title: "E-commerce и операции",
    do1_text: "Логика заказов, фулфилмент, архитектура хранения, системы остатков и масштабируемые процессы.",
    do2_title: "Веб и продукт",
    do2_text: "Front-end разработка, UX/UI архитектура, интерфейсные системы, цифровой продукт.",
    do3_title: "Маркетинг и рост",
    do3_text: "Позиционирование бренда, визуальный сторителлинг, конверсионные сценарии.",
    do4_title: "Creative Technology",
    do4_text: "AI, автоматизация, агентные системы, синтез технологий, искусства и культуры.",
    identity_title: "Идентичность",
    identity_text: "Трилингв (французский, русский, чеченский — носители). Предпринимательское мышление. Martial arts. Футуризм. Системное мышление. Авангардная эстетика.",
    culture_title: "Культурный след",
    footer: "Ælberd Atuev · Essonne (91) · Трилингв · Футурист систем",
    rightCard_title: "АРХИВ / СИГНАЛ",
    rightCard_text: "Luxury-tech минимализм. Индустриальная тишина. Авангардная структура. Высокий контраст. Без лишнего — только намерение.",
  },
  fr: {
    hero_title: "Ælberd Atuev",
    hero_subtitle: "Entrepreneur trilingue · Creative Technologist · Architecte futuriste des systèmes · France, Essonne (91)",
    badge1: "E-commerce & opérations",
    badge2: "Web & produit",
    badge3: "Creative Tech",
    about_title: "À propos",
    about_text: "Entrepreneur à l’intersection de la technologie, du design, du marketing et des opérations. Je construis des écosystèmes complets : marque, produit, infrastructure, expérience utilisateur. L’esthétique, la structure et l’efficacité sont stratégiques.",
    do_title: "Ce que je fais",
    do1_title: "E-commerce & opérations",
    do1_text: "Flux de commandes, logique de fulfillment, architecture des stocks, process scalables.",
    do2_title: "Web & produit",
    do2_text: "Développement front-end, UX/UI, systèmes d’interface, produit digital.",
    do3_title: "Marketing & croissance",
    do3_text: "Positionnement, storytelling visuel, parcours utilisateurs orientés conversion.",
    do4_title: "Creative Technology",
    do4_text: "IA, automatisation, systèmes agents, fusion tech, art et culture.",
    identity_title: "Identité",
    identity_text: "Trilingue natif (français, russe, tchétchène). Esprit entrepreneurial. Arts martiaux. Futurisme. Pensée systémique. Esthétique avant-gardiste.",
    culture_title: "Empreinte culturelle",
    footer: "Ælberd Atuev · Essonne (91) · Trilingue · Futurist Systems Builder",
    rightCard_title: "ARCHIVE / SIGNAL",
    rightCard_text: "Minimalisme luxury-tech. Silence industriel. Structure avant-gardiste. Contraste élevé. Rien d’inutile — seulement l’intention.",
  },
};

const LANGS = ["en", "ru", "fr"];

function selfTest() {
  const requiredKeys = [
    "hero_title",
    "hero_subtitle",
    "badge1",
    "badge2",
    "badge3",
    "about_title",
    "about_text",
    "do_title",
    "do1_title",
    "do1_text",
    "do2_title",
    "do2_text",
    "do3_title",
    "do3_text",
    "do4_title",
    "do4_text",
    "identity_title",
    "identity_text",
    "culture_title",
    "footer",
    "rightCard_title",
    "rightCard_text",
  ];

  LANGS.forEach((lang) => {
    const t = translations[lang];
    if (!t) throw new Error(`Missing translations for ${lang}`);
    requiredKeys.forEach((k) => {
      if (!t[k] || typeof t[k] !== "string") throw new Error(`Missing key ${k} in ${lang}`);
    });
  });
}

function useReducedMotionPref() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

function CursorFX() {
  const reduced = useReducedMotionPref();
  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const sx = useSpring(x, { stiffness: 700, damping: 45 });
  const sy = useSpring(y, { stiffness: 700, damping: 45 });

  useEffect(() => {
    if (reduced) return;
    const onMove = (e) => {
      x.set(e.clientX);
      y.set(e.clientY);
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [reduced, x, y]);

  if (reduced) return null;

  return (
    <>
      <motion.div
        style={{ translateX: sx, translateY: sy }}
        className="pointer-events-none fixed left-0 top-0 z-[9999] h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/25 bg-white/5 backdrop-blur mix-blend-difference"
      />
      <motion.div
        style={{ translateX: sx, translateY: sy }}
        className="pointer-events-none fixed left-0 top-0 z-[9998] h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-fuchsia-400/10 to-cyan-300/10 blur-2xl"
      />
    </>
  );
}

export default function LandingPage() {
  const [lang, setLang] = useState("en");
  const t = useMemo(() => translations[lang], [lang]);

  useEffect(() => {
    if (process.env.NODE_ENV === "test") selfTest();
  }, []);

  if (!t) return null;

  return (
    <main className="min-h-screen bg-[#05070c] text-[#e5e7eb] overflow-x-hidden">
      <CursorFX />

      <div className="fixed top-6 right-6 flex gap-2 z-50">
        {LANGS.map((l) => (
          <button
            key={l}
            onClick={() => setLang(l)}
            className="px-3 py-1 text-xs rounded-lg border border-white/20 bg-white/10 backdrop-blur hover:border-fuchsia-400 hover:text-fuchsia-300 transition"
          >
            {l.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="max-w-6xl mx-auto px-6 pt-28 pb-40 space-y-28">
        <section className="space-y-6">
          <h1 className="text-[clamp(56px,9vw,128px)] font-extrabold leading-[0.88] tracking-[-0.06em] glitch" data-text={t.hero_title}>
            {t.hero_title}
          </h1>
          <p className="max-w-2xl text-gray-400 text-lg tracking-wide">{t.hero_subtitle}</p>
          <div className="flex flex-wrap gap-3">
            {[t.badge1, t.badge2, t.badge3].map((b) => (
              <span key={b} className="px-5 py-2 rounded-full border border-white/20 bg-white/5 backdrop-blur text-xs uppercase tracking-[0.32em]">
                {b}
              </span>
            ))}
          </div>
        </section>

        <section className="p-10 rounded-[32px] border border-white/20 bg-white/5 backdrop-blur-xl">
          <h2 className="text-3xl font-bold mb-6 tracking-tight">{t.about_title}</h2>
          <p className="text-gray-300/90 leading-relaxed max-w-3xl text-lg">{t.about_text}</p>
        </section>

        <section className="space-y-10">
          <h2 className="text-3xl font-bold tracking-tight">{t.do_title}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="p-8 rounded-[32px] border border-white/20 bg-white/5 backdrop-blur-xl">
                <h3 className="font-semibold mt-3 mb-3 text-xl tracking-wide">{t[`do${i}_title`]}</h3>
                <p className="text-gray-300/80 text-sm leading-relaxed">{t[`do${i}_text`]}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="p-10 rounded-[32px] border border-white/20 bg-gradient-to-br from-white/10 to-white/0 backdrop-blur-xl">
          <h2 className="text-3xl font-bold mb-6 tracking-tight">{t.identity_title}</h2>
          <p className="text-gray-200/90 leading-relaxed max-w-3xl text-lg">{t.identity_text}</p>
        </section>

        <section className="space-y-8">
          <h2 className="text-3xl font-bold tracking-tight">{t.culture_title}</h2>
          <div className="flex flex-wrap gap-6">
            <a href="https://letterboxd.com/albert91/" target="_blank" rel="noreferrer" className="px-8 py-4 rounded-2xl border border-white/20 bg-white/5 backdrop-blur">Letterboxd</a>
            <a href="https://stats.fm/kamelot.exe" target="_blank" rel="noreferrer" className="px-8 py-4 rounded-2xl border border-white/20 bg-white/5 backdrop-blur">stats.fm</a>
            <a href="https://musicboard.app/kamelot.exe" target="_blank" rel="noreferrer" className="px-8 py-4 rounded-2xl border border-white/20 bg-white/5 backdrop-blur">Musicboard</a>
          </div>
        </section>
      </div>

      <footer className="text-center text-gray-500 text-xs tracking-[0.45em] py-16 uppercase">{t.footer}</footer>

      <style jsx global>{`
        html { cursor: none; }
        a, button { cursor: none; }
        .glitch { position: relative; }
        .glitch::before, .glitch::after { content: attr(data-text); position: absolute; left: 0; top: 0; width: 100%; overflow: hidden; pointer-events: none; opacity: 0.9; }
        .glitch::before { animation: glitchTop 2s infinite linear alternate-reverse; color: #a855f7; }
        .glitch::after { animation: glitchBottom 1.5s infinite linear alternate-reverse; color: #00e5ff; }
        @keyframes glitchTop { 0% { clip-path: inset(0 0 80% 0); } 100% { clip-path: inset(0 0 20% 0); } }
        @keyframes glitchBottom { 0% { clip-path: inset(80% 0 0 0); } 100% { clip-path: inset(20% 0 0 0); } }
      `}</style>
    </main>
  );
}
