export interface TrendFormat {
  id: string;
  title: string;
  hook: string;
  structure: string[];
  timingSeconds: number;
  tags: string[];
}

// Platzhalter-Startset generischer Kurzvideo-Hook-Formate. Bitte durch die
// eigentliche Trend-Recherche ersetzen/ergänzen — diese Liste ist bewusst
// als einfache, editierbare Datei gehalten (keine DB, kein Admin-UI).
export const TREND_FORMATS: TrendFormat[] = [
  {
    id: "pov-hook",
    title: "POV-Hook",
    hook: "POV: du hast gerade [Situation] erlebt.",
    structure: [
      "Text-Overlay 'POV: ...' über erste Szene",
      "Reaktion / Ausgangslage zeigen",
      "Wendepunkt mit Produkt/Clip",
      "Payoff-Shot + Caption",
    ],
    timingSeconds: 15,
    tags: ["relatable", "streetwear", "schnell"],
  },
  {
    id: "problem-agitate-solution",
    title: "Problem–Agitate–Solution",
    hook: "Das nervt dich bestimmt auch: [Problem].",
    structure: [
      "Problem direkt benennen",
      "Problem verstärken (Alltagsszene)",
      "Lösung / Produkt einführen",
      "Ergebnis zeigen",
    ],
    timingSeconds: 25,
    tags: ["conversion", "produktfokus"],
  },
  {
    id: "ranking-countdown",
    title: "Countdown/Ranking",
    hook: "3 Dinge, die du beim [Thema] falsch machst.",
    structure: [
      "Hook mit Zahl im Text-Overlay",
      "Punkt 1 mit Clip",
      "Punkt 2 mit Clip",
      "Punkt 3 + CTA",
    ],
    timingSeconds: 30,
    tags: ["listicle", "hohe Watchtime"],
  },
  {
    id: "before-after",
    title: "Transformation / Before-After",
    hook: "Vorher – nachher in [Zeitraum].",
    structure: [
      "Vorher-Zustand kurz zeigen",
      "Schnitt/Übergang (Whip-Pan o. Ä.)",
      "Nachher-Zustand",
      "Caption mit Kontext",
    ],
    timingSeconds: 12,
    tags: ["visuell", "loop-fähig"],
  },
  {
    id: "direct-question",
    title: "Direkte Frage an die Kamera",
    hook: "Warum macht eigentlich niemand [X]?",
    structure: [
      "Frage direkt in Kamera sprechen",
      "Kontext/Begründung liefern",
      "Auflösung mit Produkt/Insight",
      "Frage an Zuschauer als CTA",
    ],
    timingSeconds: 20,
    tags: ["talking-head", "community"],
  },
  {
    id: "unboxing-first-impression",
    title: "Unboxing / First Impression",
    hook: "Erster Eindruck von [Produkt].",
    structure: [
      "Reveal-Moment als Opener",
      "Reaktion in Echtzeit",
      "Details/Feature-Highlights",
      "Fazit + CTA",
    ],
    timingSeconds: 35,
    tags: ["produktfokus", "authentisch"],
  },
];
