import config from "../../src/config.js";

/**
 * Register health and provider routes.
 * @param {import('express').Application} app
 */
export function registerHealthRoutes(app) {
  app.get("/api/v1/health", (req, res) => {
    res.json({
      status: "ok",
      aiProvider: config.aiProvider || "openai",
      providers: {
        openai: !!config.openai.apiKey,
        gemini: !!config.gemini.apiKey,
      },
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/api/v1/providers", (req, res) => {
    res.json({
      current: config.aiProvider || "openai",
      available: {
        openai: {
          enabled: !!config.openai.apiKey,
          model: config.openai.model,
          imageModel: config.openai.imageModel,
        },
        gemini: {
          enabled: !!config.gemini.apiKey,
          model: config.gemini.model,
          imageModel: config.gemini.imageModel,
        },
      },
    });
  });
}
