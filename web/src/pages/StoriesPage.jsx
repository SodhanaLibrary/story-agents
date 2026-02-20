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
  Favorite,
  FavoriteBorder,
  CalendarToday,
} from "@mui/icons-material";
import ImageIcon from "@mui/icons-material/Image";
import Palette from "@mui/icons-material/Palette";
import { useAuth } from "../context/AuthContext";
import { useFeed } from "../hooks/useStories";
import { useStories } from "../hooks/useStories";
import {
  useCurrentlyReading,
  useFavoriteIds,
  useAddFavorite,
  useRemoveFavorite,
} from "../hooks/useUser";

function StoriesPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get("q") || "";

  const { isAuthenticated, userId } = useAuth();

  const hasSearch = !!searchQuery.trim();
  const feedQuery = useFeed(userId || "");
  const publicQuery = useStories("");
  const searchQueryResult = useStories(searchQuery);

  const stories = hasSearch
    ? searchQueryResult.data || []
    : userId
      ? feedQuery.data || []
      : publicQuery.data || [];

  const { data: currentlyReading = [] } = useCurrentlyReading(userId || "");
  const { data: favoriteIds = new Set() } = useFavoriteIds(userId || "");
  const addFavorite = useAddFavorite(userId || "");
  const removeFavorite = useRemoveFavorite(userId || "");

  const loading = hasSearch
    ? searchQueryResult.isLoading
    : userId
      ? feedQuery.isLoading
      : publicQuery.isLoading;

  const handleFavoriteClick = async (story, event) => {
    event.stopPropagation();
    if (!isAuthenticated) return;
    const storyId = story.id;
    const isFav = favoriteIds.has(storyId);
    try {
      if (isFav) {
        await removeFavorite.mutateAsync(storyId);
      } else {
        await addFavorite.mutateAsync(storyId);
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
      {/* Page Title + Submit story */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 2,
          mb: 3,
        }}
      >
        {searchQuery ? (
          <Typography
            variant="h4"
            sx={{ fontFamily: '"Crimson Pro", serif', fontWeight: 700 }}
          >
            {`Search: "${searchQuery}"`}
          </Typography>
        ) : (
          <Typography
            variant="h4"
            sx={{ fontFamily: '"Crimson Pro", serif', fontWeight: 700 }}
          >
            Stories
          </Typography>
        )}
      </Box>

      {(searchQueryResult.isError ||
        feedQuery.isError ||
        publicQuery.isError) && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {(searchQueryResult.error || feedQuery.error || publicQuery.error)
            ?.message || "Failed to load stories"}
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
      id={`card-story-${story.id}`}
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
          {story.genre && (
            <Typography
              variant="caption"
              color="primary"
              sx={{ display: "block", mb: 0.5 }}
            >
              {story.genre}
            </Typography>
          )}

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
              id={`btn-favorite-${story.id}`}
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
            id={`link-author-${story.id}`}
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
