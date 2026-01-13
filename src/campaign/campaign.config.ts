
// Template variable placeholders:
// {name} - Talent name
// {eventName} - Event name
// {eventType} - Event type
// {eventCity} - Event city
// {eventDate} - Event date
//
// Note: OpenAI generates messages from templates with spintax processing.

/**
 * OpenAI Prompt for Message Generation
 * 
 * This prompt is sent to OpenAI to generate a personalized message from a template
 * with variables replaced and spintax processed.
 */
export const MESSAGE_GENERATION_PROMPT = `You are generating a personalized message for an event invitation.

Given the following template with variables, generate a natural, personalized message by:
1. Replacing all variables (e.g., {name}, {eventType}) with the provided values
2. Processing spintax blocks (e.g., {Option 1|Option 2|Option 3}) by randomly selecting one option
3. Creating a natural, conversational message

Template:
{template}

Variables:
{variables}

Instructions:
- Replace all {variable} placeholders with the corresponding values from the Variables section
- For spintax blocks like {Option 1|Option 2|Option 3}, randomly select one option
- Generate a natural, personalized message that flows well
- Keep the tone professional but friendly

Return ONLY a JSON object with this exact format:
{
  "message": "the generated personalized message here"
}

Do not include any explanations, meta-commentary, or text outside the JSON object.`;

/**
 * Builds the OpenAI prompt for message generation
 */
export function buildMessageGenerationPrompt(template: string, variables: Record<string, string>): string {
  const variablesText = Object.entries(variables)
    .map(([key, value]) => `- ${key}: ${value}`)
    .join('\n');

  return MESSAGE_GENERATION_PROMPT
    .replace('{template}', template)
    .replace('{variables}', variablesText || 'No variables provided');
}
