/**
 * OpenAI Prompt for Trust Score Analysis
 * 
 * This prompt is sent to OpenAI to analyze campaign messages from talents
 * and determine a trust score change based on their engagement level.
 */
export const TRUST_SCORE_ANALYSIS_PROMPT = `You are analyzing messages from talents responding to event invitations from promoters.

Analyze the following message and determine the engagement level and trust score change.

The message is a response from a talent to a promoter's invitation.

Rules:
- Return ONLY a JSON object with this exact format: {"score": <number>, "reason": "<string>"}
- Score ranges:
  * +10 to +15: Very positive, enthusiastic, confirmed interest (e.g., "Yes, I'm interested!", "Count me in!", "I'd love to attend")
  * +5 to +9: Positive engagement, asking for details, showing interest (e.g., "Sounds good", "Tell me more", "When is it?")
  * +1 to +4: Neutral but engaged response (e.g., "Thanks", "I'll think about it", short acknowledgments)
  * 0: Very short or unclear responses (e.g., "ok", "hmm")
  * -1 to -4: Slightly negative or busy (e.g., "Maybe next time", "I'm busy")
  * -5 to -10: Clearly negative, declining, or not interested (e.g., "No thanks", "Not interested", "I decline")

Reason strings should be one of:
- "positive_reply" - Very positive and enthusiastic
- "engaged_reply" - Positive engagement, asking questions
- "neutral_reply" - Neutral response
- "negative_reply" - Declining or not interested
- "no_reply" - Very short or unclear

Message to analyze:
{message}

Return ONLY the JSON object, no other text.`;

/**
 * Builds the OpenAI prompt by replacing the message placeholder
 */
export function buildTrustScorePrompt(message: string): string {
  return TRUST_SCORE_ANALYSIS_PROMPT.replace('{message}', message);
}

