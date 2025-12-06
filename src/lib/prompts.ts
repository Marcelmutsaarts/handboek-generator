import { FormData, TemplateType, TemplateSection, getTemplate, TEMPLATES, WOORDEN_PER_LENGTE } from '@/types';

const NIVEAU_BESCHRIJVING: Record<string, { doelgroep: string; taalrichtlijnen: string }> = {
  vmbo: {
    doelgroep: 'vmbo-leerlingen (12-16 jaar)',
    taalrichtlijnen: `- Gebruik eenvoudige, alledaagse taal
- Korte zinnen (max 15 woorden per zin)
- Concrete voorbeelden uit hun dagelijks leven (sociale media, games, sport, vrienden)
- Vermijd abstracte concepten; maak alles tastbaar
- Gebruik veel visuele beschrijvingen
- Herhaal belangrijke punten op verschillende manieren
- Stappenplannen en checklijsten werken goed`,
  },
  havo: {
    doelgroep: 'havo-leerlingen (12-17 jaar)',
    taalrichtlijnen: `- Heldere, toegankelijke taal met ruimte voor nuance
- Gemiddelde zinslengte, afgewisseld met kortere zinnen
- Praktische voorbeelden met maatschappelijke relevantie
- Introduceer vakbegrippen met duidelijke uitleg
- Stimuleer verbanden leggen tussen theorie en praktijk
- Ruimte voor eigen mening vormen
- Balans tussen feiten en toepassing`,
  },
  vwo: {
    doelgroep: 'vwo-leerlingen (12-18 jaar)',
    taalrichtlijnen: `- Rijke, gevarieerde taal met complexere zinsstructuren
- Abstractere concepten en theoretische kaders zijn toegestaan
- Stimuleer kritisch denken en analyseren
- Verwijs naar wetenschappelijke inzichten waar relevant
- Leg verbanden met bredere contexten (historisch, filosofisch, maatschappelijk)
- Daag uit om verder te denken dan het voor de hand liggende
- Nuance en meerdere perspectieven belichten`,
  },
  mbo: {
    doelgroep: 'mbo-studenten (16-25 jaar)',
    taalrichtlijnen: `- Praktijkgerichte, no-nonsense taal
- Directe koppeling naar beroepspraktijk en werkcontext
- Concrete casussen en herkenbare werksituaties
- Theorie altijd verbinden met "wat heb je hieraan op de werkvloer"
- Stappenplannen en protocollen waar passend
- Aandacht voor samenwerking en communicatie in teams
- Realistische scenario's uit het werkveld`,
  },
  hbo: {
    doelgroep: 'hbo-studenten (18+ jaar)',
    taalrichtlijnen: `- Professionele, academisch getinte taal
- Theoretische onderbouwing met praktische toepassing
- Verwijzingen naar onderzoek en evidence-based werken
- Stimuleer reflectie op eigen handelen
- Aandacht voor beroepsethiek en professionele standaarden
- Complexere vraagstukken met meerdere oplossingsrichtingen
- Kritische analyse van bronnen en methoden`,
  },
  uni: {
    doelgroep: 'universitaire studenten (18+ jaar)',
    taalrichtlijnen: `- Academische taal met wetenschappelijke precisie
- Theoretische diepgang en conceptuele frameworks
- Verwijzingen naar wetenschappelijke literatuur en debatten
- Epistemologische reflectie: hoe weten we wat we weten?
- Meerdere theoretische perspectieven naast elkaar
- Kritische analyse en synthese van complexe informatie
- Ruimte voor wetenschappelijke nuance en onzekerheid`,
  },
};

// Leerjaar-specifieke aanpassingen per niveau
const LEERJAAR_AANPASSINGEN: Record<string, Record<number, string>> = {
  vmbo: {
    1: 'Dit is leerjaar 1 (brugklas). Focus op basiskennis en oriëntatie. Houd het simpel en toegankelijk. De leerlingen komen net van de basisschool.',
    2: 'Dit is leerjaar 2. Bouw voort op basiskennis uit leerjaar 1. Er mag iets meer diepgang in, maar blijf concreet.',
    3: 'Dit is leerjaar 3. Leerlingen bereiden zich voor op examen. Introduceer examenstof maar blijf praktisch en helder.',
    4: 'Dit is leerjaar 4 (examenjaar). Focus op examenstof en eindniveau. Zorg voor goede samenvatting en oefening.',
  },
  havo: {
    1: 'Dit is leerjaar 1 (brugklas). Focus op oriëntatie en basisvaardigheden. De leerlingen verkennen het vak.',
    2: 'Dit is leerjaar 2. Verdieping van de basis. Er mogen meer verbanden gelegd worden.',
    3: 'Dit is leerjaar 3. Voorbereiding op bovenbouw. De stof wordt serieuzer en er wordt meer zelfstandigheid verwacht.',
    4: 'Dit is leerjaar 4 (eerste examenjaar). Examenstof begint. Introduceer SE-stof en toetsvaardigheden.',
    5: 'Dit is leerjaar 5 (eindexamenjaar). Focus op CE-stof en examenniveau. Zorg voor goede voorbereiding op het eindexamen.',
  },
  vwo: {
    1: 'Dit is leerjaar 1 (brugklas). Oriëntatie en eerste kennismaking met academisch denken.',
    2: 'Dit is leerjaar 2. Verdieping met ruimte voor abstractere concepten.',
    3: 'Dit is leerjaar 3. Profielkeuze nadert. Introduceer wetenschappelijke werkwijze.',
    4: 'Dit is leerjaar 4. Bovenbouw start. Meer diepgang en wetenschappelijke benadering.',
    5: 'Dit is leerjaar 5. Gevorderde stof met aandacht voor verbanden tussen vakgebieden.',
    6: 'Dit is leerjaar 6 (eindexamenjaar). Examenniveau met academische diepgang. Voorbereiding op universitaire studie.',
  },
  mbo: {
    1: 'Dit is leerjaar 1 (propedeuse). Basiskwalificaties en oriëntatie op het beroep. Focus op fundamentele kennis en vaardigheden.',
    2: 'Dit is leerjaar 2. Verdere specialisatie met meer praktijkgericht werken. BPV-voorbereiding.',
    3: 'Dit is leerjaar 3. Gevorderde beroepsvaardigheden. Zelfstandig functioneren in de praktijk.',
    4: 'Dit is leerjaar 4 (afstudeerjaar). Eindkwalificaties en examenvoorbereiding. Zelfstandig beroepsmatig functioneren.',
  },
  hbo: {
    1: 'Dit is leerjaar 1 (propedeuse). Academische basisvaardigheden en oriëntatie op het werkveld.',
    2: 'Dit is leerjaar 2. Verdieping met toenemende complexiteit en eerste praktijkervaringen.',
    3: 'Dit is leerjaar 3. Minor/stage periode. Focus op specialisatie en toepassing in de praktijk.',
    4: 'Dit is leerjaar 4 (afstudeerjaar). Afstudeerproject en eindniveau. Klaar voor instroom in het werkveld.',
  },
  uni: {
    1: 'Dit is bachelor jaar 1 (propedeuse). Wetenschappelijke basisvaardigheden en disciplinaire introductie.',
    2: 'Dit is bachelor jaar 2. Verdieping in de discipline met onderzoeksvaardigheden.',
    3: 'Dit is bachelor jaar 3 (afstudeerjaar). Bachelorscriptie en voorbereiding op master of arbeidsmarkt.',
  },
};

// Template structuur instructies genereren
function buildTemplateStructure(template: TemplateType, customSecties?: TemplateSection[]): string {
  // Bij custom template, gebruik de custom secties
  if (template === 'custom' && customSecties && customSecties.length > 0) {
    const sectiesText = customSecties
      .map((s) => `## ${s.titel}\n${s.beschrijving}`)
      .join('\n\n');

    return `# [Pakkende titel voor het hoofdstuk]

${sectiesText}`;
  }

  // Voorgedefinieerde template structuren
  const templateStructures: Record<TemplateType, string> = {
    klassiek: `# [Pakkende titel voor het hoofdstuk]

## Inleiding
Een korte, motiverende inleiding die de relevantie van het onderwerp duidelijk maakt.

## Theorie
Heldere uitleg van de kernconcepten en belangrijkste begrippen.

## Voorbeelden
Concrete voorbeelden die de theorie verduidelijken en toepasbaar maken.

## Verdieping
Uitbreiding van de stof met nuances, uitzonderingen of geavanceerdere aspecten.

## Opdrachten
Minimaal 3 opdrachten van oplopende moeilijkheid:
1. Een eenvoudige toepassing
2. Een opdracht die analyse vraagt
3. Een uitdagende opdracht

## Samenvatting
De belangrijkste punten op een rij (5-7 bullets).`,

    praktisch: `# [Pakkende titel voor het hoofdstuk]

## Doel
Wat ga je kunnen na dit hoofdstuk? Formuleer dit concreet en meetbaar.

## Benodigdheden
Wat heb je nodig om te beginnen? (materialen, voorkennis, tools)

## Stap voor stap
Duidelijke, genummerde instructies die je kunt volgen. Elke stap is een concrete actie.

## Uitleg
Waarom werkt het zo? Leg de achterliggende principes uit.

## Veelgemaakte fouten
Waar moet je op letten? Wat gaat vaak mis en hoe voorkom je dat?

## Zelf proberen
Een of meerdere oefeningen om te praktiseren wat je hebt geleerd.

## Checklist
Controlelijst: vink af wat je nu kunt/beheerst.`,

    onderzoek: `# [Pakkende titel voor het hoofdstuk]

## Onderzoeksvraag
Formuleer de centrale vraag die we gaan onderzoeken. Maak deze specifiek en onderzoekbaar.

## Voorkennis
Wat weet je al over dit onderwerp? Activeer bestaande kennis en leg verbanden.

## Bronnen & methode
Welke bronnen gebruiken we? Hoe gaan we het onderzoeken? (experimenten, literatuur, interviews, etc.)

## Bevindingen
Wat hebben we ontdekt? Presenteer de resultaten gestructureerd.

## Conclusie
Beantwoord de onderzoeksvraag op basis van de bevindingen.

## Discussie
Wat betekenen deze bevindingen? Welke beperkingen heeft het onderzoek? Welke nieuwe vragen ontstaan?`,

    toets: `# [Pakkende titel voor het hoofdstuk]

## Leerdoelen
Dit moet je kennen en kunnen na dit hoofdstuk. Formuleer als "Je kunt..." statements.

## Kernbegrippen
Belangrijke termen met korte, heldere definities. Presenteer als overzichtelijke lijst.

## Theorie samengevat
Beknopt maar volledig overzicht van alle belangrijke stof.

## Voorbeeldvragen
Typische examenvragen met volledige uitwerking. Laat zien hoe je tot het antwoord komt.

## Oefenopgaven
Vergelijkbare vragen om zelf te oefenen (zonder uitwerking, of met antwoorden onderaan).

## Tips
Handige tips voor de toets: waar letten docenten op? Veelgemaakte fouten om te vermijden.`,

    custom: `# [Pakkende titel voor het hoofdstuk]

## Inleiding
Introductie van het onderwerp.

## Hoofdinhoud
De kern van het hoofdstuk.

## Afsluiting
Samenvatting en conclusie.`,
  };

  return templateStructures[template] || templateStructures.klassiek;
}

export function buildPrompt(data: FormData): string {
  const { onderwerp, niveau, leerjaar, leerdoelen, lengte, woordenAantal, metAfbeeldingen, context, template, customSecties } = data;
  // Gebruik custom woordenaantal als opgegeven, anders fallback naar preset
  const woordenaantal = woordenAantal || WOORDEN_PER_LENGTE[lengte];
  const niveauInfo = NIVEAU_BESCHRIJVING[niveau];
  const leerjaarInfo = LEERJAAR_AANPASSINGEN[niveau]?.[leerjaar] || '';

  const leerdoelenSection = leerdoelen.trim()
    ? `
## LEERDOELEN
Na het bestuderen van dit hoofdstuk kan de leerling/student:
${leerdoelen
  .split('\n')
  .filter((l) => l.trim())
  .map((l) => `- ${l.trim()}`)
  .join('\n')}
`
    : '';

  const contextSection = context?.trim()
    ? `
## PERSONALISATIE
De doelgroep heeft als interessegebied/hobby: "${context}"

Verwerk dit SUBTIEL in de tekst:
- Gebruik af en toe een voorbeeld, metafoor of vergelijking die aansluit bij "${context}"
- Doe dit 2-3 keer per hoofdstuk, niet vaker
- Het moet natuurlijk aanvoelen, niet geforceerd
- De hoofdinhoud blijft het onderwerp, de context is slechts een brug om de stof herkenbaar te maken
- Voorbeeld: bij wiskunde voor voetballiefhebbers kun je eens een berekening doen met speelminuten of doelpunten
`
    : '';

  const afbeeldingenSection = metAfbeeldingen
    ? `
## AFBEELDINGEN
Voeg NA elke inhoudelijke paragraaf (dus NA paragraaf 1, 2, 3 en NA praktische opdrachten) een afbeeldingsregel toe in dit EXACTE formaat:
[AFBEELDING: engelse zoekterm]

BELANGRIJKE regels voor de zoekterm:
- Exact 2-3 Engelse woorden
- Beschrijf een SPECIFIEKE, fotografeerbare scene die past bij "${onderwerp}"
- Combineer het onderwerp met een actie of setting
- Denk als een fotograaf: wat zou je letterlijk op de foto zien?

Voorbeelden per onderwerp:
- Onderwerp "fotosynthese": [AFBEELDING: plant sunlight leaves] of [AFBEELDING: greenhouse growing plants]
- Onderwerp "Franse revolutie": [AFBEELDING: Paris historic buildings] of [AFBEELDING: crowd protest flags]
- Onderwerp "programmeren": [AFBEELDING: coding laptop screen] of [AFBEELDING: developer typing code]
- Onderwerp "voeding": [AFBEELDING: healthy meal plate] of [AFBEELDING: vegetables kitchen cooking]

VERMIJD generieke termen zoals: education, learning, student, classroom, school, study, book, teacher (tenzij gecombineerd met iets specifieks)

NIET plaatsen na: Inleiding, Reflectievragen, Samenvatting
`
    : '';

  const leerjaarSection = leerjaarInfo
    ? `
## LEERJAAR CONTEXT
${leerjaarInfo}
Pas de moeilijkheidsgraad, diepgang en voorbeelden aan op dit leerjaar.
`
    : '';

  // Genereer de template structuur
  const templateStructuur = buildTemplateStructure(template || 'klassiek', customSecties);
  const templateNaam = getTemplate(template || 'klassiek')?.naam || 'Klassiek';

  const prompt = `Je bent een ervaren onderwijsauteur die educatieve hoofdstukken schrijft. Schrijf een compleet hoofdstuk voor ${niveauInfo.doelgroep}, leerjaar ${leerjaar}.

## ONDERWERP
${onderwerp}
${leerjaarSection}${leerdoelenSection}${contextSection}
## TAALRICHTLIJNEN VOOR DIT NIVEAU
${niveauInfo.taalrichtlijnen}

## STRUCTUUR (${templateNaam} template)
Lever het hoofdstuk in deze exacte structuur. Volg de secties precies zoals hieronder aangegeven:

${templateStructuur}
${afbeeldingenSection}
## LENGTE
Streef naar ongeveer ${woordenaantal} woorden.

## TAALGEBRUIK
- Schrijf in het Nederlands
- Pas het taalniveau aan op de doelgroep
- Gebruik actieve zinnen
- Vermijd jargon tenzij je het uitlegt
- Gebruik "je" en "jij" om de lezer aan te spreken

## BELANGRIJK
- Zorg dat alle informatie feitelijk correct is
- Geef concrete, herkenbare voorbeelden
- Maak de lesstof toepasbaar en relevant`;

  return prompt;
}

export function getPromptForDisplay(data: FormData): string {
  return buildPrompt(data);
}

// Interface voor eerdere hoofdstukken context
interface EerderHoofdstuk {
  titel: string;
  onderwerp: string;
  samenvatting?: string;
}

// Bouw prompt met context van eerdere hoofdstukken
export function buildPromptWithContext(
  data: FormData,
  eerdereHoofdstukken: EerderHoofdstuk[]
): string {
  const basePrompt = buildPrompt(data);

  if (eerdereHoofdstukken.length === 0) {
    return basePrompt;
  }

  const contextSection = `
## CONTEXT: EERDERE HOOFDSTUKKEN IN DIT HANDBOEK
Dit hoofdstuk maakt deel uit van een groter handboek. Hieronder staan de eerdere hoofdstukken die al geschreven zijn:

${eerdereHoofdstukken.map((h, i) => `${i + 1}. **${h.titel}** - ${h.onderwerp}${h.samenvatting ? `\n   Samenvatting: ${h.samenvatting}` : ''}`).join('\n')}

INSTRUCTIES VOOR CONTINUÏTEIT:
- Verwijs waar relevant naar concepten uit eerdere hoofdstukken (bijv. "Zoals je in hoofdstuk X hebt geleerd...")
- Bouw voort op kennis die al behandeld is, herhaal niet onnodig
- Zorg voor een logische opbouw en samenhang met de rest van het handboek
- Gebruik consistente terminologie met eerdere hoofdstukken
- Dit wordt hoofdstuk ${eerdereHoofdstukken.length + 1} in de reeks

`;

  // Voeg context section toe na "## ONDERWERP" sectie
  const onderwerpIndex = basePrompt.indexOf('## ONDERWERP');
  const nextSectionIndex = basePrompt.indexOf('\n##', onderwerpIndex + 12);

  if (onderwerpIndex !== -1 && nextSectionIndex !== -1) {
    return basePrompt.slice(0, nextSectionIndex) + '\n' + contextSection + basePrompt.slice(nextSectionIndex);
  }

  return basePrompt + '\n' + contextSection;
}
