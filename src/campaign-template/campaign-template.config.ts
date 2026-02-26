import { TemplateType } from '@prisma/client';

export interface DefaultTemplate {
    lang: string;
    type: TemplateType;
    name: string;
    content: string;
    isActive: boolean;
    batchId: number;
}

export const DEFAULT_TEMPLATES: DefaultTemplate[] = [
    // Default (English) - Invitation Template (Spintax)
    {
        lang: 'en',
        type: TemplateType.invitation,
        name: 'Invitation',
        // Keep only {name} by default (no event variables) and use spintax-ready text
        content:
            '{Hi {name}!|Hello {name}!|Hey {name}!}\n\n{Quick question—are you open to a new invite?|Can I share a quick invite with you?|Would you be interested in an invite?}',
        isActive: true,
        batchId: 1,
    },
    // Default (English) - Followup Template (Spintax)
    {
        lang: 'en',
        type: TemplateType.followup,
        name: 'Followup',
        content:
            '{Hi {name},|Hey {name},|Hello {name},}\n\n{Just following up on my last note—should I send the details?|Quick follow-up—do you want me to share the details?|Checking back—are you interested in the details?}',
        isActive: true,
        batchId: 1,
    },
    // Default (English) - Postevent Template (Spintax)
    {
        lang: 'en',
        type: TemplateType.postevent,
        name: 'Postevent',
        content:
            '{Hi {name},|Hey {name},|Hello {name},}\n\n{Thank you so much for coming—really appreciate it!|Thanks a lot for joining—so happy you made it!|Really appreciate you coming—thank you!}',
        isActive: true,
        batchId: 1,
    },
    {
        lang: 'en',
        type: TemplateType.invitation,
        name: 'Invitation',
        // Keep only {name} by default (no event variables) and use spintax-ready text
        content:
            '{Hi {name}!|Hello {name}!|Hey {name}!}\n\n{Quick question—are you open to a new invite?|Can I share a quick invite with you?|Would you be interested in an invite?}',
        isActive: true,
        batchId: 2,
    },
    // Default (English) - Followup Template (Spintax)
    {
        lang: 'en',
        type: TemplateType.followup,
        name: 'Followup',
        content:
            '{Hi {name},|Hey {name},|Hello {name},}\n\n{Just following up on my last note—should I send the details?|Quick follow-up—do you want me to share the details?|Checking back—are you interested in the details?}',
        isActive: true,
        batchId: 2,
    },
    // Default (English) - Postevent Template (Spintax)
    {
        lang: 'en',
        type: TemplateType.postevent,
        name: 'Postevent',
        content:
            '{Hi {name},|Hey {name},|Hello {name},}\n\n{Thank you so much for coming—really appreciate it!|Thanks a lot for joining—so happy you made it!|Really appreciate you coming—thank you!}',
        isActive: true,
        batchId: 2,
    },
];

export const DEFAULT_VARIATIONS_COUNT = 12;

/**
 * OpenAI prompt template for generating variations across multiple languages
 * Placeholders: {{typeDescription}}, {{languages}}, {{templateContent}}, {{variationsCount}}
 */
export const TEMPLATE_VARIATION_PROMPT = `
You are a professional copywriter to create vartions of a template.
Tempalte Content {{templateContent}} of type {{typeDescription}}( Note it can have spintax blocks ). 
Create the varations: {{variationsCount}}  in these langs (comma-separated): {{languages}}
Rules:
- Translate the templateContent in langs 
- Create the variations in the langs
- Dont add any new placeholders
- Dont add much extra text
- here {name} is the placeholder dont change it with dummy name and must present in each variation
- varations must not spintax blocks
- Eache lang must have {{variationsCount}} variations
- Keep the message 95% identical to the original.
- Each variation must start with a DIFFERENT greeting appropriate to the detected language.
- After the greeting, change exactly 2 words in the body per variation. No more, no less.
- The 2 word changes must be in DIFFERENT parts of the sentence, not next to each other.
- followed by the EXACT same message.
- per variation. The rest stays identical.
- NEVER change the meaning, tone, or structure.
- NEVER add new information or remove information.
- NEVER change emojis, names, venue names, dates, or times.
- Keep the same sentence length and style.
- All 12 greetings must be DIFFERENT from each other.
- All 12 body variations must be DIFFERENT from each other.

TOTAL DIFFERENCES PER VARIATION: 3
- 1 different greeting
- 2 different words in the body

GREETINGS BY LANGUAGE (use all, never repeat):

English: Hey, Hi, Hello, Hiya, Heya, Yo, What's up, 
Heyy, Hi there, Hey there, Howdy, Sup

French: Hey, Salut, Coucou, Hello, Bonjour, Cc, Heyy, 
Yo, Slt, Bjr, Holà, Wesh

Spanish: Hey, Hola, Buenas, Qué tal, Holi, Holaaa, 
Ei, Ey, Hi, Hello, Buenas buenas, Heey

Portuguese: Hey, Oi, Olá, E aí, Oii, Fala, Hello, 
Opa, Eae, Hi, Oie, Hey hey

Italian: Hey, Ciao, Ehi, Bella, Hola, Heey, Hello, 
Ciaooo, Buongiorno, Ehilà, Hi, Yo

Arabic: Hey, مرحبا, هلا, هاي, أهلاً, يا هلا, هلا هلا,
Hello, Hi, Heyy, مرحبااا, هاي هاي

WORDS YOU CAN SWAP (2 per variation, from different parts):

English:
- "amazing" ↔ "great" ↔ "awesome" ↔ "incredible"
- "party" ↔ "event" ↔ "night" ↔ "soirée"
- "this Saturday" ↔ "this Sat" ↔ "Saturday"
- "join us" ↔ "come through" ↔ "pull up" ↔ "come by"
- "tonight" ↔ "this evening" ↔ "this night"
- "Are you around?" ↔ "Are you free?" ↔ "You available?"
- "Would love to see you" ↔ "Would be great to see you" 
  ↔ "Hope to see you"
- "Table is ready" ↔ "Table is set" ↔ "Table is waiting"

French:
- "super" ↔ "géniale" ↔ "incroyable" ↔ "top"
- "soirée" ↔ "event" ↔ "nuit"
- "ce samedi" ↔ "samedi" ↔ "ce sam"
- "tu es dispo?" ↔ "t'es libre?" ↔ "t'es dans le coin?"
- "on aimerait te voir" ↔ "ça serait top de te voir" 
  ↔ "on espère te voir"
- "table prête" ↔ "table réservée" ↔ "table qui t'attend"
- "ce soir" ↔ "cette nuit" ↔ "tonight"
- "viens" ↔ "passe" ↔ "rejoins-nous"

Spanish:
- "increíble" ↔ "genial" ↔ "buenísima" ↔ "espectacular"
- "fiesta" ↔ "evento" ↔ "noche"
- "este sábado" ↔ "el sábado" ↔ "este sáb"
- "te esperamos" ↔ "te queremos ver" ↔ "ojalá vengas"
- "mesa lista" ↔ "mesa reservada" ↔ "mesa esperándote"

WHAT YOU MUST NEVER CHANGE:
- Venue names, addresses, dates, times
- The promoter's personal style and tone
- Sentence structure and order
- Any specific details (dress code, guest list, etc.)
- Emojis and their placement


Return ONLY a JSON object with this exact format:
{
  "items": [
    { "lang": "en", "content": "variation 1" },
    { "lang": "en", "content": "variation 2" },
    ...
  ]
}
Do not include any explanations, meta-commentary, or text outside the JSON object.`;


 