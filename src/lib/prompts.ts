import { FormData, TemplateType, TemplateSection, getTemplate, TEMPLATES, WOORDEN_PER_LENGTE } from '@/types';
import { getLengthGuidance } from '@/lib/tokenBudget';

const NIVEAU_BESCHRIJVING: Record<string, { doelgroep: string; taalrichtlijnen: string }> = {
  po_onder: {
    doelgroep: 'basisschoolleerlingen onderbouw (groep 1-4, 4-8 jaar)',
    taalrichtlijnen: `- Gebruik zeer eenvoudige, korte zinnen (max 8 woorden)
- Alleen bekende woorden uit de directe leefwereld van jonge kinderen
- Veel herhaling en ritme in de tekst
- Concrete voorbeelden: speelgoed, dieren, familie, school, natuur
- Spreek de lezer direct aan met "jij" en "je"
- Gebruik speelse, vrolijke toon
- Veel visuele beschrijvingen die kinderen kunnen tekenen
- Eenvoudige vragen om te controleren of ze het begrijpen
- Korte alinea's van 2-3 zinnen maximum`,
  },
  po_boven: {
    doelgroep: 'basisschoolleerlingen bovenbouw (groep 5-8, 8-12 jaar)',
    taalrichtlijnen: `- Eenvoudige, heldere taal met korte zinnen (max 12 woorden)
- Nieuwe woorden altijd direct uitleggen
- Concrete voorbeelden uit het dagelijks leven van kinderen (hobby's, vrienden, school, familie)
- Vermijd abstracte concepten of leg ze uit met voorbeelden
- Gebruik actieve zinnen en spreek de lezer aan met "je"
- Maak het leuk en interessant met weetjes en verrassende feiten
- Gebruik lijstjes en opsommingen voor overzicht
- Stel vragen om kinderen aan het denken te zetten
- Korte paragrafen voor goede leesbaarheid`,
  },
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
  po_onder: {
    1: 'Dit is groep 1 (4-5 jaar). Kinderen leren nog lezen. Focus op luisteren, kijken en doen. Zeer korte zinnen, veel herhaling, speels.',
    2: 'Dit is groep 2 (5-6 jaar). Kinderen beginnen met letters. Houd tekst zeer eenvoudig. Focus op begrip door voorlezen.',
    3: 'Dit is groep 3 (6-7 jaar). Kinderen leren lezen. Gebruik korte woorden en zinnen. Veel plaatjes en concrete voorbeelden.',
    4: 'Dit is groep 4 (7-8 jaar). Kinderen kunnen eenvoudige teksten lezen. Korte zinnen, bekende woorden, veel herhaling.',
  },
  po_boven: {
    5: 'Dit is groep 5 (8-9 jaar). Kinderen kunnen zelfstandig lezen. Introduceer nieuwe begrippen met uitleg. Houd het concreet.',
    6: 'Dit is groep 6 (9-10 jaar). Kinderen hebben meer leeservaring. Er mag wat meer tekst, maar blijf helder en toegankelijk.',
    7: 'Dit is groep 7 (10-11 jaar). Kinderen bereiden zich voor op voortgezet onderwijs. Introduceer wat meer diepgang, maar blijf concreet.',
    8: 'Dit is groep 8 (11-12 jaar). Laatste jaar basisschool. Kinderen kunnen langere teksten aan. Goede voorbereiding op VO-niveau.',
  },
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
function buildTemplateStructure(template: TemplateType, customSecties?: TemplateSection[], metBronnen?: boolean): string {
  // Bij custom template, gebruik de custom secties
  if (template === 'custom' && customSecties && customSecties.length > 0) {
    const sectiesText = customSecties
      .map((s) => `## ${s.titel}\n${s.beschrijving}`)
      .join('\n\n');

    const bronnenSectie = metBronnen ? '\n\n## Bronnen\nLijst van 3-5 betrouwbare bronnen in markdown formaat: - [Titel](URL) - Beschrijving' : '';

    return `# [Pakkende titel voor het hoofdstuk]

${sectiesText}${bronnenSectie}`;
  }

  // Voorgedefinieerde template structuren
  const bronnenSectie = metBronnen ? '\n\n## Bronnen\nLijst van 3-5 betrouwbare bronnen in markdown formaat: - [Titel](URL) - Beschrijving' : '';

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
De belangrijkste punten op een rij (5-7 bullets).${bronnenSectie}`,

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
Controlelijst: vink af wat je nu kunt/beheerst.${bronnenSectie}`,

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
Wat betekenen deze bevindingen? Welke beperkingen heeft het onderzoek? Welke nieuwe vragen ontstaan?${bronnenSectie}`,

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
Handige tips voor de toets: waar letten docenten op? Veelgemaakte fouten om te vermijden.${bronnenSectie}`,

    custom: `# [Pakkende titel voor het hoofdstuk]

## Inleiding
Introductie van het onderwerp.

## Hoofdinhoud
De kern van het hoofdstuk.

## Afsluiting
Samenvatting en conclusie.${bronnenSectie}`,
  };

  return templateStructures[template] || templateStructures.klassiek;
}

export function buildPrompt(data: FormData): string {
  const { onderwerp, niveau, leerjaar, leerdoelen, lengte, woordenAantal, metAfbeeldingen, metBronnen, context, template, customSecties } = data;
  // Gebruik custom woordenaantal als opgegeven, anders fallback naar preset
  // Factor 1.5 omdat AI minder woorden genereert dan gevraagd (tokens vs woorden)
  const woordenaantal = Math.round((woordenAantal || WOORDEN_PER_LENGTE[lengte]) * 1.5);
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

  // Template-specifieke afbeeldingsplaatsing
  const getAfbeeldingPlaatsing = (templateId: string): string => {
    switch (templateId) {
      case 'klassiek':
        return `PLAATSING (5 afbeeldingen):
1. In sectie "Theorie" - na uitleg van een kernconcept
2. In sectie "Theorie" - bij een tweede belangrijk begrip
3. In sectie "Voorbeelden" - bij een concreet voorbeeld
4. In sectie "Verdieping" of "Opdrachten" - bij praktische toepassing
5. Aan het einde - samenvattende infographic (wordt automatisch gegenereerd indien ingeschakeld)`;
      case 'praktisch':
        return `PLAATSING (5 afbeeldingen):
1. In sectie "Benodigdheden" of begin "Stap voor stap" - overzicht materialen/tools
2. In sectie "Stap voor stap" - bij een cruciale tussenstap
3. In sectie "Stap voor stap" - bij het eindresultaat van de stappen
4. In sectie "Uitleg" of "Veelgemaakte fouten" - verduidelijkende afbeelding
5. Aan het einde - samenvattende infographic (wordt automatisch gegenereerd indien ingeschakeld)`;
      case 'onderzoek':
        return `PLAATSING (5 afbeeldingen):
1. In sectie "Onderzoeksvraag" of "Voorkennis" - context van het onderwerp
2. In sectie "Bronnen & methode" - onderzoeksmethode visualisatie
3. In sectie "Bevindingen" - belangrijkste ontdekking
4. In sectie "Bevindingen" - tweede belangrijke bevinding of data
5. Aan het einde - samenvattende infographic (wordt automatisch gegenereerd indien ingeschakeld)`;
      case 'toets':
        return `PLAATSING (5 afbeeldingen):
1. In sectie "Kernbegrippen" - visualisatie van belangrijk begrip
2. In sectie "Theorie samengevat" - schema of concept
3. In sectie "Voorbeeldvragen" - bij een uitgewerkt voorbeeld
4. In sectie "Oefenopgaven" - bij een oefening
5. Aan het einde - samenvattende infographic (wordt automatisch gegenereerd indien ingeschakeld)`;
      default:
        return `PLAATSING (5 afbeeldingen):
1. Na de eerste inhoudelijke paragraaf
2. Bij het eerste belangrijke concept of voorbeeld
3. Halverwege het hoofdstuk bij nieuwe informatie
4. Bij praktische toepassing of oefening
5. Aan het einde - samenvattende infographic (wordt automatisch gegenereerd indien ingeschakeld)`;
    }
  };

  const afbeeldingenSection = metAfbeeldingen
    ? `
## AFBEELDINGEN
Voeg EXACT 4 afbeeldingen toe (de 5e infographic wordt apart gegenereerd). Gebruik dit EXACTE formaat:
[AFBEELDING: engelse zoekterm]

${getAfbeeldingPlaatsing(template || 'klassiek')}

BELANGRIJKE regels voor de zoekterm:
- Exact 2-3 Engelse woorden
- Beschrijf een SPECIFIEKE, fotografeerbare scene die past bij "${onderwerp}"
- Combineer het onderwerp met een actie of setting
- Denk als een fotograaf: wat zou je letterlijk op de foto zien?

Voorbeelden:
- "fotosynthese": [AFBEELDING: plant sunlight leaves]
- "Franse revolutie": [AFBEELDING: Paris historic buildings]
- "programmeren": [AFBEELDING: coding laptop screen]

VERMIJD: education, learning, student, classroom, school, study, book, teacher

Plaats EXACT 4 afbeeldingen op de aangegeven plekken, NIET meer, NIET minder!
`
    : '';

  const getBronnenAantal = (niveau: string): string => {
    const bronnenConfig: Record<string, { aantal: string; complexiteit: string }> = {
      po_onder: { aantal: '2-3', complexiteit: 'zeer eenvoudige websites (Wikipedia, educatieve sites)' },
      po_boven: { aantal: '3-4', complexiteit: 'toegankelijke websites (Wikipedia, Kennisnet)' },
      vmbo: { aantal: '3-5', complexiteit: 'begrijpbare bronnen (Wikipedia, educatieve sites, nieuwsartikelen)' },
      havo: { aantal: '4-6', complexiteit: 'mix van Wikipedia, educatieve sites en vakbladen' },
      vwo: { aantal: '5-7', complexiteit: 'academische bronnen (Wikipedia, wetenschappelijke sites, vakpublicaties)' },
      mbo: { aantal: '4-6', complexiteit: 'praktijkgerichte bronnen (vakliteratuur, brancheorganisaties)' },
      hbo: { aantal: '6-8', complexiteit: 'wetenschappelijke en professionele bronnen' },
      uni: { aantal: '7-10', complexiteit: 'academische publicaties, peer-reviewed artikelen' },
    };
    const config = bronnenConfig[niveau] || bronnenConfig.havo;
    return `${config.aantal} bronnen van ${config.complexiteit}`;
  };

  const bronnenSection = metBronnen
    ? `
## BRONVERMELDING (INLINE + LIJST)

DOEL:
Citeer ${getBronnenAantal(niveau)} IN DE TEKST, passend bij het onderwijsniveau.

BETROUWBARE BRONNEN:
- Gebruik ALLEEN bronnen die DAADWERKELIJK BESTAAN en publiek toegankelijk zijn
- Kies bronnen die specifiek over "${onderwerp}" gaan (geen generieke homepages of standaardvoorbeelden)
- Vermijd placeholders of steeds dezelfde titels ("Agile Manifesto", "Wikipedia", "Kennisnet") zonder onderwerp
- Kies uit:
  * Wikipedia artikelen (gebruik volledige URL: https://nl.wikipedia.org/wiki/[artikel])
  * Wetenschappelijke publicaties en tijdschriften
  * Officiële overheidswebsites (bijv. rijksoverheid.nl, CBS.nl)
  * Erkende educatieve websites (bijv. Kennisnet, lesmateriaal.nu)
  * Gerenommeerde media en encyclopedieën

WERKWIJZE (STRIKTE VOLGORDE):

STAP 1: Schrijf de tekst MET inline citaties
- Schrijf het hoofdstuk en citeer bronnen TIJDENS het schrijven (inhoud moet duidelijk leunen op de bron)
- Plaats citaties na feiten, cijfers, stellingen en belangrijke concepten
- Gebruik EXACT dezelfde bronnaam in de tekst als in de lijst (bijv. "(Fotosynthese - Wikipedia, 2024)" i.p.v. alleen "(Wikipedia)")
- Format: "(Titel, Jaar)" bijvoorbeeld "(Fotosynthese - Wikipedia, 2024)" of "(CBS StatLine, 2023)"
- Citeer minimaal 5-8 keer in de tekst (mag dezelfde bron meerdere keren zijn)
- Verwerk gegevens uit de gekozen bron in de zin; geen losse bronplak zonder inhoudelijke verwijzing
- Voorbeeld: "Fotosynthese is het proces waarbij planten licht omzetten in energie (Kennisnet, 2024)."

STAP 2: Maak de bronnenlijst
- Verzamel ALLEEN de bronnen die je in stap 1 daadwerkelijk geciteerd hebt
- De lijst is een INVENTARISATIE van wat je al citeerde, GEEN nieuwe bronnen
- De titels in de lijst zijn IDENTIEK aan de namen in de inline citaties (1-op-1)
- Format:
  ## Bronnen
  - [Fotosynthese](https://nl.wikipedia.org/wiki/Fotosynthese) - Wikipedia artikel over fotosynthese (2024)
  - [Plantengroei en licht](https://www.kennisnet.nl/artikel/licht-plantengroei) - Kennisnet lesmateriaal over fotosynthese

CONTROLE - VOOR JE BRONNENLIJST MAAKT, VRAAG JEZELF AF:
❌ Staat "Agile Manifesto" in mijn lijst? Check: heb ik "(Agile Manifesto, ...)" in de tekst? NEE → Niet toevoegen!
❌ Staat "Wikipedia Software" in mijn lijst? Check: heb ik "(Wikipedia, ...)" over software in de tekst? NEE → Niet toevoegen!
✅ Heb ik "(Kennisnet, 2024)" in de tekst? JA → Voeg Kennisnet toe aan de lijst
✅ Elke bron in de lijst MOET letterlijk geciteerd zijn in de tekst met "(Naam, Jaar)"
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
  const templateStructuur = buildTemplateStructure(template || 'klassiek', customSecties, metBronnen);
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
${afbeeldingenSection}${bronnenSection}
## LENGTE
Streef naar ongeveer ${woordenaantal} woorden.

## TAALGEBRUIK
- Schrijf in het Nederlands
- Pas het taalniveau aan op de doelgroep
- Gebruik actieve zinnen
- Vermijd jargon tenzij je het uitlegt
- Gebruik "je" en "jij" om de lezer aan te spreken
- Titels en kopjes: alleen eerste woord met hoofdletter (Nederlandse schrijfwijze), dus NIET "De Franse Revolutie" maar "De Franse revolutie"

## CULTURELE CONTEXT (STANDAARD NEDERLANDS)
Gebruik ALTIJD Nederlandse context, tenzij het onderwerp of de leerdoelen expliciet anders aangeven:

Voorbeelden & Referenties:
- Nederlandse steden (Amsterdam, Rotterdam, Utrecht), bedrijven (Albert Heijn, NS, KLM), personen (bekende Nederlanders)
- Actualiteit en gebeurtenissen uit Nederland
- Nederlandse geschiedenis en cultuur waar relevant

Meetwaarden & Eenheden:
- Metrisch stelsel: kilometer (km), kilogram (kg), meter (m), liter (l)
- Temperatuur in Celsius (°C)
- Valuta in Euro (€)

Onderwijscontext:
- Nederlands schoolsysteem: basisschool (groep 1-8), voortgezet onderwijs (VMBO/HAVO/VWO), MBO, HBO, universiteit
- Nederlandse schoolvakanties, toetsen, examens

Vermijd:
- Amerikaanse bias (feet, miles, Fahrenheit, dollars, Amerikaanse geschiedenis als standaard)
- Aanname dat Amerikaanse context universeel is
- Engels/Amerikaanse spelling of terminologie zonder noodzaak

LET OP: Als het onderwerp inherent internationaal is (bijv. "Amerikaanse Burgeroorlog", "Chinese dynastie") of als in de leerdoelen/context staat "internationale context", dan mag je uiteraard die specifieke context gebruiken.

## BELANGRIJK
- Zorg dat alle informatie feitelijk correct is
- Geef concrete, herkenbare voorbeelden uit de Nederlandse context
- Maak de lesstof toepasbaar en relevant voor Nederlandse leerlingen`;

  // Add explicit length guidance (non-breaking: appended at the end)
  const lengthGuidance = getLengthGuidance(data);

  return prompt + lengthGuidance;
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
