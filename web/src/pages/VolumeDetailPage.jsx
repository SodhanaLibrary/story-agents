import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Avatar,
  Grid,
  CircularProgress,
} from "@mui/material";
import { ArrowBack, MenuBook } from "@mui/icons-material";

function VolumeDetailPage() {
  const { volumeId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/v1/volumes/${volumeId}/stories`);
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [volumeId]);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress sx={{ color: "primary.main" }} />
      </Box>
    );
  }

  if (!data || !data.volume) {
    return (
      <Box sx={{ textAlign: "center", py: 8 }}>
        <Typography color="text.secondary">Volume not found</Typography>
        <Button id="btn-volume-back-library" onClick={() => navigate("/")} sx={{ mt: 2 }}>Back to Library</Button>
      </Box>
    );
  }

  const { volume, stories } = data;

  return (
    <Box className="fade-in">
      <Button
        id="btn-volume-back-profile"
        startIcon={<ArrowBack />}
        onClick={() => navigate(`/profile/${volume.userId}`)}
        sx={{ mb: 2, color: "text.secondary" }}
      >
        Back to profile
      </Button>

      <Card sx={{ mb: 3, bgcolor: "rgba(30, 30, 50, 0.6)", border: "1px solid rgba(232, 184, 109, 0.15)" }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h4" sx={{ fontFamily: '"Crimson Pro", serif', fontWeight: 700, mb: 1 }}>
            {volume.title}
          </Typography>
          {volume.description && (
            <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
              {volume.description}
            </Typography>
          )}
          {volume.author && (
            <Box
              id="btn-volume-author-link"
              sx={{ display: "flex", alignItems: "center", gap: 1.5, cursor: "pointer" }}
              onClick={() => navigate(`/profile/${volume.author.id}`)}
            >
              <Avatar src={volume.author.picture} sx={{ width: 36, height: 36 }} />
              <Typography variant="body2" color="text.secondary">
                {volume.author.name || volume.author.username || "Author"}
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      <Typography variant="h6" sx={{ mb: 2 }}>
        Stories ({stories.length})
      </Typography>

      {stories.length === 0 ? (
        <Typography color="text.secondary">No stories in this volume yet.</Typography>
      ) : (
        <Grid container spacing={3}>
          {stories.map((story) => (
            <Grid item xs={12} sm={6} md={4} key={story.id}>
              <Card
                id={`card-volume-story-${story.id}`}
                onClick={() => navigate(`/story/${story.id}`)}
                sx={{
                  cursor: "pointer",
                  bgcolor: "rgba(30, 30, 50, 0.6)",
                  border: "1px solid rgba(232, 184, 109, 0.15)",
                  transition: "all 0.3s ease",
                  "&:hover": { transform: "translateY(-4px)", boxShadow: "0 8px 32px rgba(232, 184, 109, 0.15)" },
                }}
              >
                {story.coverUrl ? (
                  <Box component="img" src={story.coverUrl} alt={story.title} sx={{ width: "100%", height: 160, objectFit: "cover" }} />
                ) : (
                  <Box sx={{ height: 160, bgcolor: "rgba(232, 184, 109, 0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <MenuBook sx={{ fontSize: 48, color: "primary.main", opacity: 0.5 }} />
                  </Box>
                )}
                <CardContent>
                  <Typography variant="h6" sx={{ fontFamily: '"Crimson Pro", serif' }} noWrap>{story.title}</Typography>
                  {story.summary && (
                    <Typography variant="body2" color="text.secondary" sx={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {story.summary}
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}

export default VolumeDetailPage;
