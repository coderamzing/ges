import { TemplateType } from '@prisma/client';

export interface DefaultTemplate {
  lang: string;
  type: TemplateType;
  name: string;
  content: string;
  isActive: boolean;
}

export const DEFAULT_TEMPLATES: DefaultTemplate[] = [
  // English - Invitation Template (Spintax)
  {
    lang: 'en',
    type: TemplateType.invitation,
    name: 'Invitation',
    content: '{Hello {name},\n\nhope you had a great week! I\'m hosting {eventType} in {eventCity}. Would you like me to send more details?|Hi {name}, hope you\'re good!\n\nI\'m hosting {eventType} in {eventCity}. Would you like more details?|Hey {name}, I hope you had a great week!\n\nI\'m hosting {eventType} in {eventCity}. Can I send you more details?|{name}, I hope you\'re good!\n\nI\'m hosting {eventType} in {eventCity}. Would you like to hear more details?|Hi {name}, I hope you had a great week!\n\nI\'m hosting {eventType} in {eventCity}. Would you like me to share more details?}',
    isActive: true,
  },
  // French - Invitation Template (Spintax)
  {
    lang: 'fr',
    type: TemplateType.invitation,
    name: 'Invitation',
    content: '{Bonjour {name},\n\nj\'espère que tu as passé une excellente semaine ! J\'organise {eventType} à {eventCity}. Souhaites-tu que je t\'envoie plus de détails ?|Salut {name}, j\'espère que tout va bien !\n\nJ\'organise {eventType} à {eventCity}. Souhaites-tu plus de détails ?|Salut {name}, j\'espère que tu as passé une excellente semaine !\n\nJ\'organise {eventType} à {eventCity}. Puis-je t\'envoyer plus de détails ?|{name}, j\'espère que tout va bien !\n\nJ\'organise {eventType} à {eventCity}. Souhaites-tu en savoir plus ?|Salut {name}, j\'espère que tu as passé une excellente semaine !\n\nJ\'organise {eventType} à {eventCity}. Souhaites-tu que je partage plus de détails ?}',
    isActive: false,
  },
  // Italian - Invitation Template (Spintax)
  {
    lang: 'it',
    type: TemplateType.invitation,
    name: 'Invitation',
    content: '{Ciao {name},\n\nspero che tu abbia avuto una settimana fantastica! Sto organizzando {eventType} a {eventCity}. Vuoi che ti invii maggiori dettagli?|Ciao {name}, spero che tu stia bene!\n\nSto organizzando {eventType} a {eventCity}. Vuoi maggiori dettagli?|Ciao {name}, spero che tu abbia avuto una settimana fantastica!\n\nSto organizzando {eventType} a {eventCity}. Posso inviarti maggiori dettagli?|{name}, spero che tu stia bene!\n\nSto organizzando {eventType} a {eventCity}. Vuoi saperne di più?|Ciao {name}, spero che tu abbia avuto una settimana fantastica!\n\nSto organizzando {eventType} a {eventCity}. Vuoi che condivida maggiori dettagli?}',
    isActive: false,
  },
  // Spanish - Invitation Template (Spintax)
  {
    lang: 'es',
    type: TemplateType.invitation,
    name: 'Invitation',
    content: '{Hola {name},\n\n¡espero que hayas tenido una semana genial! Estoy organizando {eventType} en {eventCity}. ¿Te gustaría que te envíe más detalles?|Hola {name}, ¡espero que estés bien!\n\nEstoy organizando {eventType} en {eventCity}. ¿Te gustaría más detalles?|Hola {name}, ¡espero que hayas tenido una semana genial!\n\nEstoy organizando {eventType} en {eventCity}. ¿Puedo enviarte más detalles?|{name}, ¡espero que estés bien!\n\nEstoy organizando {eventType} en {eventCity}. ¿Te gustaría saber más detalles?|Hola {name}, ¡espero que hayas tenido una semana genial!\n\nEstoy organizando {eventType} en {eventCity}. ¿Te gustaría que comparta más detalles?}',
    isActive: false,
  },
  // English - Followup Template (Spintax)
  {
    lang: 'en',
    type: TemplateType.followup,
    name: 'Followup',
    content: '{Hi {name},\n\njust wanted to follow up on my previous message. Are you interested in learning more about {eventName} in {eventCity}?|Hey {name},\n\nwondering if you had a chance to see my message about {eventName} in {eventCity}. Would love to share more details if you\'re interested!|Hi {name},\n\nfollowing up on {eventName} I mentioned. If you\'re interested, I can send you all the details. Let me know!}',
    isActive: true,
  },
  // French - Followup Template (Spintax)
  {
    lang: 'fr',
    type: TemplateType.followup,
    name: 'Followup',
    content: '{Salut {name},\n\nje voulais juste faire un suivi de mon message précédent. Es-tu intéressée pour en savoir plus sur {eventName} à {eventCity} ?|Salut {name},\n\nje me demandais si tu as eu l\'occasion de voir mon message concernant {eventName} à {eventCity}. J\'aimerais partager plus de détails si tu es intéressée !|Salut {name},\n\nje fais un suivi concernant {eventName} que j\'ai mentionné. Si tu es intéressée, je peux t\'envoyer tous les détails. Dis-moi !}',
    isActive: false,
  },
  // Italian - Followup Template (Spintax)
  {
    lang: 'it',
    type: TemplateType.followup,
    name: 'Followup',
    content: '{Ciao {name},\n\nvolevo solo fare un follow-up del mio messaggio precedente. Sei interessata a saperne di più su {eventName} a {eventCity}?|Ciao {name},\n\nmi chiedevo se hai avuto la possibilità di vedere il mio messaggio su {eventName} a {eventCity}. Mi piacerebbe condividere maggiori dettagli se sei interessata!|Ciao {name},\n\nsto facendo un follow-up su {eventName} che ho menzionato. Se sei interessata, posso inviarti tutti i dettagli. Fammi sapere!}',
    isActive: false,
  },
  // Spanish - Followup Template (Spintax)
  {
    lang: 'es',
    type: TemplateType.followup,
    name: 'Followup',
    content: '{Hola {name},\n\nsolo quería hacer un seguimiento de mi mensaje anterior. ¿Estás interesada en saber más sobre {eventName} en {eventCity}?|Hola {name},\n\nme preguntaba si tuviste la oportunidad de ver mi mensaje sobre {eventName} en {eventCity}. ¡Me encantaría compartir más detalles si estás interesada!|Hola {name},\n\nhaciendo seguimiento de {eventName} que mencioné. Si estás interesada, puedo enviarte todos los detalles. ¡Avísame!}',
    isActive: false,
  },
  // English - Postevent Template (Spintax)
  {
    lang: 'en',
    type: TemplateType.postevent,
    name: 'Postevent',
    content: '{Hi {name},\n\nthank you so much for coming to {eventName} in {eventCity}! It was great to have you there. Hope to see you again soon!|Hey {name},\n\nthanks for being part of {eventName} in {eventCity}! Your presence made it special. Looking forward to the next one!|Hi {name},\n\nit was wonderful having you at {eventName} in {eventCity}. Thank you for coming! Can\'t wait to see you at the next gathering.}',
    isActive: true,
  },
  // French - Postevent Template (Spintax)
  {
    lang: 'fr',
    type: TemplateType.postevent,
    name: 'Postevent',
    content: '{Salut {name},\n\nmerci beaucoup d\'être venue à {eventName} à {eventCity} ! C\'était génial de t\'avoir là. J\'espère te revoir bientôt !|Salut {name},\n\nmerci d\'avoir fait partie de {eventName} à {eventCity} ! Ta présence l\'a rendu spécial. Hâte de faire le prochain !|Salut {name},\n\nc\'était merveilleux de t\'avoir à {eventName} à {eventCity}. Merci d\'être venue ! J\'ai hâte de te revoir au prochain rassemblement.}',
    isActive: false,
  },
  // Italian - Postevent Template (Spintax)
  {
    lang: 'it',
    type: TemplateType.postevent,
    name: 'Postevent',
    content: '{Ciao {name},\n\ngrazie mille per essere venuta a {eventName} a {eventCity}! È stato fantastico averti lì. Spero di rivederti presto!|Ciao {name},\n\ngrazie per aver fatto parte di {eventName} a {eventCity}! La tua presenza lo ha reso speciale. Non vedo l\'ora del prossimo!|Ciao {name},\n\nè stato meraviglioso averti a {eventName} a {eventCity}. Grazie per essere venuta! Non vedo l\'ora di rivederti al prossimo raduno.}',
    isActive: false,
  },
  // Spanish - Postevent Template (Spintax)
  {
    lang: 'es',
    type: TemplateType.postevent,
    name: 'Postevent',
    content: '{Hola {name},\n\n¡muchas gracias por venir a {eventName} en {eventCity}! Fue genial tenerte allí. ¡Espero verte de nuevo pronto!|Hola {name},\n\n¡gracias por ser parte de {eventName} en {eventCity}! Tu presencia lo hizo especial. ¡Esperando con ansias el próximo!|Hola {name},\n\nfue maravilloso tenerte en {eventName} en {eventCity}. ¡Gracias por venir! No puedo esperar a verte en la próxima reunión.}',
    isActive: false,
  },
];

export const DEFAULT_VARIATIONS_COUNT = 12;

/**
 * OpenAI prompt template for generating 12 unique template variations
 * Placeholders: {{typeDescription}}, {{language}}, {{templateContent}}
 */
export const TEMPLATE_VARIATION_PROMPT = `You are a professional copywriter specializing in creating engaging {{typeDescription}} templates.

Original Template Content (Language: {{language}}):
{{templateContent}}

Task: Generate exactly {{variationsCount}} unique variations of this template. Each variation should:
1. Maintain the same core message and intent as the original
2. Be written in {{language}} language
3. Preserve all template variables (e.g., {name}, {eventType}, {eventCity}, {eventName}) exactly as they appear
4. Be unique and different from all other variations
5. Maintain a natural, conversational tone
6. Be suitable for professional but friendly communication

Important: 
- Keep all template variables unchanged (e.g., {name}, {eventType}, {eventCity}, {eventName})
- Each variation should be a complete, standalone message
- Variations should differ in wording, sentence structure, and phrasing while conveying the same meaning

Return ONLY a JSON object with this exact format:
{
  "variations": ["variation 1 text here", "variation 2 text here", "variation 3 text here", ..., "variation N text here"]
}

The "variations" field must be a JSON array containing exactly {{variationsCount}} string elements.

Do not include any explanations, meta-commentary, or text outside the JSON object.`;
