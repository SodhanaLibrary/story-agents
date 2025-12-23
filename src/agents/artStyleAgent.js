import { generateJsonResponse } from "../services/ai.js";

/**
 * Available art styles with their descriptions and DALL-E prompts
 */
export const ART_STYLES = {
  flatvector: {
    name: "Flat Vector",
    description:
      "Minimalist flat vector illustration with clean shapes and bold colors",
    prompt:
      "flat vector illustration, minimalist, clean shapes, sharp lines, bold and simple color palette, minimal shading, modern, digital art style",
    bestFor: [
      "modern stories",
      "educational content",
      "infographics",
      "simple and clear visuals",
    ],
  },
  illustration: {
    name: "Illustration",
    description:
      "Classic children's book illustration style, warm and inviting",
    prompt:
      "children's book illustration, warm colors, soft lighting, detailed, whimsical, hand-painted look",
    bestFor: [
      "children's stories",
      "fairy tales",
      "bedtime stories",
      "educational content",
    ],
  },
  cartoon: {
    name: "Cartoon",
    description: "Fun, exaggerated cartoon style with bold colors",
    prompt:
      "cartoon style, bold outlines, bright vibrant colors, exaggerated expressions, fun and playful, clean lines",
    bestFor: ["comedy", "adventure", "family stories", "lighthearted tales"],
  },
  comic: {
    name: "Comic",
    description: "Western comic book style with dynamic action",
    prompt:
      "comic book art style, dynamic poses, bold ink lines, cel shading, dramatic lighting, action-packed, superhero aesthetic",
    bestFor: ["action", "superhero", "adventure", "mystery"],
  },
  webtoon: {
    name: "Webtoon",
    description: "Korean webtoon style, modern and appealing",
    prompt:
      "webtoon art style, clean digital art, soft gradients, Korean manhwa influence, expressive characters, pastel and vibrant colors",
    bestFor: ["romance", "drama", "slice of life", "modern settings"],
  },
  manga: {
    name: "Manga",
    description: "Japanese manga style with expressive characters",
    prompt:
      "manga art style, Japanese comic style, detailed linework, screentone shading, expressive eyes, dynamic composition, black and white with accents",
    bestFor: ["drama", "action", "romance", "fantasy", "school life"],
  },
  caricature: {
    name: "Caricature",
    description: "Exaggerated features for humor and satire",
    prompt:
      "caricature art style, exaggerated features, humorous proportions, expressive faces, satirical, bold and playful",
    bestFor: ["comedy", "satire", "parody", "humorous stories"],
  },
  anime: {
    name: "Anime-style Art",
    description: "Japanese anime aesthetic with vibrant colors",
    prompt:
      "anime art style, Japanese animation style, vibrant colors, detailed eyes, clean linework, dynamic poses, cel-shaded, beautiful backgrounds",
    bestFor: ["fantasy", "adventure", "romance", "action", "magical stories"],
  },
  conceptart: {
    name: "Concept Art",
    description: "Professional concept art style for world-building",
    prompt:
      "concept art style, professional digital painting, atmospheric, detailed environment design, cinematic lighting, epic scale, painterly",
    bestFor: [
      "fantasy",
      "sci-fi",
      "world-building",
      "epic adventures",
      "games",
    ],
  },
  chibi: {
    name: "Chibi",
    description: "Cute, super-deformed style with big heads",
    prompt:
      "chibi art style, super deformed, cute characters, big heads, small bodies, adorable expressions, kawaii, pastel colors, simple backgrounds",
    bestFor: [
      "cute stories",
      "comedy",
      "children",
      "lighthearted",
      "kawaii content",
    ],
  },
  storyboard: {
    name: "Storyboard",
    description: "Cinematic storyboard style for sequential storytelling",
    prompt:
      "storyboard art style, sequential frames, cinematic composition, sketch-like quality, dynamic camera angles, grayscale with color accents, professional",
    bestFor: [
      "action sequences",
      "dramatic stories",
      "film-like narratives",
      "thrillers",
    ],
  },
  oil: {
    name: "Oil",
    description: "Oil painting art style with rich colors and textures",
    prompt:
      "oil painting art style, rich colors, textures, oil painting, rich lighting, detailed, whimsical, hand-painted look",
    bestFor: [
      "children's stories",
      "fairy tales",
      "bedtime stories",
      "educational content",
    ],
  },
  acrylic: {
    name: "Acrylic",
    description: "Acrylic painting art style with vibrant colors and textures",
    prompt:
      "acrylic painting art style, vibrant colors, textures, acrylic painting, vibrant lighting, detailed, whimsical, hand-painted look",
    bestFor: [
      "children's stories",
      "fairy tales",
      "bedtime stories",
      "educational content",
    ],
  },
  pastel: {
    name: "Pastel",
    description: "Pastel painting art style with soft colors and textures",
    prompt:
      "pastel painting art style, soft colors, textures, pastel painting, soft lighting, detailed, whimsical, hand-painted look",
    bestFor: [
      "children's stories",
      "fairy tales",
      "bedtime stories",
      "educational content",
    ],
  },
  pencil: {
    name: "Pencil",
    description: "Pencil drawing art style with soft colors and textures",
    prompt:
      "pencil drawing art style, soft colors, textures, pencil drawing, soft lighting, detailed, whimsical, hand-painted look",
    bestFor: [
      "children's stories",
      "fairy tales",
      "bedtime stories",
      "educational content",
    ],
  },
  charcoal: {
    name: "Charcoal",
    description: "Charcoal drawing art style with soft colors and textures",
    prompt:
      "charcoal drawing art style, soft colors, textures, charcoal drawing, soft lighting, detailed, whimsical, hand-painted look",
    bestFor: [
      "children's stories",
      "fairy tales",
      "bedtime stories",
      "educational content",
    ],
  },
  graphite: {
    name: "Graphite",
    description: "Graphite drawing art style with soft colors and textures",
    prompt:
      "graphite drawing art style, soft colors, textures, graphite drawing, soft lighting, detailed, whimsical, hand-painted look",
    bestFor: [
      "children's stories",
      "fairy tales",
      "bedtime stories",
      "educational content",
    ],
  },
  digital: {
    name: "Digital",
    description: "Digital art style with soft colors and textures",
    prompt:
      "digital art style, soft colors, textures, digital painting, soft lighting, detailed, whimsical, hand-painted look",
    bestFor: [
      "children's stories",
      "fairy tales",
      "bedtime stories",
      "educational content",
    ],
  },
  pixel: {
    name: "Pixel",
    description: "Pixel art style with soft colors and textures",
    prompt:
      "pixel art style, soft colors, textures, pixel painting, soft lighting, detailed, whimsical, hand-painted look",
    bestFor: [
      "children's stories",
      "fairy tales",
      "bedtime stories",
      "educational content",
    ],
  },
  abstract: {
    name: "Abstract",
    description: "Abstract art style with soft colors and textures",
    prompt:
      "abstract art style, soft colors, textures, abstract painting, soft lighting, detailed, whimsical, hand-painted look",
    bestFor: [
      "children's stories",
      "fairy tales",
      "bedtime stories",
      "educational content",
    ],
  },
  surreal: {
    name: "Surreal",
    description: "Surreal art style with soft colors and textures",
    prompt:
      "surreal art style, soft colors, textures, surreal painting, soft lighting, detailed, whimsical, hand-painted look",
    bestFor: [
      "children's stories",
      "fairy tales",
      "bedtime stories",
      "educational content",
    ],
  },
  popart: {
    name: "Pop Art",
    description: "Pop art style with soft colors and textures",
    prompt:
      "pop art style, soft colors, textures, pop painting, soft lighting, detailed, whimsical, hand-painted look",
    bestFor: [
      "children's stories",
      "fairy tales",
      "bedtime stories",
      "educational content",
    ],
  },
  graffiti: {
    name: "Graffiti",
    description: "Graffiti art style with soft colors and textures",
    prompt:
      "graffiti art style, soft colors, textures, graffiti painting, soft lighting, detailed, whimsical, hand-painted look",
    bestFor: [
      "children's stories",
      "fairy tales",
      "bedtime stories",
      "educational content",
    ],
  },
  neon: {
    name: "Neon",
    description: "Neon art style with soft colors and textures",
    prompt:
      "neon art style, soft colors, textures, neon painting, soft lighting, detailed, whimsical, hand-painted look",
    bestFor: [
      "children's stories",
      "fairy tales",
      "bedtime stories",
      "educational content",
    ],
  },
};

/**
 * Art Style Agent - Analyzes stories and recommends appropriate art styles
 */
export class ArtStyleAgent {
  constructor() {
    this.name = "ArtStyleAgent";
    this.description = "Analyzes stories to recommend the best art style";
    this.styles = ART_STYLES;
  }

  /**
   * Get all available art styles
   * @returns {object} - All art styles with details
   */
  getAvailableStyles() {
    return this.styles;
  }

  /**
   * Get style names as a list
   * @returns {Array} - Array of style objects with key and name
   */
  getStyleList() {
    return Object.entries(this.styles).map(([key, style]) => ({
      key,
      name: style.name,
      description: style.description,
    }));
  }

  /**
   * Analyzes a story and recommends the best art style
   * @param {string} story - The input story text
   * @returns {Promise<object>} - Recommended style with reasoning
   */
  async analyzeAndRecommend(story) {
    const styleDescriptions = Object.entries(this.styles)
      .map(
        ([key, style]) =>
          `- ${key}: ${style.name} - ${style.description}. Best for: ${style.bestFor.join(", ")}`
      )
      .join("\n");

    const systemPrompt = `You are an art director specializing in visual storytelling.
Analyze the given story and recommend the most suitable art style from the available options.

Consider these factors:
1. Story genre and themes
2. Target audience (children, teens, adults)
3. Tone and mood (light, dark, dramatic, comedic)
4. Setting and time period
5. Character types and dynamics
6. Pacing and action level

Available art styles:
${styleDescriptions}

Return a JSON object with:
{
  "recommendedStyle": "style_key",
  "confidence": 0.0-1.0,
  "reasoning": "Detailed explanation of why this style fits the story",
  "alternativeStyles": ["second_choice_key", "third_choice_key"],
  "storyAnalysis": {
    "genre": "detected genre",
    "targetAudience": "children|teens|adults|all ages",
    "tone": "light|dark|dramatic|comedic|mixed",
    "themes": ["theme1", "theme2"],
    "settingType": "fantasy|modern|historical|sci-fi|etc"
  }
}`;

    const userPrompt = `Analyze this story and recommend the best art style:

${story}`;

    const response = await generateJsonResponse([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);

    // Enrich response with full style details
    const recommendedStyleKey = response.recommendedStyle;
    const recommendedStyle = this.styles[recommendedStyleKey];

    return {
      ...response,
      styleDetails: recommendedStyle,
      stylePrompt: recommendedStyle?.prompt || this.styles.illustration.prompt,
      allStyles: this.getStyleList(),
    };
  }

  /**
   * Gets the DALL-E prompt for a specific style
   * @param {string} styleKey - The style key
   * @returns {string} - The DALL-E prompt for the style
   */
  getStylePrompt(styleKey) {
    const style = this.styles[styleKey.toLowerCase()];
    if (!style) {
      console.warn(`Unknown style: ${styleKey}, falling back to illustration`);
      return this.styles.illustration.prompt;
    }
    return style.prompt;
  }

  /**
   * Validates if a style key exists
   * @param {string} styleKey - The style key to validate
   * @returns {boolean} - Whether the style exists
   */
  isValidStyle(styleKey) {
    return styleKey.toLowerCase() in this.styles;
  }

  /**
   * Combines user preference with AI recommendation
   * @param {string} story - The story text
   * @param {string|null} userPreference - User's preferred style (optional)
   * @returns {Promise<object>} - Final style decision with details
   */
  async decideStyle(story, userPreference = null) {
    // If user specified a valid style, use it
    if (userPreference && this.isValidStyle(userPreference)) {
      const styleKey = userPreference.toLowerCase();
      const style = this.styles[styleKey];
      return {
        selectedStyle: styleKey,
        styleDetails: style,
        stylePrompt: style.prompt,
        source: "user_preference",
        reasoning: `User selected ${style.name} style`,
      };
    }

    // Otherwise, analyze and recommend
    const recommendation = await this.analyzeAndRecommend(story);
    return {
      selectedStyle: recommendation.recommendedStyle,
      styleDetails: recommendation.styleDetails,
      stylePrompt: recommendation.stylePrompt,
      source: "ai_recommendation",
      reasoning: recommendation.reasoning,
      confidence: recommendation.confidence,
      alternatives: recommendation.alternativeStyles,
      storyAnalysis: recommendation.storyAnalysis,
    };
  }

  /**
   * Enhances a base prompt with style-specific instructions
   * @param {string} basePrompt - The base image description
   * @param {string} styleKey - The style to apply
   * @returns {string} - Enhanced prompt with style
   */
  enhancePromptWithStyle(basePrompt, styleKey) {
    const stylePrompt = this.getStylePrompt(styleKey);
    return `${stylePrompt}. ${basePrompt}`;
  }
}

export default ArtStyleAgent;
