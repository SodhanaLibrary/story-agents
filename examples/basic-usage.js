/**
 * Basic Usage Example for Story Agents
 *
 * This example demonstrates how to generate an illustrated story
 * using the Story Agents system with art style selection.
 *
 * Run with: node examples/basic-usage.js
 */

import {
  createStoryGenerator,
  analyzeStoryStyle,
  ART_STYLES,
} from "../src/index.js";

// Sample story input
const sampleStory = `
Once upon a time, in a cozy village nestled between rolling hills, 
there lived a curious little rabbit named Maple. She had soft brown fur 
and bright, inquisitive eyes that sparkled with wonder.

Maple's best friend was Oliver, a cheerful bluebird with shimmering feathers 
who loved to sing songs about far-away lands. Every morning, Oliver would 
perch on Maple's windowsill and tell her about the magnificent places 
he had seen on his flights.

One autumn day, Oliver flew to Maple with exciting news. "I've discovered 
a hidden garden beyond the Whispering Woods!" he chirped excitedly. 
"It's filled with flowers that glow in the moonlight!"

Maple's heart raced with excitement. Though she had never ventured 
beyond the village, she knew this was an adventure she couldn't miss. 
Together, Maple and Oliver set off on a journey that would change 
their lives forever.

They traveled through the golden meadows, crossed the Babbling Brook 
on stepping stones, and finally reached the edge of the Whispering Woods. 
The trees seemed to whisper secrets as the wind rustled through their leaves.

Deep in the woods, they found the magical garden. Flowers of every color 
imaginable bloomed in patterns that seemed to dance. And just as Oliver 
had said, as the sun set and the moon rose, the flowers began to glow 
with a soft, enchanting light.

Maple realized that the most wonderful adventures are the ones shared 
with true friends. From that day on, she and Oliver visited the magical 
garden every full moon, creating memories that would last a lifetime.
`;

async function main() {
  console.log("🚀 Story Agents - Art Style Demo\n");

  // Show available art styles
  console.log("📚 Available Art Styles:");
  Object.entries(ART_STYLES).forEach(([key, style]) => {
    console.log(`   • ${style.name} (${key})`);
  });
  console.log();

  // Analyze story for recommended style
  console.log("🔍 Analyzing story for best art style...\n");
  const styleAnalysis = await analyzeStoryStyle(sampleStory);

  console.log(
    `   Recommended: ${ART_STYLES[styleAnalysis.recommendedStyle]?.name}`
  );
  console.log(`   Confidence: ${(styleAnalysis.confidence * 100).toFixed(0)}%`);
  console.log(`   Reason: ${styleAnalysis.reasoning}\n`);

  if (styleAnalysis.storyAnalysis) {
    console.log("   Story Analysis:");
    console.log(`   - Genre: ${styleAnalysis.storyAnalysis.genre}`);
    console.log(`   - Audience: ${styleAnalysis.storyAnalysis.targetAudience}`);
    console.log(`   - Tone: ${styleAnalysis.storyAnalysis.tone}`);
    console.log(
      `   - Themes: ${styleAnalysis.storyAnalysis.themes?.join(", ")}`
    );
    console.log();
  }

  if (styleAnalysis.alternativeStyles) {
    console.log(
      `   Alternative styles: ${styleAnalysis.alternativeStyles.join(", ")}\n`
    );
  }

  // Generate with auto-detected style
  console.log("🎨 Generating story with auto-detected style...\n");

  const generator = createStoryGenerator({
    pageCount: 4,
    targetAudience: "children",
    autoDetectStyle: true, // Let AI decide the best style
    generateCover: true,

    onPhaseStart: (phase, message) => {
      console.log(`📍 ${message}`);
    },

    onPhaseComplete: (phase, data) => {
      if (phase === "art_style_selection") {
        const styleName =
          ART_STYLES[data.selectedStyle]?.name || data.selectedStyle;
        console.log(`   ✅ Selected style: ${styleName}`);
      } else if (phase === "character_extraction") {
        console.log(`   ✅ Found ${data.length} characters`);
      } else if (phase === "page_generation") {
        console.log(`   ✅ Created ${data.pages.length} pages`);
      } else {
        console.log(`   ✅ Complete`);
      }
    },

    onProgress: (type, message, current, total) => {
      console.log(`   ⏳ ${message} (${current}/${total})`);
    },
  });

  try {
    const result = await generator.generateStory(sampleStory);

    console.log("\n" + "=".repeat(60));
    console.log("✨ STORY GENERATION COMPLETE ✨");
    console.log("=".repeat(60));

    console.log(`\n📚 Story: ${result.storyPages.title}`);
    console.log(
      `🎨 Art Style: ${ART_STYLES[result.artStyleDecision?.selectedStyle]?.name}`
    );
    console.log(`📄 Pages: ${result.storyPages.pages.length}`);
    console.log(`👥 Characters: ${result.characters.length}`);

    console.log(`\n📁 Output: ${result.outputPaths.fullOutput}`);
    console.log("\n🎉 Done!\n");

    return result;
  } catch (error) {
    console.error("\n❌ Failed to generate story:", error.message);
    throw error;
  }
}

// Example with specific style selection
async function generateWithStyle(story, styleKey) {
  console.log(`\n🎨 Generating with ${ART_STYLES[styleKey]?.name} style...\n`);

  const generator = createStoryGenerator({
    pageCount: 4,
    artStyleKey: styleKey, // Use specific style
    generateCover: true,
  });

  return await generator.generateStory(story);
}

// Run the example
main().catch(console.error);
