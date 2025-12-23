import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const config = {
  // AI Provider: "openai" or "gemini"
  aiProvider: process.env.AI_PROVIDER || "openai",

  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    imageModel: process.env.OPENAI_IMAGE_MODEL || "dall-e-3",
  },

  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL || "gemini-2.0-flash",
    imageModel: process.env.GEMINI_IMAGE_MODEL || "imagen-3.0-generate-002",
  },

  database: {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "3306", 10),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    name: process.env.DB_NAME || "story_agents",
  },
  storage: {
    basePath: process.env.STORAGE_PATH || path.join(__dirname, "..", "storage"),
    avatarsPath: path.join(
      process.env.STORAGE_PATH || path.join(__dirname, "..", "storage"),
      "avatars"
    ),
    pagesPath: path.join(
      process.env.STORAGE_PATH || path.join(__dirname, "..", "storage"),
      "pages"
    ),
  },
  image: {
    size: process.env.IMAGE_SIZE || "1024x1024",
    quality: process.env.IMAGE_QUALITY || "standard",
    style: process.env.IMAGE_STYLE || "vivid",
  },
  logging: {
    level: process.env.LOG_LEVEL || "info", // debug, info, warn, error, silent
  },
};

export default config;
