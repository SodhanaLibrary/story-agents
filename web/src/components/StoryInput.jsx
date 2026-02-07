import { useState, useEffect } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Stack,
  Chip,
  CircularProgress,
} from "@mui/material";
import { AutoStories, ArrowForward } from "@mui/icons-material";

const sampleStories = [
  {
    title: "Forest Adventure",
    preview: "A brave rabbit and wise owl discover a magical garden...",
    story: `Once upon a time, in a cozy village nestled between rolling hills, there lived a curious little rabbit named Maple. She had soft brown fur and bright, inquisitive eyes that sparkled with wonder.

Maple's best friend was Oliver, a cheerful bluebird with shimmering feathers who loved to sing songs about far-away lands. Every morning, Oliver would perch on Maple's windowsill and tell her about the magnificent places he had seen on his flights.

One autumn day, Oliver flew to Maple with exciting news. "I've discovered a hidden garden beyond the Whispering Woods!" he chirped excitedly. "It's filled with flowers that glow in the moonlight!"

Together, they embarked on a journey through golden meadows and across the Babbling Brook. Deep in the woods, they found the magical garden where flowers of every color bloomed and glowed with enchanting light as the moon rose.

Maple realized that the most wonderful adventures are the ones shared with true friends.`,
  },
  {
    title: "Space Explorer",
    preview: "A young astronaut discovers a planet of living crystals...",
    story: `In the year 2150, twelve-year-old Luna was the youngest astronaut ever selected for the Galactic Discovery Program. With her robot companion, Spark, she piloted the starship Aurora through the cosmos.

One day, their sensors detected an unusual signal from an uncharted planet. As they descended through purple clouds, they discovered a world made entirely of living crystals that sang in harmonious frequencies.

The Crystal Beings welcomed Luna with curious melodies. They communicated through light and sound, teaching her about the universe's hidden music. Luna learned that every star had its own song, and together they created the symphony of space.

When it was time to leave, the Crystal Beings gifted Luna a small singing crystal to remember them by. She returned to Earth with a new understanding: the universe was alive with wonder, waiting to be discovered.`,
  },
  {
    title: "Dragon Friend",
    preview: "A lonely princess befriends a misunderstood dragon...",
    story: `Princess Ember lived in a tall tower, not because she was trapped, but because she loved watching the stars. One stormy night, she spotted a small dragon with emerald scales shivering on her balcony.

"Don't be afraid," Ember whispered. The dragon, named Sage, had been separated from his family during the storm. He wasn't fierce at all—he was gentle and loved to blow tiny smoke rings.

Ember decided to help Sage find his way home. Together they flew over misty mountains and enchanted forests. Along the way, Sage's fire helped light their path, while Ember read the stars to navigate.

When they finally found Sage's family in the Valley of Dragons, they celebrated with a magnificent display of colored flames. The dragons welcomed Ember as an honorary member of their clan, and she visited every full moon, forever connected to her dragon friend.`,
  },
];

function StoryInput({ onSubmit, saving = false, initialStory = "" }) {
  const [story, setStory] = useState(initialStory);
  const [error, setError] = useState("");

  // Sync with initial story
  useEffect(() => {
    if (initialStory && !story) {
      setStory(initialStory);
    }
  }, [initialStory]);

  const handleSubmit = () => {
    if (story.trim().length < 100) {
      setError("Please write at least 100 characters for your story");
      return;
    }
    setError("");
    onSubmit(story);
  };

  const handleSampleClick = (sampleStory) => {
    setStory(sampleStory);
    setError("");
  };

  const wordCount = story.trim().split(/\s+/).filter(w => w.length > 0).length;

  return (
    <Box className="fade-in">
      <Box sx={{ textAlign: "center", mb: 4 }}>
        <Typography variant="h2" sx={{ mb: 2, color: "primary.main" }}>
          Write Your Story
        </Typography>
        <Typography variant="body1" sx={{ color: "text.secondary", maxWidth: 600, mx: "auto" }}>
          Enter your story below, and our AI will transform it into a beautifully illustrated book
          with unique characters and artwork. The number of pages will be automatically determined based on your story.
        </Typography>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <TextField
            fullWidth
            multiline
            rows={12}
            placeholder="Once upon a time..."
            value={story}
            onChange={(e) => {
              setStory(e.target.value);
              setError("");
            }}
            error={!!error}
            helperText={error || `${story.length} characters · ${wordCount} words`}
            sx={{
              "& .MuiOutlinedInput-root": {
                fontFamily: '"Crimson Pro", serif',
                fontSize: "1.1rem",
                lineHeight: 1.8,
              },
            }}
          />

          <Box sx={{ mt: 3, display: "flex", justifyContent: "flex-end" }}>
            <Button
              variant="contained"
              size="large"
              endIcon={saving ? <CircularProgress size={20} color="inherit" /> : <ArrowForward />}
              onClick={handleSubmit}
              disabled={story.trim().length < 100 || saving}
            >
              {saving ? "Saving..." : "Choose Art Style"}
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Sample Stories */}
      <Box>
        <Typography variant="h6" sx={{ mb: 2, color: "text.secondary" }}>
          Or try a sample story:
        </Typography>
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
          {sampleStories.map((sample, index) => (
            <Card
              key={index}
              onClick={() => handleSampleClick(sample.story)}
              sx={{
                cursor: "pointer",
                flex: "1 1 300px",
                maxWidth: 350,
                transition: "all 0.2s ease",
                "&:hover": {
                  borderColor: "primary.main",
                  transform: "translateY(-2px)",
                },
              }}
            >
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                  <AutoStories sx={{ color: "primary.main", fontSize: 20 }} />
                  <Typography variant="h6">{sample.title}</Typography>
                </Stack>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  {sample.preview}
                </Typography>
                <Chip
                  label="Click to use"
                  size="small"
                  sx={{ mt: 1.5, bgcolor: "rgba(232, 184, 109, 0.1)" }}
                />
              </CardContent>
            </Card>
          ))}
        </Stack>
      </Box>
    </Box>
  );
}

export default StoryInput;
