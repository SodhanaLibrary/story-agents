import { generateJsonResponse } from "../services/ai.js";

/**
 * Character Agent - Extracts and describes characters from a story
 */
export class CharacterAgent {
  constructor() {
    this.name = "CharacterAgent";
    this.description =
      "Extracts characters from stories and generates detailed avatar descriptions";
  }

  /**
   * Extracts characters from a story and generates avatar descriptions
   * @param {string} story - The input story text
   * @returns {Promise<Array>} - Array of character objects with descriptions
   */
  async extractCharacters(story) {
    const systemPrompt = `You are a character extraction and description specialist. 
Your task is to:
1. Identify all characters mentioned in the story (including main characters, supporting characters, and any named entities)
2. For each character, create a detailed visual description suitable for SOLO CHARACTER PORTRAIT generation
3. Include physical appearance, clothing style, age range, distinguishing features, and personality-driven visual cues

Return a JSON object with the following structure:
{
  "characters": [
    {
      "name": "Character Name",
      "role": "main|supporting|minor",
      "description": "Brief character description",
      "avatarPrompt": "Detailed visual description for DALL-E - SOLO character portrait only, describing: physical features, clothing, expression, pose. NO background description, NO other characters, NO scenery."
    }
  ]
}

IMPORTANT for avatarPrompt:
- Describe ONLY the single character - no other people/characters
- Do NOT describe any background or environment
- Focus on: face, body, clothing, expression, pose, colors, style
- Example good: "Young girl with curly red hair, bright green eyes, freckles, wearing a blue dress with white polka dots, cheerful smile, hands clasped together"
- Example bad: "A girl standing in a magical forest with her friend..."

Include art style direction like "digital art", "illustration style", "cartoon style" based on the story tone.`;

    const userPrompt = `Extract all characters from the following story and generate detailed avatar descriptions:

${story}`;

    const response = await generateJsonResponse([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);

    return response.characters || [];
  }

  /**
   * Refines a character description based on additional context
   * @param {object} character - Character object
   * @param {string} additionalContext - Additional context or requirements
   * @returns {Promise<object>} - Refined character object
   */
  async refineCharacterDescription(character, additionalContext) {
    const systemPrompt = `You are refining a character description for image generation.
Enhance the avatar prompt to be more detailed and specific while maintaining consistency with the character's established traits.

Return a JSON object with the refined character:
{
  "name": "${character.name}",
  "role": "${character.role}",
  "description": "refined description",
  "avatarPrompt": "enhanced detailed visual prompt"
}`;

    const userPrompt = `Original character:
${JSON.stringify(character, null, 2)}

Additional context/requirements:
${additionalContext}

Please refine and enhance this character's visual description.`;

    return await generateJsonResponse([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);
  }
}

export default CharacterAgent;
