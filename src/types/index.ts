export type Niveau = 'vmbo' | 'havo' | 'vwo' | 'mbo' | 'hbo' | 'uni';
export type Lengte = 'kort' | 'medium' | 'lang';
export type AfbeeldingType = 'geen' | 'stock' | 'ai';
export type TemplateType = 'klassiek' | 'praktisch' | 'onderzoek' | 'toets' | 'custom';

// Template sectie definitie
export interface TemplateSection {
  titel: string;
  beschrijving: string;
  verplicht: boolean;
}

// Template definitie
export interface Template {
  id: TemplateType;
  naam: string;
  beschrijving: string;
  icon: string;
  secties: TemplateSection[];
}

// Voorgedefinieerde templates
export const TEMPLATES: Template[] = [
  {
    id: 'klassiek',
    naam: 'Klassiek',
    beschrijving: 'Traditionele opbouw met theorie, voorbeelden en oefeningen',
    icon: '📚',
    secties: [
      { titel: 'Inleiding', beschrijving: 'Introductie van het onderwerp en waarom het relevant is', verplicht: true },
      { titel: 'Theorie', beschrijving: 'Uitleg van de kernconcepten', verplicht: true },
      { titel: 'Voorbeelden', beschrijving: 'Concrete voorbeelden die de theorie verduidelijken', verplicht: true },
      { titel: 'Verdieping', beschrijving: 'Uitbreiding en nuancering van de stof', verplicht: false },
      { titel: 'Opdrachten', beschrijving: 'Oefeningen van makkelijk naar moeilijk', verplicht: true },
      { titel: 'Samenvatting', beschrijving: 'Kernpunten op een rij', verplicht: true },
    ],
  },
  {
    id: 'praktisch',
    naam: 'Praktisch',
    beschrijving: 'Hands-on leren met stapsgewijze instructies',
    icon: '🔧',
    secties: [
      { titel: 'Doel', beschrijving: 'Wat ga je kunnen na dit hoofdstuk?', verplicht: true },
      { titel: 'Benodigdheden', beschrijving: 'Wat heb je nodig om te beginnen?', verplicht: false },
      { titel: 'Stap voor stap', beschrijving: 'Duidelijke instructies om te volgen', verplicht: true },
      { titel: 'Uitleg', beschrijving: 'Waarom werkt het zo?', verplicht: true },
      { titel: 'Veelgemaakte fouten', beschrijving: 'Waar moet je op letten?', verplicht: false },
      { titel: 'Zelf proberen', beschrijving: 'Oefen wat je hebt geleerd', verplicht: true },
      { titel: 'Checklist', beschrijving: 'Controleer of je alles beheerst', verplicht: true },
    ],
  },
  {
    id: 'onderzoek',
    naam: 'Onderzoekend',
    beschrijving: 'Vanuit een vraag zelf op onderzoek',
    icon: '🔬',
    secties: [
      { titel: 'Onderzoeksvraag', beschrijving: 'De centrale vraag die we gaan beantwoorden', verplicht: true },
      { titel: 'Voorkennis', beschrijving: 'Wat weet je al over dit onderwerp?', verplicht: true },
      { titel: 'Bronnen & methode', beschrijving: 'Hoe gaan we dit onderzoeken?', verplicht: true },
      { titel: 'Bevindingen', beschrijving: 'Wat hebben we ontdekt?', verplicht: true },
      { titel: 'Conclusie', beschrijving: 'Antwoord op de onderzoeksvraag', verplicht: true },
      { titel: 'Discussie', beschrijving: 'Wat betekent dit en welke vragen blijven open?', verplicht: false },
    ],
  },
  {
    id: 'toets',
    naam: 'Toetsvoorbereiding',
    beschrijving: 'Gericht op herhaling en examentraining',
    icon: '📝',
    secties: [
      { titel: 'Leerdoelen', beschrijving: 'Dit moet je kennen en kunnen', verplicht: true },
      { titel: 'Kernbegrippen', beschrijving: 'Belangrijke termen met uitleg', verplicht: true },
      { titel: 'Theorie samengevat', beschrijving: 'Beknopt overzicht van de stof', verplicht: true },
      { titel: 'Voorbeeldvragen', beschrijving: 'Typische vragen met uitwerking', verplicht: true },
      { titel: 'Oefenopgaven', beschrijving: 'Test jezelf', verplicht: true },
      { titel: 'Tips', beschrijving: 'Handige tips voor de toets', verplicht: false },
    ],
  },
  {
    id: 'custom',
    naam: 'Aangepast',
    beschrijving: 'Stel je eigen structuur samen',
    icon: '✏️',
    secties: [], // Wordt door gebruiker ingevuld
  },
];

// Helper om template te vinden
export const getTemplate = (id: TemplateType): Template | undefined => {
  return TEMPLATES.find((t) => t.id === id);
};

// Leerjaren per niveau
export const LEERJAREN_PER_NIVEAU: Record<Niveau, number[]> = {
  vmbo: [1, 2, 3, 4],
  havo: [1, 2, 3, 4, 5],
  vwo: [1, 2, 3, 4, 5, 6],
  mbo: [1, 2, 3, 4],
  hbo: [1, 2, 3, 4],
  uni: [1, 2, 3],
};

// Standaard woordenaantallen per lengte categorie
export const WOORDEN_PER_LENGTE: Record<Lengte, number> = {
  kort: 800,
  medium: 1500,
  lang: 2500,
};

export interface FormData {
  onderwerp: string;
  niveau: Niveau;
  leerjaar: number;
  leerdoelen: string;
  lengte: Lengte;
  woordenAantal: number; // exact aantal woorden (kan afwijken van lengte preset)
  metAfbeeldingen: boolean;
  afbeeldingType: AfbeeldingType;
  laatstePlaatjeInfographic: boolean; // bij AI-afbeeldingen: laatste plaatje als infographic
  context: string; // optioneel: hobby/interessegebied voor personalisatie
  template: TemplateType;
  customSecties?: TemplateSection[]; // alleen bij template === 'custom'
}

export interface GeneratedChapter {
  content: string;
  prompt: string;
  images?: ChapterImage[];
}

export interface ChapterImage {
  url: string;
  alt: string;
  photographer?: string;
  photographerUrl?: string;
  isAiGenerated?: boolean;
}

export interface UnsplashPhoto {
  id: string;
  urls: {
    regular: string;
    small: string;
  };
  alt_description: string;
  user: {
    name: string;
    links: {
      html: string;
    };
  };
}

// Hoofdstuk structuur voor planning
export interface HoofdstukPlan {
  id: string; // Unieke ID voor drag & drop
  titel: string;
  beschrijving: string;
  paragrafen?: string[]; // Optionele paragraaf titels
  status: 'pending' | 'generated'; // Of het hoofdstuk al geschreven is
  hoofdstukId?: string; // Link naar gegenereerd hoofdstuk (indien status === 'generated')
}

export interface HandboekStructuur {
  hoofdstukken: HoofdstukPlan[];
}

// Database types
export interface Handboek {
  id: string;
  user_id: string;
  titel: string;
  beschrijving: string | null;
  niveau: Niveau;
  leerjaar: number;
  context: string | null;
  template: TemplateType;
  custom_secties: TemplateSection[] | null;
  structuur: HandboekStructuur | null; // Geplande hoofdstukindeling
  created_at: string;
  updated_at: string;
}

export interface Hoofdstuk {
  id: string;
  handboek_id: string;
  titel: string;
  onderwerp: string;
  content: string;
  prompt_used: string | null;
  volgorde: number;
  lengte: Lengte;
  leerdoelen: string | null;
  created_at: string;
  updated_at: string;
}

export interface Afbeelding {
  id: string;
  hoofdstuk_id: string;
  url: string;
  alt: string | null;
  photographer: string | null;
  photographer_url: string | null;
  is_ai_generated: boolean;
  volgorde: number;
  created_at: string;
}

// Extended types with relations
export interface HandboekMetHoofdstukken extends Handboek {
  hoofdstukken: Hoofdstuk[];
}

export interface HoofdstukMetAfbeeldingen extends Hoofdstuk {
  afbeeldingen: Afbeelding[];
}
