#!/usr/bin/env node

import inquirer from "inquirer";
import chalk from "chalk";
import ora from "ora";
import { StoryOrchestrator, ART_STYLES } from "./agents/index.js";

// Build art style choices for inquirer
const artStyleChoices = [
  {
    name: chalk.cyan("🤖 Auto-detect") + chalk.gray(" - Let AI choose the best style for your story"),
    value: "auto",
  },
  new inquirer.Separator(chalk.gray("─── Predefined Styles ───")),
  ...Object.entries(ART_STYLES).map(([key, style]) => ({
    name: `${style.name}` + chalk.gray(` - ${style.description}`),
    value: key,
  })),
  new inquirer.Separator(chalk.gray("─────────────────────────")),
  {
    name: chalk.yellow("✏️  Custom") + chalk.gray(" - Enter your own art style prompt"),
    value: "custom",
  },
];

async function main() {
  console.log(chalk.cyan.bold("\n📖 Story Agents - AI Story Generator\n"));
  console.log(chalk.gray("Generate illustrated stories with AI-powered agents\n"));

  // Get story input
  const { storyInput } = await inquirer.prompt([
    {
      type: "editor",
      name: "storyInput",
      message: "Enter your story (an editor will open):",
      waitUserInput: true,
      default: `Once upon a time, in a magical forest, there lived a brave young fox named Felix. 
Felix had bright orange fur and curious green eyes. His best friend was Luna, a wise old owl with silver feathers.

One day, they discovered a mysterious glowing crystal deep in the forest. 
The crystal held the power to grant one wish, but it could only be used to help others.

Together, Felix and Luna embarked on a journey to find someone in need of the crystal's magic...`,
    },
  ]);

  // Get art style preference
  const { artStyleChoice } = await inquirer.prompt([
    {
      type: "list",
      name: "artStyleChoice",
      message: "Choose an art style:",
      choices: artStyleChoices,
      pageSize: 15,
    },
  ]);

  let artStyleKey = null;
  let customArtStyle = null;

  if (artStyleChoice === "auto") {
    // Will auto-detect
    console.log(chalk.gray("\n   AI will analyze your story and recommend the best art style.\n"));
  } else if (artStyleChoice === "custom") {
    const { customPrompt } = await inquirer.prompt([
      {
        type: "input",
        name: "customPrompt",
        message: "Enter your custom art style prompt:",
        default: "watercolor painting style, soft colors, dreamy atmosphere, artistic",
      },
    ]);
    customArtStyle = customPrompt;
  } else {
    artStyleKey = artStyleChoice;
    const selectedStyle = ART_STYLES[artStyleKey];
    console.log(chalk.gray(`\n   Selected: ${selectedStyle.name}`));
    console.log(chalk.gray(`   Best for: ${selectedStyle.bestFor.join(", ")}\n`));
  }

  // Get other options
  const options = await inquirer.prompt([
    {
      type: "number",
      name: "pageCount",
      message: "How many pages should the story have?",
      default: 6,
    },
    {
      type: "list",
      name: "targetAudience",
      message: "Who is the target audience?",
      choices: ["children", "young adults", "all ages"],
      default: "children",
    },
    {
      type: "confirm",
      name: "generateCover",
      message: "Generate a book cover?",
      default: true,
    },
  ]);

  console.log(chalk.cyan("\n🚀 Starting story generation...\n"));

  const spinner = ora();

  const orchestratorOptions = {
    ...options,
    artStyleKey: artStyleKey,
    artStyle: customArtStyle,
    autoDetectStyle: artStyleChoice === "auto",
    onPhaseStart: (phase, message) => {
      spinner.start(chalk.yellow(message));
    },
    onPhaseComplete: (phase, data) => {
      const phaseNames = {
        art_style_selection: "Art style selected",
        character_extraction: "Characters extracted",
        avatar_generation: "Avatars generated",
        page_generation: "Story pages created",
        illustration_generation: "Illustrations completed",
        cover_generation: "Cover generated",
      };
      spinner.succeed(chalk.green(phaseNames[phase] || phase));

      if (phase === "art_style_selection" && data) {
        const styleName = ART_STYLES[data.selectedStyle]?.name || data.selectedStyle;
        console.log(chalk.gray(`   Style: ${styleName}`));
        if (data.reasoning) {
          console.log(chalk.gray(`   Reason: ${data.reasoning.substring(0, 100)}...`));
        }
        if (data.storyAnalysis) {
          console.log(chalk.gray(`   Detected genre: ${data.storyAnalysis.genre}`));
          console.log(chalk.gray(`   Tone: ${data.storyAnalysis.tone}`));
        }
      }

      if (phase === "character_extraction") {
        console.log(chalk.gray(`   Found ${data.length} characters:`));
        data.forEach((char) => {
          console.log(chalk.gray(`   - ${char.name} (${char.role})`));
        });
      }
    },
    onProgress: (type, message, current, total) => {
      spinner.text = chalk.yellow(`${message} (${current}/${total})`);
    },
    onError: (error) => {
      spinner.fail(chalk.red(`Error: ${error.message}`));
    },
  };

  const orchestrator = new StoryOrchestrator(orchestratorOptions);

  try {
    const result = await orchestrator.generateStory(storyInput);

    console.log(chalk.green.bold("\n✨ Story generation complete!\n"));

    console.log(chalk.cyan("📊 Summary:"));
    console.log(chalk.white(`   Title: ${result.storyPages.title}`));
    console.log(chalk.white(`   Pages: ${result.storyPages.pages.length}`));
    console.log(chalk.white(`   Characters: ${result.characters.length}`));
    
    if (result.artStyleDecision) {
      const styleName = ART_STYLES[result.artStyleDecision.selectedStyle]?.name || result.artStyleDecision.selectedStyle;
      console.log(chalk.white(`   Art Style: ${styleName}`));
    }

    console.log(chalk.cyan("\n📁 Generated Files:"));
    result.characters.forEach((char) => {
      console.log(chalk.gray(`   Avatar: ${char.avatarPath}`));
    });
    result.storyPages.pages.forEach((page) => {
      console.log(chalk.gray(`   Page ${page.pageNumber}: ${page.illustrationPath}`));
    });
    if (result.cover) {
      console.log(chalk.gray(`   Cover: ${result.cover.illustrationPath}`));
    }
    console.log(chalk.gray(`   Full Output: ${result.outputPaths.fullOutput}`));

    console.log(chalk.cyan("\n🎉 All done! Your illustrated story is ready.\n"));
  } catch (error) {
    console.error(chalk.red(`\n❌ Failed to generate story: ${error.message}\n`));
    process.exit(1);
  }
}

// Show available styles command
if (process.argv.includes("--styles")) {
  console.log(chalk.cyan.bold("\n📚 Available Art Styles\n"));
  Object.entries(ART_STYLES).forEach(([key, style]) => {
    console.log(chalk.white.bold(`${style.name} (${key})`));
    console.log(chalk.gray(`   ${style.description}`));
    console.log(chalk.gray(`   Best for: ${style.bestFor.join(", ")}`));
    console.log();
  });
  process.exit(0);
}

main();
