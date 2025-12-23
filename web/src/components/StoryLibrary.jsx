import { useState, useEffect, useCallback } from "react";
import {
  Box,
  Card,
  CardContent,
  CardMedia,
  Typography,
  Button,
  Grid,
  CircularProgress,
  Alert,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  Skeleton,
  Tooltip,
  Tabs,
  Tab,
  TextField,
  InputAdornment,
  LinearProgress,
  Avatar,
} from "@mui/material";
import {
  MenuBook,
  Delete,
  Visibility,
  Add,
  Refresh,
  CalendarToday,
  Person,
  Image as ImageIcon,
  Palette,
  PlayArrow,
  Edit as EditIcon,
  Search,
  Favorite,
  FavoriteBorder,
  Login as LoginIcon,
} from "@mui/icons-material";
import { useAuth } from "../context/AuthContext";

function StoryLibrary({ onSelectStory, onCreateNew, onResumeDraft, onViewProfile }) {
  const { isAuthenticated, userId } = useAuth();
  const [stories, setStories] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [currentlyReading, setCurrentlyReading] = useState([]);
  const [favoriteIds, setFavoriteIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, item: null, isDraft: false });
  const [loginPromptOpen, setLoginPromptOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Use personalized feed for authenticated users
      const feedUrl = isAuthenticated && userId ? `/api/feed?userId=${userId}` : "/api/stories";
      const storiesRes = await fetch(feedUrl);
      const storiesData = await storiesRes.json();
      setStories(storiesData.stories || []);

      // Fetch user-specific data only if authenticated
      if (isAuthenticated && userId) {
        const [draftsRes, favoritesRes, readingRes, favoriteIdsRes] = await Promise.all([
          fetch("/api/drafts"),
          fetch(`/api/users/${userId}/favorites`),
          fetch(`/api/users/${userId}/reading`),
          fetch(`/api/users/${userId}/favorite-ids`),
        ]);

        const [draftsData, favoritesData, readingData, favoriteIdsData] = await Promise.all([
          draftsRes.json(),
          favoritesRes.json(),
          readingRes.json(),
          favoriteIdsRes.json(),
        ]);

        setDrafts(draftsData.drafts || []);
        setFavorites(favoritesData.favorites || []);
        setCurrentlyReading(readingData.reading || []);
        setFavoriteIds(new Set(favoriteIdsData.favoriteIds || []));
      } else {
        setDrafts([]);
        setFavorites([]);
        setCurrentlyReading([]);
        setFavoriteIds(new Set());
      }
    } catch (err) {
      console.error("Failed to fetch data:", err);
      setError("Failed to load stories. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, userId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Search with debounce
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/stories?q=${encodeURIComponent(searchQuery)}`);
        const data = await res.json();
        setSearchResults(data.stories || []);
      } catch (err) {
        console.error("Search failed:", err);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const handleFavoriteClick = async (story, event) => {
    event.stopPropagation();

    if (!isAuthenticated) {
      setLoginPromptOpen(true);
      return;
    }

    const storyId = story.id || story.filename;
    const isFav = favoriteIds.has(story.id);

    try {
      if (isFav) {
        await fetch(`/api/users/${userId}/favorites/${storyId}`, { method: "DELETE" });
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          next.delete(story.id);
          return next;
        });
        setFavorites((prev) => prev.filter((f) => f.id !== story.id));
      } else {
        await fetch(`/api/users/${userId}/favorites`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ storyId }),
        });
        setFavoriteIds((prev) => new Set([...prev, story.id]));
      }
    } catch (err) {
      console.error("Failed to update favorite:", err);
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog.item) return;

    setDeleting(true);
    try {
      const storyIdentifier = deleteDialog.item.id || deleteDialog.item.filename;
      const endpoint = deleteDialog.isDraft
        ? `/api/drafts/${deleteDialog.item.jobId}`
        : `/api/stories/${storyIdentifier}`;

      const response = await fetch(endpoint, { method: "DELETE" });

      if (response.ok) {
        if (deleteDialog.isDraft) {
          setDrafts((prev) => prev.filter((d) => d.jobId !== deleteDialog.item.jobId));
        } else {
          setStories((prev) => prev.filter((s) => (s.id || s.filename) !== storyIdentifier));
        }
        setDeleteDialog({ open: false, item: null, isDraft: false });
      } else {
        setError(`Failed to delete ${deleteDialog.isDraft ? "draft" : "story"}`);
      }
    } catch (err) {
      console.error("Failed to delete:", err);
      setError(`Failed to delete ${deleteDialog.isDraft ? "draft" : "story"}`);
    } finally {
      setDeleting(false);
    }
  };

  const handleViewStory = async (story) => {
    try {
      const storyIdentifier = story.id || story.filename;
      const response = await fetch(`/api/stories/${storyIdentifier}`);
      const data = await response.json();
      onSelectStory(data.story, storyIdentifier);
    } catch (err) {
      console.error("Failed to load story:", err);
      setError("Failed to load story");
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "Unknown";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Story card component
  const StoryCard = ({ story, showDelete = false, showProgress = false }) => {
    const isFavorite = favoriteIds.has(story.id);

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
        onClick={() => handleViewStory(story)}
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
            <MenuBook sx={{ fontSize: 48, color: "primary.main", opacity: 0.5 }} />
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
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
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

            <Tooltip title={isAuthenticated ? (isFavorite ? "Remove from favorites" : "Add to favorites") : "Login to favorite"}>
              <IconButton
                size="small"
                onClick={(e) => handleFavoriteClick(story, e)}
                sx={{
                  color: isFavorite ? "error.main" : "text.secondary",
                  ml: 1,
                  "&:hover": { color: "error.main" },
                }}
              >
                {isFavorite ? <Favorite fontSize="small" /> : <FavoriteBorder fontSize="small" />}
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
                bgcolor: story.isFromFollowed ? "rgba(232, 184, 109, 0.08)" : "transparent",
                cursor: "pointer",
                "&:hover": { bgcolor: "rgba(232, 184, 109, 0.12)" },
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (onViewProfile) onViewProfile(story.author.id);
              }}
            >
              <Avatar
                src={story.author.picture}
                alt={story.author.name}
                sx={{ width: 24, height: 24 }}
              />
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                by <span style={{ color: story.isFromFollowed ? "#e8b86d" : "inherit", fontWeight: story.isFromFollowed ? 600 : 400 }}>{story.author.name}</span>
              </Typography>
              {story.isFromFollowed && (
                <Chip
                  label="Following"
                  size="small"
                  sx={{ fontSize: "0.6rem", height: 16, bgcolor: "rgba(232, 184, 109, 0.2)", color: "primary.main" }}
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
              label={`${story.pageCount || 0} pages`}
              size="small"
              sx={{ fontSize: "0.7rem" }}
            />
            {story.tags?.map((tag) => (
              <Chip key={tag} label={tag} size="small" sx={{ fontSize: "0.7rem" }} />
            ))}
          </Stack>

          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mt: 2, pt: 1, borderTop: "1px solid rgba(255,255,255,0.1)" }}>
            <Typography variant="caption" sx={{ color: "text.secondary", display: "flex", alignItems: "center", gap: 0.5 }}>
              <CalendarToday sx={{ fontSize: 12 }} />
              {formatDate(story.createdAt)}
            </Typography>

            <Stack direction="row" spacing={0.5}>
              <Tooltip title="Read Story">
                <IconButton
                  size="small"
                  sx={{ color: "primary.main" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleViewStory(story);
                  }}
                >
                  <Visibility fontSize="small" />
                </IconButton>
              </Tooltip>

              {showDelete && (
                <Tooltip title="Delete">
                  <IconButton
                    size="small"
                    sx={{ color: "error.main" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteDialog({ open: true, item: story, isDraft: false });
                    }}
                  >
                    <Delete fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>
          </Box>
        </CardContent>
      </Card>
    );
  };

  // Draft card component
  const DraftCard = ({ draft }) => (
    <Card
      sx={{
        display: "flex",
        bgcolor: "rgba(30, 30, 50, 0.6)",
        backdropFilter: "blur(10px)",
        border: "1px solid rgba(123, 104, 238, 0.2)",
        transition: "all 0.3s ease",
        "&:hover": {
          transform: "translateY(-2px)",
          boxShadow: "0 8px 32px rgba(123, 104, 238, 0.15)",
        },
      }}
    >
      <Box sx={{ width: 100, bgcolor: "rgba(123, 104, 238, 0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <EditIcon sx={{ fontSize: 32, color: "secondary.main" }} />
      </Box>
      <CardContent sx={{ flex: 1, py: 1.5 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
          {draft.title || "Untitled Draft"}
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip label={draft.stepLabel || "In Progress"} size="small" color="secondary" sx={{ fontSize: "0.7rem" }} />
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            Last saved: {formatDate(draft.savedAt)}
          </Typography>
        </Stack>
      </CardContent>
      <Box sx={{ display: "flex", alignItems: "center", pr: 2, gap: 1 }}>
        <Button
          size="small"
          variant="contained"
          color="secondary"
          startIcon={<PlayArrow />}
          onClick={() => onResumeDraft(draft)}
        >
          Continue
        </Button>
        <IconButton
          size="small"
          sx={{ color: "error.main" }}
          onClick={() => setDeleteDialog({ open: true, item: draft, isDraft: true })}
        >
          <Delete fontSize="small" />
        </IconButton>
      </Box>
    </Card>
  );

  // Currently reading section
  const CurrentlyReadingSection = () => {
    if (!isAuthenticated || currentlyReading.length === 0) return null;

    return (
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" sx={{ mb: 2, fontFamily: '"Crimson Pro", serif', fontWeight: 600 }}>
          📖 Continue Reading
        </Typography>
        <Grid container spacing={2}>
          {currentlyReading.slice(0, 3).map((story) => (
            <Grid item xs={12} sm={6} md={4} key={story.id}>
              <StoryCard story={story} showProgress />
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  };

  // Loading state
  if (loading) {
    return (
      <Box>
        <Skeleton variant="rectangular" height={56} sx={{ mb: 3, borderRadius: 2 }} />
        <Grid container spacing={3}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Grid item xs={12} sm={6} md={4} key={i}>
              <Skeleton variant="rectangular" height={280} sx={{ borderRadius: 2 }} />
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  const displayStories = searchResults !== null ? searchResults : stories;

  return (
    <Box className="fade-in">
      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography variant="h4" sx={{ fontFamily: '"Crimson Pro", serif', fontWeight: 700 }}>
          📚 Story Library
        </Typography>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Refresh">
            <IconButton onClick={fetchData} sx={{ color: "text.secondary" }}>
              <Refresh />
            </IconButton>
          </Tooltip>
          {isAuthenticated && (
            <Button variant="contained" startIcon={<Add />} onClick={onCreateNew}>
              Create Story
            </Button>
          )}
        </Stack>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Search Bar */}
      <TextField
        fullWidth
        placeholder="Search stories by title, summary, or tags..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        sx={{
          mb: 3,
          "& .MuiOutlinedInput-root": {
            bgcolor: "rgba(30, 30, 50, 0.6)",
            "&:hover .MuiOutlinedInput-notchedOutline": {
              borderColor: "primary.main",
            },
          },
        }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Search sx={{ color: "text.secondary" }} />
            </InputAdornment>
          ),
          endAdornment: searching && (
            <InputAdornment position="end">
              <CircularProgress size={20} />
            </InputAdornment>
          ),
        }}
      />

      {/* Currently Reading Section (only for authenticated users) */}
      <CurrentlyReadingSection />

      {/* Tabs */}
      <Tabs
        value={tabValue}
        onChange={(e, v) => setTabValue(v)}
        sx={{
          mb: 3,
          "& .MuiTab-root": { color: "text.secondary" },
          "& .Mui-selected": { color: "primary.main" },
          "& .MuiTabs-indicator": { backgroundColor: "primary.main" },
        }}
      >
        <Tab label={`All Stories (${displayStories.length})`} />
        {isAuthenticated && <Tab label={`Favorites (${favorites.length})`} icon={<Favorite sx={{ fontSize: 16 }} />} iconPosition="start" />}
        {isAuthenticated && <Tab label={`My Drafts (${drafts.length})`} />}
      </Tabs>

      {/* Tab Panels */}
      {tabValue === 0 && (
        <Box>
          {displayStories.length === 0 ? (
            <Box sx={{ textAlign: "center", py: 8 }}>
              <MenuBook sx={{ fontSize: 64, color: "text.secondary", opacity: 0.5, mb: 2 }} />
              <Typography variant="h6" sx={{ color: "text.secondary", mb: 1 }}>
                {searchQuery ? "No stories found" : "No stories yet"}
              </Typography>
              <Typography variant="body2" sx={{ color: "text.secondary", mb: 3 }}>
                {searchQuery ? "Try a different search term" : "Be the first to create a magical story!"}
              </Typography>
              {isAuthenticated && !searchQuery && (
                <Button variant="contained" startIcon={<Add />} onClick={onCreateNew}>
                  Create Your First Story
                </Button>
              )}
            </Box>
          ) : (
            <Grid container spacing={3}>
              {displayStories.map((story) => (
                <Grid item xs={12} sm={6} md={4} key={story.id || story.filename}>
                  <StoryCard story={story} showDelete={isAuthenticated && story.userId === userId} />
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      )}

      {isAuthenticated && tabValue === 1 && (
        <Box>
          {favorites.length === 0 ? (
            <Box sx={{ textAlign: "center", py: 8 }}>
              <FavoriteBorder sx={{ fontSize: 64, color: "text.secondary", opacity: 0.5, mb: 2 }} />
              <Typography variant="h6" sx={{ color: "text.secondary", mb: 1 }}>
                No favorites yet
              </Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Click the heart icon on any story to add it to your favorites
              </Typography>
            </Box>
          ) : (
            <Grid container spacing={3}>
              {favorites.map((story) => (
                <Grid item xs={12} sm={6} md={4} key={story.id}>
                  <StoryCard story={story} />
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      )}

      {isAuthenticated && tabValue === 2 && (
        <Box>
          {drafts.length === 0 ? (
            <Box sx={{ textAlign: "center", py: 8 }}>
              <EditIcon sx={{ fontSize: 64, color: "text.secondary", opacity: 0.5, mb: 2 }} />
              <Typography variant="h6" sx={{ color: "text.secondary", mb: 1 }}>
                No drafts
              </Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Stories you start but don&apos;t finish will appear here
              </Typography>
            </Box>
          ) : (
            <Stack spacing={2}>
              {drafts.map((draft) => (
                <DraftCard key={draft.jobId} draft={draft} />
              ))}
            </Stack>
          )}
        </Box>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, item: null, isDraft: false })}
        PaperProps={{
          sx: {
            bgcolor: "background.paper",
            backgroundImage: "none",
          },
        }}
      >
        <DialogTitle>
          Delete {deleteDialog.isDraft ? "Draft" : "Story"}?
        </DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete &quot;{deleteDialog.item?.title || "this item"}&quot;?
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setDeleteDialog({ open: false, item: null, isDraft: false })}
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDelete}
            color="error"
            variant="contained"
            disabled={deleting}
          >
            {deleting ? <CircularProgress size={20} /> : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Login Prompt Dialog */}
      <Dialog
        open={loginPromptOpen}
        onClose={() => setLoginPromptOpen(false)}
        PaperProps={{
          sx: {
            bgcolor: "background.paper",
            backgroundImage: "none",
            textAlign: "center",
            p: 2,
          },
        }}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1 }}>
          <LoginIcon color="primary" />
          Login Required
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>
            Please login with Google to add stories to your favorites.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ justifyContent: "center" }}>
          <Button onClick={() => setLoginPromptOpen(false)}>
            Maybe Later
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default StoryLibrary;
