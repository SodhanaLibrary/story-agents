import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box,
  CircularProgress,
  Typography,
  Alert,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Snackbar,
  useMediaQuery,
  useTheme,
  Tooltip,
} from "@mui/material";
import { Close, Menu, PictureAsPdf, Share } from "@mui/icons-material";
import StoryViewer from "../components/StoryViewer";
import { useAuth } from "../context/AuthContext";
import { downloadStoryPdf } from "../lib/downloadStoryPdf";

function StoryViewPage() {
  const { userId, isPremium, isAdmin, isSuperAdmin } = useAuth();
  const canDownloadPdf = isPremium || isAdmin || isSuperAdmin;
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { storyId } = useParams();
  const navigate = useNavigate();
  const [story, setStory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showPageList, setShowPageList] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [pdfProgress, setPdfProgress] = useState("");
  const [shareSnackbar, setShareSnackbar] = useState(false);

  useEffect(() => {
    const fetchStory = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/v1/stories/${storyId}`);
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

  const handleDelete = () => {
    setDeleteDialogOpen(true);
  };

  const handleDownloadPdf = async () => {
    if (!canDownloadPdf) {
      navigate("/pricing");
      return;
    }
    if (!story || pdfGenerating) return;
    setPdfGenerating(true);
    setPdfProgress("Preparing...");
    try {
      await downloadStoryPdf(story, {
        onProgress: setPdfProgress,
      });
    } catch (err) {
      console.error("Failed to generate PDF:", err);
      setError("Failed to generate PDF");
    } finally {
      setPdfGenerating(false);
      setPdfProgress("");
    }
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/story/${storyId}`;
    const title = story?.storyPages?.title || "Story";
    try {
      if (navigator.share) {
        await navigator.share({
          title,
          url,
          text: `Check out "${title}"`,
        });
      } else {
        await navigator.clipboard.writeText(url);
        setShareSnackbar(true);
      }
    } catch (err) {
      if (err?.name !== "AbortError") {
        try {
          await navigator.clipboard.writeText(url);
          setShareSnackbar(true);
        } catch {
          setError("Could not share or copy link");
        }
      }
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      const headers = { "Content-Type": "application/json" };
      if (userId) {
        headers["X-User-Id"] = userId;
      }
      const res = await fetch(`/api/v1/stories/${storyId}`, {
        method: "DELETE",
        headers,
      });
      if (res.ok) {
        navigate("/");
      } else {
        const data = await res.json();
        setError(data.error || "Failed to delete story");
      }
    } catch (err) {
      console.error("Failed to delete story:", err);
      setError("Failed to delete story");
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
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
        <Button id="btn-back-to-library-error" variant="contained" onClick={() => navigate("/")}>
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
        <Button
          id="btn-back-to-library-not-found"
          variant="contained"
          onClick={() => navigate("/")}
          sx={{ mt: 2 }}
        >
          Back to Library
        </Button>
      </Box>
    );
  }

  return (
    <Dialog fullScreen open={true} onClose={() => {}}>
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        p={2}
        pt={1}
      >
        <Box display="flex" alignItems="center" gap={0}>
          <IconButton
            id="btn-toggle-page-list"
            edge="start"
            color="inherit"
            aria-label="menu"
            sx={{ mr: 2 }}
            onClick={() => setShowPageList(!showPageList)}
          >
            <Menu />
          </IconButton>
          <Typography
            variant="h4"
            sx={{ fontFamily: '"Crimson Pro", serif', fontWeight: 700 }}
          >
            {story?.storyPages?.title}
          </Typography>
          {story?.metadata?.genre && (
            <Typography variant="body2" color="primary" sx={{ mt: 0.5 }}>
              {story.metadata.genre}
            </Typography>
          )}
        </Box>
        <Box display="flex" alignItems="center" gap={1}>
          <Tooltip title="Share story">
            <span>
              {isMobile ? (
                <IconButton
                  id="btn-share-story"
                  color="inherit"
                  onClick={handleShare}
                  aria-label="Share story"
                >
                  <Share />
                </IconButton>
              ) : (
                <Button
                  id="btn-share-story"
                  variant="outlined"
                  size="small"
                  startIcon={<Share />}
                  onClick={handleShare}
                >
                  Share
                </Button>
              )}
            </span>
          </Tooltip>
          <Tooltip title={canDownloadPdf ? (pdfGenerating ? pdfProgress || "Generating PDF…" : "Download PDF") : "Upgrade to Premium to download PDF"}>
            <span>
              {isMobile ? (
                <IconButton
                  id="btn-download-story-pdf"
                  color="inherit"
                  onClick={handleDownloadPdf}
                  disabled={pdfGenerating}
                  aria-label={canDownloadPdf ? "Download PDF" : "Upgrade to download PDF"}
                >
                  <PictureAsPdf />
                </IconButton>
              ) : (
                <Button
                  id="btn-download-story-pdf"
                  variant="outlined"
                  size="small"
                  startIcon={<PictureAsPdf />}
                  onClick={handleDownloadPdf}
                  disabled={pdfGenerating}
                >
                  {pdfGenerating ? pdfProgress || "Generating PDF…" : "Download PDF"}
                </Button>
              )}
            </span>
          </Tooltip>
          <IconButton
            id="btn-close-story-view"
            onClick={() => navigate("/")}
            sx={{ bgcolor: "rgba(0,0,0,0.5)" }}
            aria-label="Close"
          >
            <Close />
          </IconButton>
        </Box>
      </Box>

      <StoryViewer
        showPageList={showPageList}
        story={story}
        onReset={() => navigate("/")}
        onEdit={handleEdit}
        onDelete={handleDelete}
        isEditable={userId && story?.userId === userId}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Delete Story?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Are you sure you want to delete "{story?.storyPages?.title}"? This
            action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button id="btn-cancel-delete-story" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button
            id="btn-confirm-delete-story"
            variant="contained"
            color="error"
            onClick={confirmDelete}
            disabled={deleting}
          >
            {deleting ? "Deleting..." : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
      <Snackbar
        open={shareSnackbar}
        autoHideDuration={3000}
        onClose={() => setShareSnackbar(false)}
        message="Link copied to clipboard"
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </Dialog>
  );
}

export default StoryViewPage;
