import { generateJsonResponse } from "../services/ai.js";

/**
 * Character Agent - Extracts and describes characters from a story
 * with detailed visual consistency anchors for illustration generation
 */
export class CharacterAgent {
  constructor() {
    this.name = "CharacterAgent";
    this.description =
      "Extracts characters from stories and generates detailed avatar descriptions with visual consistency anchors";
  }

  /**
   * Extracts characters from a story and generates avatar descriptions
   * with detailed visual anchors for consistency across illustrations
   * @param {string} story - The input story text
   * @returns {Promise<Array>} - Array of character objects with descriptions
   */
  async extractCharacters(story) {
    const systemPrompt = `You are a character design specialist focused on VISUAL CONSISTENCY across multiple illustrations.

Your task is to:
1. Identify all characters mentioned in the story
2. Create a DETAILED CHARACTER SHEET for each character with EXACT visual specifications
3. These specifications will be used across ALL page illustrations - consistency is CRITICAL

Return a JSON object with the following structure:
{
  "characters": [
    {
      "name": "Character Name",
      "role": "main|supporting|minor",
      "description": "Brief character description for the story",
      "visualIdentity": {
        "species": "human|animal|fantasy creature|etc",
        "ageAppearance": "toddler|child (5-10)|teen|young adult|adult|elderly",
        "gender": "male|female|neutral",
        "bodyType": "slim|average|stocky|tall|short|etc",
        "skinTone": "EXACT shade (e.g., 'warm ivory', 'deep brown', 'pale peach', 'olive')",
        "hairStyle": "EXACT description (e.g., 'shoulder-length wavy', 'short spiky', 'long braided')",
        "hairColor": "EXACT color (e.g., 'chestnut brown', 'platinum blonde', 'jet black with blue highlights')",
        "beardStyle": "EXACT description (e.g., 'full beard', 'goatee', 'sideburns')",
        "beardColor": "EXACT color (e.g., 'brown', 'black', 'gray')",
        "eyeShape": "round|almond|narrow|large|etc",
        "eyeColor": "EXACT color (e.g., 'emerald green', 'deep chocolate brown', 'bright blue')",
        "distinctiveFeatures": ["freckles across nose", "small scar on left cheek", "dimples", "bushy eyebrows", etc],
        "primaryOutfit": {
          "top": "EXACT description with color (e.g., 'red and white striped sweater')",
          "bottom": "EXACT description with color (e.g., 'denim blue overalls')",
          "footwear": "EXACT description with color (e.g., 'yellow rain boots')",
          "accessories": ["round silver glasses", "blue backpack", "red bow in hair"]
        }
      },
      "avatarPrompt": "Complete SOLO portrait prompt combining all visual details - NO background",
      "consistencyTag": "SHORT visual ID tag to use in every scene (e.g., 'red-haired girl with freckles in striped sweater')"
    }
  ]
}

CRITICAL GUIDELINES:
1. Use SPECIFIC colors - never say "colorful" or "bright", say EXACTLY what color
2. Use SPECIFIC features - not "nice hair" but "shoulder-length wavy chestnut brown hair"
3. The "consistencyTag" is a SHORT (under 20 words) but UNIQUE identifier that MUST appear in EVERY illustration
4. For animals/creatures: describe fur/scale color, patterns, size, distinguishing marks
5. Outfit colors and patterns must be EXACT - these are visual anchors for consistency

Example consistencyTag: "small gray mouse with pink ears and a red polka-dot bow tie"
Example consistencyTag: "tall girl with long black braids, dark skin, wearing yellow raincoat"

The avatarPrompt should be a complete SOLO portrait description (no background, no other characters) that can generate a consistent character reference image.`;

    const userPrompt = `Extract all characters from the following story and generate detailed character sheets with exact visual specifications for illustration consistency:

${story}`;

    const response = await generateJsonResponse([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);

    // Ensure backward compatibility - generate consistencyTag if not present
    const characters = response.characters || [];
    return characters.map((char) => this.ensureConsistencyFields(char));
  }

  /**
   * Ensures character has all consistency fields, generating them if needed
   * @param {object} character - Character object
   * @returns {object} - Character with consistency fields
   */
  ensureConsistencyFields(character) {
    // If already has the new format, return as-is
    if (character.consistencyTag && character.visualIdentity) {
      return character;
    }

    // Generate consistencyTag from avatarPrompt if missing
    if (!character.consistencyTag) {
      // Extract key visual elements from avatarPrompt
      const prompt = character.avatarPrompt || character.description || "";
      // Take first 100 chars as a basic consistency tag
      character.consistencyTag = prompt.substring(0, 100);
    }

    // Create basic visualIdentity if missing
    if (!character.visualIdentity) {
      character.visualIdentity = {
        species: "human",
        description: character.avatarPrompt || character.description,
      };
    }

    return character;
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
