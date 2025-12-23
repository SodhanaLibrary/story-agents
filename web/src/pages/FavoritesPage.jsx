import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Grid,
  Card,
  CardContent,
  CardMedia,
  Typography,
  Chip,
  Stack,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  Avatar,
} from "@mui/material";
import {
  MenuBook,
  Favorite,
  FavoriteBorder,
  Palette,
  Image as ImageIcon,
  CalendarToday,
} from "@mui/icons-material";
import { useAuth } from "../context/AuthContext";

function FavoritesPage() {
  const navigate = useNavigate();
  const { userId } = useAuth();
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchFavorites = async () => {
      if (!userId) return;
      
      setLoading(true);
      try {
        const res = await fetch(`/api/users/${userId}/favorites`);
        const data = await res.json();
        setFavorites(data.favorites || []);
      } catch (err) {
        console.error("Failed to fetch favorites:", err);
        setError("Failed to load favorites");
      } finally {
        setLoading(false);
      }
    };

    fetchFavorites();
  }, [userId]);

  const handleRemoveFavorite = async (story, event) => {
    event.stopPropagation();
    try {
      await fetch(`/api/users/${userId}/favorites/${story.id}`, { method: "DELETE" });
      setFavorites((prev) => prev.filter((f) => f.id !== story.id));
    } catch (err) {
      console.error("Failed to remove favorite:", err);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "Unknown";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box className="fade-in">
      <Typography variant="h4" sx={{ mb: 3, fontFamily: '"Crimson Pro", serif', fontWeight: 700 }}>
        ❤️ My Favorites
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {favorites.length === 0 ? (
        <Box sx={{ textAlign: "center", py: 8 }}>
          <FavoriteBorder sx={{ fontSize: 64, color: "text.secondary", opacity: 0.5, mb: 2 }} />
          <Typography variant="h6" sx={{ color: "text.secondary" }}>
            No favorites yet
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Click the heart icon on any story to add it here
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={3}>
          {favorites.map((story) => (
            <Grid item xs={12} sm={6} md={4} key={story.id}>
              <Card
                sx={{
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  bgcolor: "rgba(30, 30, 50, 0.6)",
                  backdropFilter: "blur(10px)",
                  border: "1px solid rgba(232, 184, 109, 0.15)",
                  transition: "all 0.3s ease",
                  cursor: "pointer",
                  "&:hover": {
                    transform: "translateY(-4px)",
                    boxShadow: "0 8px 32px rgba(232, 184, 109, 0.15)",
                  },
                }}
                onClick={() => navigate(`/story/${story.id}`)}
              >
                {story.coverUrl ? (
                  <CardMedia component="img" height="160" image={story.coverUrl} alt={story.title} sx={{ objectFit: "cover" }} />
                ) : (
                  <Box sx={{ height: 160, bgcolor: "rgba(232, 184, 109, 0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <MenuBook sx={{ fontSize: 48, color: "primary.main", opacity: 0.5 }} />
                  </Box>
                )}

                <CardContent sx={{ flexGrow: 1, p: 2 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
                    <Typography variant="h6" sx={{ fontFamily: '"Crimson Pro", serif', fontWeight: 600, fontSize: "1.1rem", flex: 1 }}>
                      {story.title}
                    </Typography>
                    <Tooltip title="Remove from favorites">
                      <IconButton size="small" onClick={(e) => handleRemoveFavorite(story, e)} sx={{ color: "error.main", ml: 1 }}>
                        <Favorite fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>

                  {story.summary && (
                    <Typography variant="body2" sx={{ color: "text.secondary", mb: 2, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                      {story.summary}
                    </Typography>
                  )}

                  <Stack direction="row" spacing={1} flexWrap="wrap" gap={0.5}>
                    {story.artStyle && (
                      <Chip icon={<Palette sx={{ fontSize: 14 }} />} label={story.artStyle} size="small" sx={{ bgcolor: "rgba(232, 184, 109, 0.15)", color: "primary.main", fontSize: "0.7rem" }} />
                    )}
                    <Chip icon={<ImageIcon sx={{ fontSize: 14 }} />} label={`${story.pageCount || 0} pages`} size="small" sx={{ fontSize: "0.7rem" }} />
                  </Stack>

                  <Box sx={{ display: "flex", alignItems: "center", mt: 2, pt: 1, borderTop: "1px solid rgba(255,255,255,0.1)" }}>
                    <Typography variant="caption" sx={{ color: "text.secondary", display: "flex", alignItems: "center", gap: 0.5 }}>
                      <CalendarToday sx={{ fontSize: 12 }} />
                      Favorited {formatDate(story.favoritedAt)}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}

export default FavoritesPage;

