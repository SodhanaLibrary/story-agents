import { useState, useEffect } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Chip,
  TextField,
  CircularProgress,
  Alert,
  Stack,
} from "@mui/material";
import {
  AutoAwesome,
  Brush,
  ArrowBack,
  ArrowForward,
  Recommend,
} from "@mui/icons-material";

const styleIcons = {
  illustration: "🎨",
  cartoon: "🎪",
  comic: "💥",
  webtoon: "📱",
  manga: "📖",
  graphicNovel: "📕",
  caricature: "😄",
  anime: "✨",
  conceptArt: "🏰",
  chibi: "🥰",
  storyboard: "🎬",
};

function StyleSelector({ story, onSelect, onBack }) {
  const [styles, setStyles] = useState([]);
  const [selectedStyle, setSelectedStyle] = useState(null);
  const [customStyle, setCustomStyle] = useState("");
  const [recommendation, setRecommendation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    fetchStyles();
    analyzeStory();
  }, []);

  const fetchStyles = async () => {
    try {
      const response = await fetch("/api/styles");
      const data = await response.json();
      setStyles(data.styles);
    } catch (error) {
      console.error("Failed to fetch styles:", error);
    } finally {
      setLoading(false);
    }
  };

  const analyzeStory = async () => {
    setAnalyzing(true);
    try {
      const response = await fetch("/api/analyze-style", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ story }),
      });
      const data = await response.json();
      setRecommendation(data);
      setSelectedStyle(data.recommendedStyle);
    } catch (error) {
      console.error("Failed to analyze story:", error);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSubmit = () => {
    if (selectedStyle === "custom") {
      onSelect("custom", customStyle);
    } else {
      onSelect(selectedStyle);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress sx={{ color: "primary.main" }} />
      </Box>
    );
  }

  return (
    <Box className="fade-in">
      <Box sx={{ textAlign: "center", mb: 4 }}>
        <Typography variant="h2" sx={{ mb: 2, color: "primary.main" }}>
          Choose Art Style
        </Typography>
        <Typography variant="body1" sx={{ color: "text.secondary", maxWidth: 600, mx: "auto" }}>
          Select an art style for your illustrated story. Our AI has analyzed your story and
          made a recommendation.
        </Typography>
      </Box>

      {/* AI Recommendation */}
      {analyzing ? (
        <Card sx={{ mb: 4, bgcolor: "rgba(123, 104, 238, 0.1)", border: "1px solid rgba(123, 104, 238, 0.3)" }}>
          <CardContent sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <CircularProgress size={24} sx={{ color: "secondary.main" }} />
            <Typography>Analyzing your story to recommend the best art style...</Typography>
          </CardContent>
        </Card>
      ) : recommendation && (
        <Card sx={{ mb: 4, bgcolor: "rgba(123, 104, 238, 0.1)", border: "1px solid rgba(123, 104, 238, 0.3)" }}>
          <CardContent>
            <Stack direction="row" alignItems="center" spacing={1} mb={2}>
              <Recommend sx={{ color: "secondary.main" }} />
              <Typography variant="h6">AI Recommendation</Typography>
              <Chip
                label={`${Math.round(recommendation.confidence * 100)}% confidence`}
                size="small"
                sx={{ bgcolor: "rgba(123, 104, 238, 0.2)" }}
              />
            </Stack>
            <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
              {recommendation.reasoning}
            </Typography>
            {recommendation.storyAnalysis && (
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip label={`Genre: ${recommendation.storyAnalysis.genre}`} size="small" variant="outlined" />
                <Chip label={`Tone: ${recommendation.storyAnalysis.tone}`} size="small" variant="outlined" />
                <Chip label={`Audience: ${recommendation.storyAnalysis.targetAudience}`} size="small" variant="outlined" />
              </Stack>
            )}
          </CardContent>
        </Card>
      )}

      {/* Auto-detect Option */}
      <Card
        onClick={() => setSelectedStyle("auto")}
        sx={{
          mb: 3,
          cursor: "pointer",
          border: selectedStyle === "auto" ? "2px solid" : "1px solid",
          borderColor: selectedStyle === "auto" ? "primary.main" : "rgba(232, 184, 109, 0.15)",
          transition: "all 0.2s ease",
          "&:hover": { borderColor: "primary.main" },
        }}
      >
        <CardContent sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <AutoAwesome sx={{ fontSize: 40, color: "primary.main" }} />
          <Box flex={1}>
            <Typography variant="h6">🤖 Let AI Decide</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Automatically choose the best style based on your story's genre, tone, and themes
            </Typography>
          </Box>
          {selectedStyle === "auto" && <Chip label="Selected" color="primary" />}
        </CardContent>
      </Card>

      {/* Style Grid */}
      <Typography variant="h6" sx={{ mb: 2 }}>
        Or choose a specific style:
      </Typography>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {styles.map((style) => (
          <Grid item xs={12} sm={6} md={4} key={style.key}>
            <Card
              onClick={() => setSelectedStyle(style.key)}
              sx={{
                height: "100%",
                cursor: "pointer",
                border: selectedStyle === style.key ? "2px solid" : "1px solid",
                borderColor: selectedStyle === style.key ? "primary.main" : "rgba(232, 184, 109, 0.15)",
                transition: "all 0.2s ease",
                position: "relative",
                "&:hover": { borderColor: "primary.main", transform: "translateY(-2px)" },
              }}
            >
              {recommendation?.recommendedStyle === style.key && (
                <Chip
                  label="Recommended"
                  size="small"
                  color="secondary"
                  sx={{ position: "absolute", top: 8, right: 8 }}
                />
              )}
              <CardContent>
                <Typography variant="h4" sx={{ mb: 1 }}>
                  {styleIcons[style.key] || "🎨"}
                </Typography>
                <Typography variant="h6">{style.name}</Typography>
                <Typography variant="body2" sx={{ color: "text.secondary", mb: 1 }}>
                  {style.description}
                </Typography>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  Best for: {style.bestFor?.slice(0, 3).join(", ")}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}

        {/* Custom Style */}
        <Grid item xs={12} sm={6} md={4}>
          <Card
            onClick={() => setSelectedStyle("custom")}
            sx={{
              height: "100%",
              cursor: "pointer",
              border: selectedStyle === "custom" ? "2px solid" : "1px solid",
              borderColor: selectedStyle === "custom" ? "primary.main" : "rgba(232, 184, 109, 0.15)",
              transition: "all 0.2s ease",
              "&:hover": { borderColor: "primary.main" },
            }}
          >
            <CardContent>
              <Typography variant="h4" sx={{ mb: 1 }}>✏️</Typography>
              <Typography variant="h6">Custom Style</Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Enter your own art style description
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Custom Style Input */}
      {selectedStyle === "custom" && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>
              <Brush sx={{ mr: 1, verticalAlign: "middle" }} />
              Describe Your Art Style
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={3}
              placeholder="e.g., watercolor painting style, soft pastel colors, dreamy atmosphere, impressionist influence"
              value={customStyle}
              onChange={(e) => setCustomStyle(e.target.value)}
            />
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <Box sx={{ display: "flex", justifyContent: "space-between", mt: 4 }}>
        <Button variant="outlined" startIcon={<ArrowBack />} onClick={onBack}>
          Back to Story
        </Button>
        <Button
          variant="contained"
          size="large"
          endIcon={<ArrowForward />}
          onClick={handleSubmit}
          disabled={!selectedStyle || (selectedStyle === "custom" && !customStyle.trim())}
        >
          Generate Story
        </Button>
      </Box>
    </Box>
  );
}

export default StyleSelector;

