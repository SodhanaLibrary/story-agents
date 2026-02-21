import { useState, useEffect, useCallback, useRef } from "react";
import {
  Box,
  Typography,
  Button,
  Stack,
  Chip,
  IconButton,
  useMediaQuery,
  useTheme,
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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

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
        await fetch(`/api/v1/users/${userId}/reading/${storyId}`, {
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
    [isAuthenticated, userId, storyId, totalPages],
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
                id="page-thumbnail-cover"
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
                id={`page-thumbnail-${index}`}
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
                id="btn-edit-story"
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
                id="btn-delete-story"
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

        {/* Current Page - Book Style Layout */}
        {pages[currentPage] && (
          <Box
            sx={{
              maxWidth: { xs: "100%", md: 1200 },
              mx: "auto",
              mb: 3,
              bgcolor: "rgba(255, 253, 245, 0.03)",
              border: "1px solid rgba(232, 184, 109, 0.15)",
              borderRadius: 2,
              boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
              display: "flex",
              // Portrait: column (image top, text bottom)
              // Landscape: row (image left, text right) - like an open book
              flexDirection: "column",
              "@media (orientation: landscape)": {
                flexDirection: "row",
                maxHeight: "calc(100vh - 150px)",
                overflow: "hidden",
              },
            }}
          >
            {/* Illustration - Left side in landscape, Top in portrait */}
            <Box
              sx={{
                position: "relative",
                flexShrink: 0,
                "@media (orientation: portrait)": {
                  maxHeight: "75vh",
                },
                "@media (orientation: landscape)": {
                  flex: 1,
                  maxWidth: "50%",
                  maxHeight: "100%",
                },
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                bgcolor: "rgba(0,0,0,0.2)",
                "&:hover .zoom-btn": { opacity: 1 },
              }}
            >
              <img
                src={pages[currentPage].illustrationUrl}
                alt={`Page ${currentPage + 1}`}
                style={{
                  maxWidth: "100%",
                  maxHeight: "100%",
                  objectFit: "contain",
                  display: "block",
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

            {/* Page Text - Right side in landscape, Bottom in portrait */}
            <Box
              sx={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                p: { xs: 2, sm: 3, md: 4 },
                minHeight: { xs: "auto", sm: 150 },
                "@media (orientation: landscape)": {
                  maxWidth: "50%",
                  borderLeft: "1px solid rgba(232, 184, 109, 0.1)",
                  overflowY: "auto",
                },
                "@media (orientation: portrait)": {
                  borderTop: "1px solid rgba(232, 184, 109, 0.1)",
                },
              }}
            >
              <Typography
                sx={{
                  fontFamily:
                    '"Crimson Pro", Georgia, "Times New Roman", serif',
                  fontSize: {
                    xs: "1.2rem",
                    sm: "1.4rem",
                    md: "1.6rem",
                    lg: "1.8rem",
                  },
                  lineHeight: 1.9,
                  color: "rgba(255, 255, 255, 0.9)",
                  textAlign: "justify",
                  letterSpacing: "0.02em",
                }}
              >
                {pages[currentPage].text}
              </Typography>
            </Box>
          </Box>
        )}

        {/* Page Navigation */}
        <Box sx={{ display: "flex", justifyContent: "center", gap: 2, mb: 4 }}>
          {isMobile ? (
            <>
              <IconButton
                id="btn-prev-page"
                onClick={goToPrevPage}
                disabled={currentPage <= minPage}
                sx={{
                  border: "1px solid",
                  borderColor: "primary.main",
                  color: "primary.main",
                  "&:disabled": {
                    borderColor: "action.disabled",
                    color: "action.disabled",
                  },
                }}
              >
                <ArrowBack />
              </IconButton>
              <IconButton
                id="btn-next-page"
                onClick={goToNextPage}
                disabled={currentPage >= maxPage}
                sx={{
                  bgcolor: "primary.main",
                  color: "primary.contrastText",
                  "&:hover": { bgcolor: "primary.dark" },
                  "&:disabled": {
                    bgcolor: "action.disabledBackground",
                    color: "action.disabled",
                  },
                }}
              >
                <ArrowForward />
              </IconButton>
            </>
          ) : (
            <>
              <Button
                id="btn-prev-page"
                variant="outlined"
                startIcon={<ArrowBack />}
                onClick={goToPrevPage}
                disabled={currentPage <= minPage}
              >
                {currentPage === 0 && cover ? "Cover" : "Previous"}
              </Button>
              <Button
                id="btn-next-page"
                variant="contained"
                endIcon={<ArrowForward />}
                onClick={goToNextPage}
                disabled={currentPage >= maxPage}
              >
                Next Page
              </Button>
            </>
          )}
        </Box>
      </Box>
    </Box>
  );
}

export default StoryViewer;
