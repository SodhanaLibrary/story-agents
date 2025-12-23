import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box,
  CircularProgress,
  Typography,
  Alert,
  Button,
} from "@mui/material";
import { ArrowBack } from "@mui/icons-material";
import StoryViewer from "../components/StoryViewer";

function StoryViewPage() {
  const { storyId } = useParams();
  const navigate = useNavigate();
  const [story, setStory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStory = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/stories/${storyId}`);
        if (!res.ok) {
          throw new Error("Story not found");
        }
        const data = await res.json();
        setStory(data.story);
      } catch (err) {
        console.error("Failed to fetch story:", err);
        setError(err.message || "Failed to load story");
      } finally {
        setLoading(false);
      }
    };

    if (storyId) {
      fetchStory();
    }
  }, [storyId]);

  const handleEdit = () => {
    navigate(`/story/${storyId}/edit`);
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ textAlign: "center", py: 8 }}>
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
        <Button variant="contained" onClick={() => navigate("/")}>
          Back to Library
        </Button>
      </Box>
    );
  }

  if (!story) {
    return (
      <Box sx={{ textAlign: "center", py: 8 }}>
        <Typography variant="h6" sx={{ color: "text.secondary" }}>
          Story not found
        </Typography>
        <Button variant="contained" onClick={() => navigate("/")} sx={{ mt: 2 }}>
          Back to Library
        </Button>
      </Box>
    );
  }

  return (
    <Box className="fade-in">
      <Button
        startIcon={<ArrowBack />}
        onClick={() => navigate("/")}
        sx={{ mb: 2, color: "text.secondary" }}
      >
        Back to Library
      </Button>

      <StoryViewer
        story={story}
        onReset={() => navigate("/")}
        onEdit={handleEdit}
        isEditable={true}
      />
    </Box>
  );
}

export default StoryViewPage;

