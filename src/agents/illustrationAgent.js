import { generateImage } from "../services/ai.js";
import { saveImageFromUrl } from "../utils/storage.js";

/**
 * Illustration Agent - Generates page illustrations based on descriptions
 */
export class IllustrationAgent {
  constructor() {
    this.name = "IllustrationAgent";
    this.description =
      "Generates page illustrations using DALL-E based on scene descriptions";
  }

  /**
   * Generates illustration for a single page
   * @param {object} page - Page object with imageDescription
   * @param {string} storyTitle - Title of the story (for naming)
   * @param {object} options - Generation options
   * @returns {Promise<object>} - Page with generated illustration path
   */
  async generatePageIllustration(page, storyTitle, options = {}) {
    const artStyle =
      options.artStyle ||
      "children's book illustration style, colorful, warm, friendly";
    const enhancedPrompt = this.buildIllustrationPrompt(
      page.imageDescription,
      artStyle
    );

    const imageUrl = await generateImage(enhancedPrompt, {
      size: options.size || "1024x1024", // for Ipads
      quality: options.quality || "standard",
      style: options.style || "vivid",
    });

    const savedPath = await saveImageFromUrl(
      imageUrl,
      "page",
      `${storyTitle}_page_${page.pageNumber}`
    );

    return {
      ...page,
      illustrationUrl: imageUrl,
      illustrationPath: savedPath,
    };
  }

  /**
   * Generates illustrations for all pages
   * @param {object} storyPages - Story pages object
   * @param {object} options - Generation options
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<object>} - Story pages with illustrations
   */
  async generateAllIllustrations(storyPages, options = {}, onProgress = null) {
    const illustratedPages = [];

    for (let i = 0; i < storyPages.pages.length; i++) {
      const page = storyPages.pages[i];

      if (onProgress) {
        onProgress(page.pageNumber, i + 1, storyPages.pages.length);
      }

      const illustratedPage = await this.generatePageIllustration(
        page,
        storyPages.title,
        options
      );
      illustratedPages.push(illustratedPage);

      // Delay to avoid rate limiting
      if (i < storyPages.pages.length - 1) {
        await this.delay(2000);
      }
    }

    return {
      ...storyPages,
      pages: illustratedPages,
    };
  }

  /**
   * Builds optimized prompt for illustration generation
   * @param {string} description - Scene description
   * @param {string} artStyle - Art style to apply
   * @returns {string} - Optimized prompt
   */
  buildIllustrationPrompt(description, artStyle) {
    const compositionGuidelines = `COMPOSITION: Dont add any charecters at the top, Characters should be expressive, and well-detailed. Background should be softer. Characters should occupy less than 30% of the frame. The background should be a simple and convey the mood of the scene.`;

    const qualityEnhancements = `High quality, professional children's book illustration. Characters are the heroes of the image - make them stand out with brighter colors and sharper details than the environment.`;

    // Truncate if too long (DALL-E has limits)
    let truncatedDescription = description;
    if (description.length > 600) {
      truncatedDescription = description.substring(0, 600) + "...";
    }

    return `${compositionGuidelines} Art style: ${artStyle}. Scene: ${truncatedDescription}. ${qualityEnhancements}`;
  }

  /**
   * Generates a cover illustration for the story
   * @param {object} storyPages - Story pages object
   * @param {Array} characters - Main characters
   * @param {object} options - Generation options
   * @returns {Promise<object>} - Cover illustration info
   */
  async generateCoverIllustration(storyPages, characters, options = {}) {
    const mainCharacters = characters
      .filter((c) => c.role === "main")
      .map((c) => c.name)
      .join(", ");

    const title = storyPages.title;
    const artStyle =
      options.artStyle || "colorful children's book cover, magical, inviting";

    const coverPrompt = `Dont add any charecters at the top.
FOCUS: Main characters (${mainCharacters}) prominently displayed in the foreground and detailed, taking center stage. taking 30% of the frame.
Background: Soft, atmospheric, hints at the story setting but not overpowering.
Scene context: ${storyPages.summary}
Art style: ${artStyle}.
characters are the stars, background supports the mood.`;

    const imageUrl = await generateImage(coverPrompt, {
      size: "1024x1024",
      quality: "standard",
      style: "vivid",
    });

    const savedPath = await saveImageFromUrl(
      imageUrl,
      "page",
      `${storyPages.title}_cover`
    );

    return {
      type: "cover",
      title: storyPages.title,
      illustrationUrl: imageUrl,
      illustrationPath: savedPath,
    };
  }

  /**
   * Utility delay function
   * @param {number} ms - Milliseconds to delay
   */
  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export default IllustrationAgent;
