import { useState, useEffect, useCallback, useRef } from "react";
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
  ZoomIn,
  Close,
  Edit,
  Delete,
} from "@mui/icons-material";
import { useAuth } from "../context/AuthContext";
import TagManager from "./TagManager";

function StoryViewer({
  story,
  onReset,
  onEdit,
  onDelete,
  isEditable = true,
  showPageList = false,
}) {
  const { isAuthenticated, userId } = useAuth();
  const [currentPage, setCurrentPage] = useState(-1);

  // Touch/swipe state
  const touchStartX = useRef(null);
  const touchEndX = useRef(null);
  const containerRef = useRef(null);

  const pages = story?.storyPages?.pages || [];
  const characters = story?.characters || [];
  const cover = story?.cover;
  const storyId = story?.id;
  const totalPages = pages.length;

  const minPage = cover ? -1 : 0;
  const maxPage = pages.length - 1;

  // Track reading progress for authenticated users
  const updateProgress = useCallback(
    async (page) => {
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
    },
    [isAuthenticated, userId, storyId, totalPages]
  );

  // Update reading progress when page changes
  useEffect(() => {
    updateProgress(currentPage);
  }, [currentPage, updateProgress]);

  // Navigate to next/previous page
  const goToNextPage = useCallback(() => {
    setCurrentPage((p) => Math.min(maxPage, p + 1));
  }, [maxPage]);

  const goToPrevPage = useCallback(() => {
    setCurrentPage((p) => Math.max(minPage, p - 1));
  }, [minPage]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't navigate if user is typing in an input or dialog is open
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
        return;
      }

      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        goToNextPage();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        goToPrevPage();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goToNextPage, goToPrevPage]);

  // Touch/swipe handlers
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchEndX.current = null;
  };

  const handleTouchMove = (e) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;

    const swipeDistance = touchStartX.current - touchEndX.current;
    const minSwipeDistance = 50; // Minimum swipe distance in pixels

    if (Math.abs(swipeDistance) > minSwipeDistance) {
      if (swipeDistance > 0) {
        // Swiped left -> next page
        goToNextPage();
      } else {
        // Swiped right -> previous page
        goToPrevPage();
      }
    }

    // Reset touch state
    touchStartX.current = null;
    touchEndX.current = null;
  };

  return (
    <Box
      className="fade-in"
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      sx={{ touchAction: "pan-y", display: "flex", flexDirection: "row" }} // Allow vertical scroll, capture horizontal swipe
    >
      {/* Page Thumbnails */}
      {showPageList && (
        <Box sx={{ overflowX: "auto", pb: 2 }}>
          <Stack direction="column" spacing={2} sx={{ px: 2 }}>
            {cover && (
              <Box
                onClick={() => setCurrentPage(-1)}
                sx={{
                  flexShrink: 0,
                  width: 100,
                  cursor: "pointer",
                  border:
                    currentPage === -1 ? "2px solid" : "2px solid transparent",
                  borderColor: "primary.main",
                  borderRadius: 1,
                  overflow: "hidden",
                  opacity: currentPage === -1 ? 1 : 0.6,
                  transition: "all 0.2s",
                  "&:hover": { opacity: 1 },
                }}
              >
                <img
                  src={cover.illustrationUrl}
                  alt="Cover"
                  style={{ width: "100%", display: "block" }}
                />
                <Typography
                  variant="caption"
                  sx={{ display: "block", textAlign: "center", py: 0.5 }}
                >
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
                  border:
                    currentPage === index
                      ? "2px solid"
                      : "2px solid transparent",
                  borderColor: "primary.main",
                  borderRadius: 1,
                  overflow: "hidden",
                  opacity: currentPage === index ? 1 : 0.6,
                  transition: "all 0.2s",
                  "&:hover": { opacity: 1 },
                }}
              >
                <img
                  src={page.illustrationUrl}
                  alt={`Page ${index + 1}`}
                  style={{ width: "100%", display: "block" }}
                />
                <Typography
                  variant="caption"
                  sx={{ display: "block", textAlign: "center", py: 0.5 }}
                >
                  Page {index + 1}
                </Typography>
              </Box>
            ))}
          </Stack>
          {/* Minimal Header with Tags */}
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              alignItems: "center",
              p: 1,
            }}
          >
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              flexWrap="wrap"
            >
              {story?.artStyleDecision?.styleDetails?.name && (
                <Chip
                  label={
                    story.artStyleDecision.styleDetails?.name ||
                    story.artStyleDecision.selectedStyle
                  }
                  size="small"
                  sx={{ bgcolor: "rgba(123, 104, 238, 0.2)" }}
                />
              )}
              {storyId && (
                <TagManager
                  storyId={storyId}
                  isEditable={isAuthenticated && isEditable}
                />
              )}
            </Stack>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              {pages.length} pages
            </Typography>
          </Box>
          {/* Action Buttons */}
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              gap: 2,
              mt: 4,
              flexWrap: "wrap",
            }}
          >
            {isAuthenticated && isEditable && onEdit && (
              <IconButton
                variant="contained"
                startIcon={<Edit />}
                onClick={() => onEdit(story)}
                sx={{
                  bgcolor: "secondary.main",
                  "&:hover": { bgcolor: "secondary.dark" },
                }}
              >
                <Edit />
              </IconButton>
            )}
            {isAuthenticated && isEditable && onDelete && (
              <IconButton
                variant="outlined"
                color="error"
                startIcon={<Delete />}
                onClick={() => onDelete(story)}
              >
                <Delete />
              </IconButton>
            )}
          </Box>
        </Box>
      )}
      <Box sx={{ flex: 1 }}>
        {/* Cover */}
        {cover && currentPage === -1 && (
          <Box
            sx={{
              position: "relative",
              height: "calc(100vh - 150px)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              marginBottom: 2,
            }}
          >
            <img
              src={cover.illustrationUrl}
              alt="Book Cover"
              style={{
                maxWidth: "100%",
                height: "calc(100vh - 150px)",
                display: "block",
                borderRadius: "12px 12px 0 0",
                margin: "auto",
              }}
            />
          </Box>
        )}

        {/* Current Page - Book Style */}
        {pages[currentPage] && (
          <Card
            sx={{
              maxWidth: 600,
              maxHeight: "calc(100vh - 150px)",
              mx: "auto",
              mb: 3,
              bgcolor: "rgba(255, 253, 245, 0.03)",
              border: "1px solid rgba(232, 184, 109, 0.15)",
              borderRadius: 2,
              boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
            }}
          >
            {/* Page Text - Top */}
            <CardContent
              sx={{
                pt: 4,
                pb: 3,
                px: { xs: 3, sm: 5 },
                borderBottom: "1px solid rgba(232, 184, 109, 0.1)",
              }}
            >
              <Typography
                sx={{
                  fontFamily:
                    '"Crimson Pro", Georgia, "Times New Roman", serif',
                  fontSize: { xs: "1.3rem", sm: "1.5rem", md: "1.7rem" },
                  lineHeight: 1.9,
                  color: "rgba(255, 255, 255, 0.9)",
                  textAlign: "justify",
                  letterSpacing: "0.02em",
                }}
              >
                {pages[currentPage].text}
              </Typography>
            </CardContent>

            {/* Illustration - Bottom */}
            <Box
              sx={{
                position: "relative",
                "&:hover .zoom-btn": { opacity: 1 },
              }}
            >
              <img
                src={pages[currentPage].illustrationUrl}
                alt={`Page ${currentPage + 1}`}
                style={{
                  width: "100%",
                  display: "block",
                  borderRadius: "0 0 8px 8px",
                }}
              />

              {/* Page Number Badge */}
              <Chip
                label={`${currentPage + 1} / ${pages.length}`}
                size="small"
                sx={{
                  position: "absolute",
                  bottom: 12,
                  right: 12,
                  bgcolor: "rgba(0,0,0,0.6)",
                  color: "white",
                  fontWeight: 500,
                }}
              />
            </Box>
          </Card>
        )}

        {/* Page Navigation */}
        <Box sx={{ display: "flex", justifyContent: "center", gap: 2, mb: 4 }}>
          <Button
            variant="outlined"
            startIcon={<ArrowBack />}
            onClick={goToPrevPage}
            disabled={currentPage <= minPage}
          >
            {currentPage === 0 && cover ? "Cover" : "Previous"}
          </Button>
          <Button
            variant="contained"
            endIcon={<ArrowForward />}
            onClick={goToNextPage}
            disabled={currentPage >= maxPage}
          >
            Next Page
          </Button>
        </Box>
      </Box>
    </Box>
  );
}

export default StoryViewer;
