import { generateJsonResponse } from "../services/ai.js";

/**
 * Page Count Agent - Analyzes stories to recommend optimal page count
 */
export class PageCountAgent {
  constructor() {
    this.name = "PageCountAgent";
    this.description =
      "Analyzes stories to recommend the optimal number of illustrated pages";
    this.minPages = 4;
    this.maxPages = 20;
  }

  /**
   * Analyzes a story and recommends the optimal page count
   * @param {string} story - The input story text
   * @param {object} options - Additional options
   * @returns {Promise<object>} - Recommended page count with reasoning
   */
  async analyzeAndRecommend(story, options = {}) {
    const targetAudience = options.targetAudience || "children";

    const systemPrompt = `You are an expert children's book editor and layout specialist.
Analyze the given story and recommend the optimal number of illustrated pages.

Consider these factors:
1. **Story Length**: Word count and overall content volume
2. **Scene Count**: Number of distinct scenes or locations
3. **Key Events**: Major plot points that deserve their own illustration
4. **Emotional Beats**: Important emotional moments worth highlighting
5. **Character Introductions**: When characters are first introduced
6. **Pacing**: Natural breaks and transitions in the narrative
7. **Target Audience**: ${targetAudience} - shorter attention spans need fewer, more impactful pages
8. **Text per Page**: Each page should have 2-4 sentences for children, more for older audiences

Guidelines by story length:
- Very short (under 200 words): 4-6 pages
- Short (200-500 words): 6-8 pages
- Medium (500-1000 words): 8-12 pages
- Long (1000-2000 words): 12-16 pages
- Very long (over 2000 words): 16-20 pages

Return a JSON object with:
{
  "recommendedPageCount": number,
  "minPageCount": number,
  "maxPageCount": number,
  "confidence": 0.0-1.0,
  "reasoning": "Detailed explanation",
  "storyAnalysis": {
    "wordCount": number,
    "estimatedSceneCount": number,
    "keyEventCount": number,
    "emotionalBeats": number,
    "characterCount": number,
    "complexity": "simple|moderate|complex",
    "pacing": "fast|moderate|slow"
  },
  "pageBreakdown": [
    {
      "pageNumber": 1,
      "suggestedContent": "Brief description of what this page should cover",
      "type": "introduction|rising_action|climax|resolution|conclusion"
    }
  ]
}`;

    const userPrompt = `Analyze this story and recommend the optimal number of illustrated pages for a ${targetAudience}'s book:

${story}

Consider natural scene breaks, key moments worth illustrating, and appropriate pacing for the target audience.`;

    const response = await generateJsonResponse([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);

    // Ensure page count is within bounds
    const recommendedPages = Math.max(
      this.minPages,
      Math.min(this.maxPages, response.recommendedPageCount || 6)
    );

    return {
      ...response,
      recommendedPageCount: recommendedPages,
      minPageCount: Math.max(
        this.minPages,
        response.minPageCount || recommendedPages - 2
      ),
      maxPageCount: Math.min(
        this.maxPages,
        response.maxPageCount || recommendedPages + 2
      ),
    };
  }

  /**
   * Quick estimation based on word count (no API call)
   * @param {string} story - The story text
   * @returns {object} - Quick page count estimate
   */
  quickEstimate(story) {
    const wordCount = story.trim().split(/\s+/).length;
    const paragraphCount = story.trim().split(/\n\n+/).length;

    let recommendedPages;
    let complexity;

    if (wordCount < 200) {
      recommendedPages = 4;
      complexity = "simple";
    } else if (wordCount < 500) {
      recommendedPages = 6;
      complexity = "simple";
    } else if (wordCount < 800) {
      recommendedPages = 8;
      complexity = "moderate";
    } else if (wordCount < 1200) {
      recommendedPages = 10;
      complexity = "moderate";
    } else if (wordCount < 1800) {
      recommendedPages = 12;
      complexity = "moderate";
    } else if (wordCount < 2500) {
      recommendedPages = 14;
      complexity = "complex";
    } else {
      recommendedPages = Math.min(20, Math.ceil(wordCount / 150));
      complexity = "complex";
    }

    return {
      recommendedPageCount: recommendedPages,
      minPageCount: Math.max(this.minPages, recommendedPages - 2),
      maxPageCount: Math.min(this.maxPages, recommendedPages + 4),
      confidence: 0.6,
      reasoning: `Quick estimate based on ${wordCount} words and ${paragraphCount} paragraphs`,
      storyAnalysis: {
        wordCount,
        paragraphCount,
        complexity,
        averageWordsPerPage: Math.round(wordCount / recommendedPages),
      },
    };
  }

  /**
   * Validates if a page count is appropriate for a story
   * @param {string} story - The story text
   * @param {number} pageCount - Proposed page count
   * @returns {object} - Validation result
   */
  validatePageCount(story, pageCount) {
    const quickEst = this.quickEstimate(story);
    const wordsPerPage = quickEst.storyAnalysis.wordCount / pageCount;

    let isValid = true;
    let warnings = [];
    let suggestions = [];

    if (pageCount < this.minPages) {
      isValid = false;
      warnings.push(
        `Page count (${pageCount}) is below minimum (${this.minPages})`
      );
      suggestions.push(`Increase to at least ${this.minPages} pages`);
    }

    if (pageCount > this.maxPages) {
      isValid = false;
      warnings.push(
        `Page count (${pageCount}) exceeds maximum (${this.maxPages})`
      );
      suggestions.push(`Reduce to at most ${this.maxPages} pages`);
    }

    if (wordsPerPage < 15) {
      warnings.push("Too few words per page - pages may feel empty");
      suggestions.push("Consider reducing page count or adding more narrative");
    }

    if (wordsPerPage > 100) {
      warnings.push("Too many words per page - may overwhelm young readers");
      suggestions.push("Consider increasing page count");
    }

    return {
      isValid,
      pageCount,
      wordsPerPage: Math.round(wordsPerPage),
      recommendedRange: {
        min: quickEst.minPageCount,
        max: quickEst.maxPageCount,
        optimal: quickEst.recommendedPageCount,
      },
      warnings,
      suggestions,
    };
  }

  /**
   * Suggests page breaks for a story
   * @param {string} story - The story text
   * @param {number} pageCount - Target page count
   * @returns {Promise<object>} - Suggested page breaks
   */
  async suggestPageBreaks(story, pageCount) {
    const systemPrompt = `You are a children's book layout specialist.
Divide the given story into exactly ${pageCount} pages for an illustrated book.

For each page, identify:
1. The text that should appear on that page
2. A brief description of what the illustration should show
3. The narrative purpose (introduction, rising action, climax, etc.)

Return JSON:
{
  "pages": [
    {
      "pageNumber": 1,
      "text": "The actual story text for this page",
      "illustrationSuggestion": "Brief description of what to illustrate",
      "narrativePurpose": "introduction|rising_action|climax|falling_action|resolution",
      "mood": "The emotional tone of this page"
    }
  ],
  "notes": "Any additional layout suggestions"
}`;

    const userPrompt = `Divide this story into exactly ${pageCount} pages:

${story}`;

    return await generateJsonResponse([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);
  }
}

export default PageCountAgent;
