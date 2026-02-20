/**
 * Content moderation agent: detects pornographic / sexually explicit / NSFW content
 * in story text. Used before accepting open-story submissions and before saving
 * completed normal stories.
 */
import { generateCompletion } from "./ai.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("ContentModerator");

const SYSTEM_PROMPT = `You are a strict content moderator for a family-friendly story platform. Your job is to detect pornographic, sexually explicit, or obscene content.

Rules:
- Output ONLY a single JSON object. No other text, no markdown, no explanation.
- If the story text contains pornographic content, sexually explicit scenes, graphic sexual descriptions, obscene language used in a sexual context, or any content inappropriate for all ages, respond with: {"safe": false, "reason": "brief reason in one short phrase"}
- If the story is appropriate for all ages (no porn, no explicit sex, no obscene sexual content), respond with: {"safe": true}
- Romance, kissing, or non-explicit references are OK. Only flag clearly pornographic or sexually explicit material.`;

/**
 * Check story text for pornographic / NSFW content.
 * @param {string} text - Full story text to check (can be long; will be truncated if needed to stay within token limits)
 * @returns {Promise<{ safe: boolean, reason?: string }>} - safe: false if content is not allowed
 */
export async function checkStoryContent(text) {
  if (!text || typeof text !== "string") {
    return { safe: true };
  }

  const trimmed = text.trim();
  if (trimmed.length === 0) return { safe: true };

  // Truncate to ~12k chars to avoid token limits while still checking the story
  const maxLen = 12000;
  const toCheck = trimmed.length > maxLen ? trimmed.slice(0, maxLen) + "\n[...truncated]" : trimmed;

  const userPrompt = `Review the following story text and output only the JSON object as specified.\n\n---\n${toCheck}\n---`;

  try {
    const response = await generateCompletion(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      { temperature: 0.1, maxTokens: 128 },
    );

    const raw = (response || "").trim();
    // Strip possible markdown code block
    const jsonStr = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const parsed = JSON.parse(jsonStr);

    if (parsed && typeof parsed.safe === "boolean") {
      return {
        safe: parsed.safe,
        reason: parsed.reason && typeof parsed.reason === "string" ? parsed.reason : undefined,
      };
    }
    // Unexpected shape: treat as unsafe to be cautious
    logger.warn("Content moderator returned invalid shape, rejecting");
    return { safe: false, reason: "Moderation could not verify content" };
  } catch (err) {
    logger.error("Content moderation check failed:", err.message);
    // On API/parse errors, reject to be safe
    return { safe: false, reason: "Content check failed. Please try again." };
  }
}
