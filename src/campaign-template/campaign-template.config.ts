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
- First 3 variations start with: "Hey", "Hi", "Hello" 
- followed by the EXACT same message.
- Remaining 9 variations: change only 1-2 words maximum 
- per variation. The rest stays identical.
- NEVER change the meaning, tone, or structure.
- NEVER add new information or remove information.
- NEVER change emojis, names, venue names, dates, or times.
- Keep the same sentence length and style.

Return ONLY a JSON object with this exact format:
{
  "items": [
    { "lang": "en", "content": "variation 1" },
    { "lang": "en", "content": "variation 2" },
    ...
  ]
}
Do not include any explanations, meta-commentary, or text outside the JSON object.`;
