import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
  LinearProgress,
} from "@mui/material";
import {
  MenuBook,
  Visibility,
  Delete,
  Favorite,
  FavoriteBorder,
  Palette,
  Image as ImageIcon,
  CalendarToday,
} from "@mui/icons-material";
import { useAuth } from "../context/AuthContext";

function StoriesPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get("q") || "";

  const { isAuthenticated, userId } = useAuth();
  const [stories, setStories] = useState([]);
  const [currentlyReading, setCurrentlyReading] = useState([]);
  const [favoriteIds, setFavoriteIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Use search or personalized feed
      let url =
        isAuthenticated && userId
          ? `/api/feed?userId=${userId}`
          : "/api/stories";
      if (searchQuery) {
        url = `/api/stories?q=${encodeURIComponent(searchQuery)}`;
      }

      const storiesRes = await fetch(url);
      const storiesData = await storiesRes.json();
      setStories(storiesData.stories || []);

      if (isAuthenticated && userId) {
        const [readingRes, favoriteIdsRes] = await Promise.all([
          fetch(`/api/users/${userId}/reading`),
          fetch(`/api/users/${userId}/favorite-ids`),
        ]);
        const [readingData, favoriteIdsData] = await Promise.all([
          readingRes.json(),
          favoriteIdsRes.json(),
        ]);
        setCurrentlyReading(readingData.reading || []);
        setFavoriteIds(new Set(favoriteIdsData.favoriteIds || []));
      }
    } catch (err) {
      console.error("Failed to fetch data:", err);
      setError("Failed to load stories");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, userId, searchQuery]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleFavoriteClick = async (story, event) => {
    event.stopPropagation();
    if (!isAuthenticated) {
      // Could show login prompt
      return;
    }

    const storyId = story.id;
    const isFav = favoriteIds.has(storyId);

    try {
      if (isFav) {
        await fetch(`/api/users/${userId}/favorites/${storyId}`, {
          method: "DELETE",
        });
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          next.delete(storyId);
          return next;
        });
      } else {
        await fetch(`/api/users/${userId}/favorites`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ storyId }),
        });
        setFavoriteIds((prev) => new Set([...prev, storyId]));
      }
    } catch (err) {
      console.error("Failed to update favorite:", err);
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
      {/* Page Title */}
      <Typography
        variant="h4"
        sx={{ mb: 3, fontFamily: '"Crimson Pro", serif', fontWeight: 700 }}
      >
        {searchQuery ? `Search: "${searchQuery}"` : "📚 Story Library"}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Currently Reading Section */}
      {isAuthenticated && currentlyReading.length > 0 && !searchQuery && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" sx={{ mb: 2, color: "text.secondary" }}>
            📖 Continue Reading
          </Typography>
          <Grid container spacing={2}>
            {currentlyReading.slice(0, 3).map((story) => (
              <Grid item xs={12} sm={6} md={4} key={story.id}>
                <StoryCard
                  story={story}
                  isFavorite={favoriteIds.has(story.id)}
                  onFavoriteClick={handleFavoriteClick}
                  onViewStory={() => navigate(`/story/${story.id}`)}
                  onViewProfile={(authorId) => navigate(`/profile/${authorId}`)}
                  showProgress
                  formatDate={formatDate}
                  isAuthenticated={isAuthenticated}
                />
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* All Stories */}
      <Typography variant="h6" sx={{ mb: 2, color: "text.secondary" }}>
        📖 All Stories
      </Typography>
      {stories.length === 0 ? (
        <Box sx={{ textAlign: "center", py: 8 }}>
          <MenuBook
            sx={{ fontSize: 64, color: "text.secondary", opacity: 0.5, mb: 2 }}
          />
          <Typography variant="h6" sx={{ color: "text.secondary" }}>
            {searchQuery ? "No stories found" : "No stories yet"}
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={3}>
          {stories.map((story) => (
            <Grid item xs={12} sm={6} md={4} key={story.id}>
              <StoryCard
                story={story}
                isFavorite={favoriteIds.has(story.id)}
                onFavoriteClick={handleFavoriteClick}
                onViewStory={() => navigate(`/story/${story.id}`)}
                onViewProfile={(authorId) => navigate(`/profile/${authorId}`)}
                formatDate={formatDate}
                isAuthenticated={isAuthenticated}
              />
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}

// Story Card Component
function StoryCard({
  story,
  isFavorite,
  onFavoriteClick,
  onViewStory,
  onViewProfile,
  showProgress,
  formatDate,
  isAuthenticated,
}) {
  return (
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
          borderColor: "rgba(232, 184, 109, 0.3)",
        },
      }}
      onClick={onViewStory}
    >
      {story.coverUrl ? (
        <CardMedia
          component="img"
          height="160"
          image={story.coverUrl}
          alt={story.title}
          sx={{ objectFit: "cover" }}
        />
      ) : (
        <Box
          sx={{
            height: 160,
            bgcolor: "rgba(232, 184, 109, 0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <MenuBook
            sx={{ fontSize: 48, color: "primary.main", opacity: 0.5 }}
          />
        </Box>
      )}

      {showProgress && story.progress !== undefined && (
        <LinearProgress
          variant="determinate"
          value={story.progress}
          sx={{
            height: 4,
            bgcolor: "rgba(232, 184, 109, 0.1)",
            "& .MuiLinearProgress-bar": { bgcolor: "primary.main" },
          }}
        />
      )}

      <CardContent sx={{ flexGrow: 1, p: 2 }}>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            mb: 1,
          }}
        >
          <Typography
            variant="h6"
            sx={{
              fontFamily: '"Crimson Pro", serif',
              fontWeight: 600,
              fontSize: "1.1rem",
              lineHeight: 1.3,
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              flex: 1,
            }}
          >
            {story.title}
          </Typography>

          <Tooltip
            title={
              isAuthenticated
                ? isFavorite
                  ? "Remove from favorites"
                  : "Add to favorites"
                : "Login to favorite"
            }
          >
            <IconButton
              size="small"
              onClick={(e) => onFavoriteClick(story, e)}
              sx={{
                color: isFavorite ? "error.main" : "text.secondary",
                ml: 1,
                "&:hover": { color: "error.main" },
              }}
            >
              {isFavorite ? (
                <Favorite fontSize="small" />
              ) : (
                <FavoriteBorder fontSize="small" />
              )}
            </IconButton>
          </Tooltip>
        </Box>

        {story.summary && (
          <Typography
            variant="body2"
            sx={{
              color: "text.secondary",
              mb: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            {story.summary}
          </Typography>
        )}

        {/* Author info */}
        {story.author && (
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{
              mb: 1.5,
              p: 0.75,
              borderRadius: 1,
              bgcolor: story.isFromFollowed
                ? "rgba(232, 184, 109, 0.08)"
                : "transparent",
              cursor: "pointer",
              "&:hover": { bgcolor: "rgba(232, 184, 109, 0.12)" },
            }}
            onClick={(e) => {
              e.stopPropagation();
              onViewProfile(story.author.id);
            }}
          >
            <Avatar
              src={story.author.picture}
              alt={story.author.name}
              sx={{ width: 24, height: 24 }}
            />
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              by{" "}
              <span
                style={{
                  color: story.isFromFollowed ? "#e8b86d" : "inherit",
                  fontWeight: story.isFromFollowed ? 600 : 400,
                }}
              >
                {story.author.name}
              </span>
            </Typography>
            {story.isFromFollowed && (
              <Chip
                label="Following"
                size="small"
                sx={{
                  fontSize: "0.6rem",
                  height: 16,
                  bgcolor: "rgba(232, 184, 109, 0.2)",
                  color: "primary.main",
                }}
              />
            )}
          </Stack>
        )}

        <Stack direction="row" spacing={1} flexWrap="wrap" gap={0.5}>
          {story.artStyle && (
            <Chip
              icon={<Palette sx={{ fontSize: 14 }} />}
              label={story.artStyle}
              size="small"
              sx={{
                bgcolor: "rgba(232, 184, 109, 0.15)",
                color: "primary.main",
                fontSize: "0.7rem",
              }}
            />
          )}
          <Chip
            icon={<ImageIcon sx={{ fontSize: 14 }} />}
            label={`${story.pageCount || story.totalPages} pages`}
            size="small"
            sx={{ fontSize: "0.7rem" }}
          />
        </Stack>

        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            mt: 2,
            pt: 1,
            borderTop: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <Typography
            variant="caption"
            sx={{
              color: "text.secondary",
              display: "flex",
              alignItems: "center",
              gap: 0.5,
            }}
          >
            <CalendarToday sx={{ fontSize: 12 }} />
            {formatDate(story.createdAt || story.lastReadAt)}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
}

export default StoriesPage;
