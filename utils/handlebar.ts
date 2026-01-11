/**
 * Simple function to replace variables in template strings
 * Replaces {variableName} with actual values from variables object
 * @param templateContent - Template string with variables (e.g., {name}, {eventType})
 * @param variables - Object containing variable values
 * @returns Rendered template string with variables replaced
 */
export function renderTemplate(
  templateContent: string,
  variables: Record<string, any>,
): string {
  let result = templateContent;
  
  // Replace all {variableName} with actual values
  for (const [key, value] of Object.entries(variables)) {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\{${escapedKey}\\}`, 'g');
    result = result.replace(regex, String(value || ''));
  }
  
  return result;
}

