import { generateJsonResponse } from "../services/ai.js";

/**
 * Page Agent - Generates story pages with text and image descriptions
 */
export class PageAgent {
  constructor() {
    this.name = "PageAgent";
    this.description =
      "Generates story pages with text, image descriptions, and character references";
  }

  /**
   * Generates pages for a story
   * @param {string} story - The input story text
   * @param {Array} characters - Array of character objects with avatars
   * @param {object} options - Page generation options
   * @returns {Promise<object>} - Story structure with pages
   */
  async generatePages(story, characters, options = {}) {
    const pageCount = options.pageCount || 8;
    const targetAudience = options.targetAudience || "children";

    const characterList = characters
      .map((c) => `- ${c.name} (${c.role}): ${c.description}`)
      .join("\n");

    const systemPrompt = `You are a professional storybook creator.
Your task is to break down a story into illustrated pages for a ${targetAudience}'s book.

For each page, provide:
1. The text/narrative for that page (appropriate length for the target audience)
2. A detailed image description for illustration
3. List of characters appearing on that page
4. Scene description and mood

Return a JSON object with this structure:
{
  "title": "Story Title",
  "summary": "Brief story summary",
  "targetAudience": "${targetAudience}",
  "totalPages": ${pageCount},
  "pages": [
    {
      "pageNumber": 1,
      "text": "The narrative text for this page",
      "imageDescription": "Detailed description for image generation - CHARACTERS FIRST, then background",
      "characters": ["Character Name 1", "Character Name 2"],
      "scene": "Brief scene description",
      "mood": "emotional tone of the page"
    }
  ]
}

Available characters:
${characterList}

CRITICAL IMAGE DESCRIPTION GUIDELINES:
- START with character descriptions - their poses, expressions, actions, and emotions
- Characters should be described as PROMINENT, and in the FOREGROUND and should occupy less than 30% of the frame.
- Describe character details: facial expressions, body language, what they're doing
- THEN describe the background/environment briefly - keep it simple and supportive
- Background should be described as "soft", "atmospheric", or "subtle" - never overpowering
- Example good format: "[Character] stands in the foreground, eyes wide with wonder, reaching out excitedly. Behind them, a soft, dreamy forest glade with gentle light filtering through."
- Example bad format: "A vast magical forest with towering trees and glowing mushrooms, where [Character] can be seen."

General Guidelines:
- Keep page text concise and engaging
- Characters are the STARS - describe them prominently
- Ensure character consistency by referencing their established descriptions
- Create a clear narrative flow across pages
- Include a mix of action, dialogue, and descriptive scenes`;

    const userPrompt = `Create ${pageCount} illustrated pages for the following story:

${story}

Break it down into engaging pages suitable for ${targetAudience}, with detailed image descriptions for each page.`;

    const response = await generateJsonResponse([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);

    return response;
  }

  /**
   * Enhances image descriptions with character visual details
   * @param {object} storyPages - Story pages object
   * @param {Array} characters - Characters with avatar descriptions
   * @returns {object} - Enhanced story pages
   */
  enhanceImageDescriptions(storyPages, characters) {
    const characterMap = new Map();
    characters.forEach((c) => {
      characterMap.set(c.name.toLowerCase(), c);
    });

    const enhancedPages = storyPages.pages.map((page) => {
      let enhancedDescription = page.imageDescription;

      // Add character visual details to image description
      page.characters.forEach((charName) => {
        const character = characterMap.get(charName.toLowerCase());
        if (character) {
          enhancedDescription += ` ${charName} appears as: ${character.avatarPrompt}.`;
        }
      });

      return {
        ...page,
        imageDescription: enhancedDescription,
        enhancedForGeneration: true,
      };
    });

    return {
      ...storyPages,
      pages: enhancedPages,
    };
  }
}

export default PageAgent;
