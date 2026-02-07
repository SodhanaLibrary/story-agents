import { generateJsonResponse } from "../services/ai.js";

/**
 * Page Agent - Generates story pages with text and image descriptions
 * with enhanced character consistency across all illustrations
 */
export class PageAgent {
  constructor() {
    this.name = "PageAgent";
    this.description =
      "Generates story pages with text, image descriptions, and consistent character references";
    this.minPages = 4;
    this.maxPages = 20;
  }

  /**
   * Estimates optimal page count based on story length
   * @param {string} story - The story text
   * @returns {number} - Recommended page count
   */
  estimatePageCount(story) {
    const wordCount = story.trim().split(/\s+/).length;
    const paragraphCount = story.trim().split(/\n\n+/).length;

    let recommendedPages;

    if (wordCount < 150) {
      recommendedPages = 4;
    } else if (wordCount < 300) {
      recommendedPages = 5;
    } else if (wordCount < 500) {
      recommendedPages = 6;
    } else if (wordCount < 700) {
      recommendedPages = 8;
    } else if (wordCount < 1000) {
      recommendedPages = 10;
    } else if (wordCount < 1500) {
      recommendedPages = 12;
    } else if (wordCount < 2000) {
      recommendedPages = 14;
    } else {
      recommendedPages = Math.min(this.maxPages, Math.ceil(wordCount / 150));
    }

    // Adjust based on paragraph count (more paragraphs = more natural breaks)
    if (paragraphCount > recommendedPages * 1.5) {
      recommendedPages = Math.min(this.maxPages, recommendedPages + 2);
    }

    return Math.max(this.minPages, Math.min(this.maxPages, recommendedPages));
  }

  /**
   * Generates pages for a story
   * @param {string} story - The input story text
   * @param {Array} characters - Array of character objects with avatars
   * @param {object} options - Page generation options
   * @returns {Promise<object>} - Story structure with pages
   */
  async generatePages(story, characters, options = {}) {
    // Auto-determine page count if not explicitly provided
    const pageCount = options.pageCount || this.estimatePageCount(story);
    const targetAudience = options.targetAudience || "children";

    // Build detailed character reference with consistency tags
    const characterList = characters
      .map((c) => {
        const consistencyTag =
          c.consistencyTag ||
          c.avatarPrompt?.substring(0, 100) ||
          c.description;
        return `- ${c.name} (${c.role}): ${c.description}\n  VISUAL ID: ${consistencyTag}`;
      })
      .join("\n");

    const systemPrompt = `You are a professional storybook creator focused on DYNAMIC, ACTION-FILLED illustrations with VISUAL CONSISTENCY.
Your task is to break down a story into illustrated pages for a ${targetAudience}'s book.

For each page, provide:
1. The text/narrative for that page
2. A detailed image description that captures the ACTION and EMOTION of the moment
3. List of characters appearing on that page
4. The specific ACTION happening (what characters are DOING)
5. Scene description, mood, and emotion

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
      "action": "SPECIFIC action happening - verb-driven (e.g., 'running through the forest', 'hugging tightly', 'climbing the tree')",
      "emotion": "The emotional expression (e.g., 'terrified', 'overjoyed', 'curious', 'determined')",
      "imageDescription": "Dynamic scene description focusing on CHARACTER ACTION and EMOTION",
      "characters": ["Character Name 1", "Character Name 2"],
      "scene": "The setting/location",
      "mood": "emotional tone of the page"
    }
  ]
}

CHARACTER REFERENCE (use these EXACT visual descriptions):
${characterList}

CRITICAL: CAPTURE THE STORY ACTION IN EACH IMAGE
Each imageDescription MUST include:
1. WHO: Character with their visual ID (brief - just key identifiers like hair color, outfit)
2. WHAT: The SPECIFIC ACTION they are doing (running, jumping, crying, laughing, reaching, falling, etc.)
3. HOW: Their EMOTION and body language (eyes wide with fear, grinning with excitement, shoulders slumped with sadness)
4. WHERE: Brief background context

EXAMPLE GOOD imageDescription:
"Luna, the girl with long silver hair in a blue cloak, is LEAPING across the stepping stones, arms outstretched for balance, her face lit with determination. Behind her, a misty river with glowing fireflies."

EXAMPLE BAD imageDescription:
"Luna stands in the forest. She has silver hair and wears a blue cloak. The forest is beautiful with trees."

The action words (LEAPING, REACHING, CRYING, LAUGHING, RUNNING, HIDING) are what make illustrations come ALIVE!

CONSISTENCY RULES:
- Same hair color, outfit, and features across ALL pages
- Use EXACT same color words every time

ACTION VERBS TO USE: running, jumping, climbing, falling, reaching, hugging, crying, laughing, hiding, discovering, gasping, pointing, dancing, spinning, crawling, swimming, flying, fighting, sleeping, eating, playing, building, breaking, opening, closing, pulling, pushing, throwing, catching`;

    const userPrompt = `Create ${pageCount} illustrated pages for the following story:

${story}

Break it down into engaging pages suitable for ${targetAudience}. 
IMPORTANT: Each page illustration MUST capture a SPECIFIC ACTION moment from the story - characters DOING something dynamic, not just standing or posing.`;

    const response = await generateJsonResponse([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);

    return response;
  }

  /**
   * Builds a concise character visual reference (just key identifiers)
   * @param {object} character - Character object
   * @returns {string} - Short visual identifier
   */
  buildShortCharacterRef(character) {
    if (!character) return "";

    // Use consistencyTag if available (already short)
    if (character.consistencyTag) {
      return character.consistencyTag;
    }

    // Build from visual identity
    const vi = character.visualIdentity;
    if (vi) {
      const parts = [];
      if (vi.hairColor) parts.push(`${vi.hairColor} hair`);
      if (vi.primaryOutfit?.top) parts.push(vi.primaryOutfit.top);
      if (vi.distinctiveFeatures?.[0]) parts.push(vi.distinctiveFeatures[0]);
      if (parts.length > 0) return parts.join(", ");
    }

    // Fallback: extract key details from avatarPrompt
    const prompt = character.avatarPrompt || character.description || "";
    return prompt.substring(0, 60);
  }

  /**
   * Enhances image descriptions with ACTION-focused structure
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
      // Get action and emotion from page (new fields we're adding)
      const action = page.action || "";
      const emotion = page.emotion || page.mood || "";

      // Build character references with their visual IDs
      const charRefs = (page.characters || [])
        .map((charName) => {
          const character = characterMap.get(charName.toLowerCase());
          if (!character) return charName;
          const shortRef = this.buildShortCharacterRef(character);
          return `${charName} (${shortRef})`;
        })
        .join("; ");

      // Build the ACTION-focused description
      // Structure: [WHO with visual ID] is [ACTION] with [EMOTION]. [SCENE CONTEXT]
      let enhancedDescription;

      if (action && charRefs) {
        // Best case: we have action and characters
        enhancedDescription = `${charRefs} - ACTION: ${action}, EMOTION: ${emotion}. ${page.imageDescription}`;
      } else if (charRefs) {
        // We have characters but action is embedded in imageDescription
        enhancedDescription = `${charRefs}. ${page.imageDescription}`;
      } else {
        // Fallback to original
        enhancedDescription = page.imageDescription;
      }

      // Add scene context if available
      if (page.scene && !enhancedDescription.includes(page.scene)) {
        enhancedDescription += ` Setting: ${page.scene}.`;
      }

      return {
        ...page,
        imageDescription: enhancedDescription,
        originalDescription: page.imageDescription,
        charactersInScene: page.characters || [],
        action: action,
        emotion: emotion,
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
