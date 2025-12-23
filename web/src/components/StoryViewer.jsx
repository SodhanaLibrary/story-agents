import { useState, useEffect, useCallback } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Tabs,
  Tab,
  Avatar,
  Stack,
  Chip,
  IconButton,
  Dialog,
  DialogContent,
} from "@mui/material";
import {
  AutoStories,
  Person,
  ArrowBack,
  ArrowForward,
  Refresh,
  ZoomIn,
  Download,
  Close,
  Edit,
} from "@mui/icons-material";
import { useAuth } from "../context/AuthContext";
import TagManager from "./TagManager";

function StoryViewer({ story, onReset, onEdit, isEditable = true }) {
  const { isAuthenticated, userId } = useAuth();
  const [activeTab, setActiveTab] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [zoomImage, setZoomImage] = useState(null);

  const pages = story?.storyPages?.pages || [];
  const characters = story?.characters || [];
  const cover = story?.cover;
  const storyId = story?.id;
  const totalPages = pages.length;

  // Track reading progress for authenticated users
  const updateProgress = useCallback(async (page) => {
    if (!isAuthenticated || !userId || !storyId) return;
    
    try {
      await fetch(`/api/users/${userId}/reading/${storyId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPage: page + 1, // 1-indexed for display
          totalPages,
        }),
      });
    } catch (err) {
      console.error("Failed to update reading progress:", err);
    }
  }, [isAuthenticated, userId, storyId, totalPages]);

  // Update reading progress when page changes
  useEffect(() => {
    if (activeTab === 0) {
      updateProgress(currentPage);
    }
  }, [currentPage, activeTab, updateProgress]);

  const handleDownload = (url, filename) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
  };

  return (
    <Box className="fade-in">
      {/* Header */}
      <Box sx={{ textAlign: "center", mb: 4 }}>
        <Typography variant="h2" sx={{ mb: 1, color: "primary.main" }}>
          {story?.storyPages?.title || "Your Story"}
        </Typography>
        <Typography variant="body1" sx={{ color: "text.secondary", mb: 2 }}>
          {story?.storyPages?.summary}
        </Typography>
        <Stack direction="row" spacing={2} justifyContent="center" alignItems="center" flexWrap="wrap">
          {story?.artStyleDecision && (
            <Chip
              label={`Art Style: ${story.artStyleDecision.styleDetails?.name || story.artStyleDecision.selectedStyle}`}
              sx={{ bgcolor: "rgba(123, 104, 238, 0.2)" }}
            />
          )}
          {storyId && (
            <TagManager storyId={storyId} isEditable={isAuthenticated && isEditable} />
          )}
        </Stack>
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(e, v) => setActiveTab(v)}
          sx={{
            "& .MuiTab-root": {
              color: "text.secondary",
              "&.Mui-selected": { color: "primary.main" },
            },
            "& .MuiTabs-indicator": { bgcolor: "primary.main" },
          }}
        >
          <Tab icon={<AutoStories />} label="Story Pages" iconPosition="start" />
          <Tab icon={<Person />} label="Characters" iconPosition="start" />
        </Tabs>
      </Box>

      {/* Story Pages Tab */}
      {activeTab === 0 && (
        <Box>
          {/* Cover */}
          {cover && currentPage === -1 && (
            <Card sx={{ maxWidth: 600, mx: "auto", mb: 3 }}>
              <Box
                sx={{
                  position: "relative",
                  "&:hover .zoom-btn": { opacity: 1 },
                }}
              >
                <img
                  src={cover.illustrationUrl}
                  alt="Book Cover"
                  style={{ width: "100%", display: "block", borderRadius: "12px 12px 0 0" }}
                />
                <IconButton
                  className="zoom-btn"
                  onClick={() => setZoomImage(cover.illustrationUrl)}
                  sx={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    bgcolor: "rgba(0,0,0,0.5)",
                    opacity: 0,
                    transition: "opacity 0.2s",
                    "&:hover": { bgcolor: "rgba(0,0,0,0.7)" },
                  }}
                >
                  <ZoomIn />
                </IconButton>
              </Box>
              <CardContent sx={{ textAlign: "center" }}>
                <Typography variant="h5">Book Cover</Typography>
              </CardContent>
            </Card>
          )}

          {/* Current Page */}
          {pages[currentPage] && (
            <Card sx={{ maxWidth: 800, mx: "auto", mb: 3 }}>
              <Box
                sx={{
                  position: "relative",
                  "&:hover .zoom-btn": { opacity: 1 },
                }}
              >
                <img
                  src={pages[currentPage].illustrationUrl}
                  alt={`Page ${currentPage + 1}`}
                  style={{ width: "100%", display: "block", borderRadius: "12px 12px 0 0" }}
                />
                <IconButton
                  className="zoom-btn"
                  onClick={() => setZoomImage(pages[currentPage].illustrationUrl)}
                  sx={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    bgcolor: "rgba(0,0,0,0.5)",
                    opacity: 0,
                    transition: "opacity 0.2s",
                    "&:hover": { bgcolor: "rgba(0,0,0,0.7)" },
                  }}
                >
                  <ZoomIn />
                </IconButton>
              </Box>
              <CardContent>
                <Chip
                  label={`Page ${currentPage + 1} of ${pages.length}`}
                  size="small"
                  sx={{ mb: 2, bgcolor: "rgba(232, 184, 109, 0.2)" }}
                />
                <Typography
                  variant="body1"
                  sx={{
                    fontFamily: '"Crimson Pro", serif',
                    fontSize: "1.2rem",
                    lineHeight: 1.8,
                    mb: 2,
                  }}
                >
                  {pages[currentPage].text}
                </Typography>
                {pages[currentPage].characters?.length > 0 && (
                  <Stack direction="row" spacing={1}>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>
                      Characters:
                    </Typography>
                    {pages[currentPage].characters.map((char, i) => (
                      <Chip key={i} label={char} size="small" variant="outlined" />
                    ))}
                  </Stack>
                )}
              </CardContent>
            </Card>
          )}

          {/* Page Navigation */}
          <Box sx={{ display: "flex", justifyContent: "center", gap: 2, mb: 4 }}>
            <Button
              variant="outlined"
              startIcon={<ArrowBack />}
              onClick={() => setCurrentPage((p) => Math.max(-1, p - 1))}
              disabled={currentPage <= (cover ? -1 : 0)}
            >
              {currentPage === 0 && cover ? "Cover" : "Previous"}
            </Button>
            <Button
              variant="contained"
              endIcon={<ArrowForward />}
              onClick={() => setCurrentPage((p) => Math.min(pages.length - 1, p + 1))}
              disabled={currentPage >= pages.length - 1}
            >
              Next Page
            </Button>
          </Box>

          {/* Page Thumbnails */}
          <Box sx={{ overflowX: "auto", pb: 2 }}>
            <Stack direction="row" spacing={2} sx={{ px: 2 }}>
              {cover && (
                <Box
                  onClick={() => setCurrentPage(-1)}
                  sx={{
                    flexShrink: 0,
                    width: 100,
                    cursor: "pointer",
                    border: currentPage === -1 ? "2px solid" : "2px solid transparent",
                    borderColor: "primary.main",
                    borderRadius: 1,
                    overflow: "hidden",
                    opacity: currentPage === -1 ? 1 : 0.6,
                    transition: "all 0.2s",
                    "&:hover": { opacity: 1 },
                  }}
                >
                  <img src={cover.illustrationUrl} alt="Cover" style={{ width: "100%", display: "block" }} />
                  <Typography variant="caption" sx={{ display: "block", textAlign: "center", py: 0.5 }}>
                    Cover
                  </Typography>
                </Box>
              )}
              {pages.map((page, index) => (
                <Box
                  key={index}
                  onClick={() => setCurrentPage(index)}
                  sx={{
                    flexShrink: 0,
                    width: 100,
                    cursor: "pointer",
                    border: currentPage === index ? "2px solid" : "2px solid transparent",
                    borderColor: "primary.main",
                    borderRadius: 1,
                    overflow: "hidden",
                    opacity: currentPage === index ? 1 : 0.6,
                    transition: "all 0.2s",
                    "&:hover": { opacity: 1 },
                  }}
                >
                  <img src={page.illustrationUrl} alt={`Page ${index + 1}`} style={{ width: "100%", display: "block" }} />
                  <Typography variant="caption" sx={{ display: "block", textAlign: "center", py: 0.5 }}>
                    Page {index + 1}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </Box>
        </Box>
      )}

      {/* Characters Tab */}
      {activeTab === 1 && (
        <Grid container spacing={3}>
          {characters.map((char, index) => (
            <Grid item xs={12} sm={6} md={4} key={index}>
              <Card>
                <Box
                  sx={{
                    position: "relative",
                    "&:hover .zoom-btn": { opacity: 1 },
                  }}
                >
                  <img
                    src={char.avatarUrl}
                    alt={char.name}
                    style={{ width: "100%", display: "block" }}
                  />
                  <IconButton
                    className="zoom-btn"
                    onClick={() => setZoomImage(char.avatarUrl)}
                    sx={{
                      position: "absolute",
                      top: 8,
                      right: 8,
                      bgcolor: "rgba(0,0,0,0.5)",
                      opacity: 0,
                      transition: "opacity 0.2s",
                    }}
                  >
                    <ZoomIn />
                  </IconButton>
                </Box>
                <CardContent>
                  <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                    <Typography variant="h6">{char.name}</Typography>
                    <Chip label={char.role} size="small" variant="outlined" />
                  </Stack>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    {char.description}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Action Buttons */}
      <Box sx={{ display: "flex", justifyContent: "center", gap: 2, mt: 4 }}>
        <Button variant="outlined" startIcon={<Refresh />} onClick={onReset}>
          {onEdit ? "Back to Library" : "Create New Story"}
        </Button>
        {isEditable && onEdit && (
          <Button
            variant="contained"
            startIcon={<Edit />}
            onClick={() => onEdit(story)}
            sx={{ bgcolor: "secondary.main", "&:hover": { bgcolor: "secondary.dark" } }}
          >
            Edit Story
          </Button>
        )}
        <Button
          variant="outlined"
          startIcon={<Download />}
          onClick={() => {
            const dataStr = JSON.stringify(story, null, 2);
            const blob = new Blob([dataStr], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            handleDownload(url, `${story?.storyPages?.title || "story"}.json`);
          }}
        >
          Download Story Data
        </Button>
      </Box>

      {/* Zoom Dialog */}
      <Dialog
        open={!!zoomImage}
        onClose={() => setZoomImage(null)}
        maxWidth="lg"
      >
        <IconButton
          onClick={() => setZoomImage(null)}
          sx={{ position: "absolute", top: 8, right: 8, bgcolor: "rgba(0,0,0,0.5)" }}
        >
          <Close />
        </IconButton>
        <DialogContent sx={{ p: 0 }}>
          {zoomImage && (
            <img
              src={zoomImage}
              alt="Zoomed"
              style={{ maxWidth: "100%", maxHeight: "90vh", display: "block" }}
            />
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}

export default StoryViewer;

