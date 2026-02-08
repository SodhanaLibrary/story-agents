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
} from "@mui/material";
import { Close, Menu } from "@mui/icons-material";
import IconButton from "@mui/material/IconButton";
import StoryViewer from "../components/StoryViewer";
import { useAuth } from "../context/AuthContext";

function StoryViewPage() {
  const { userId } = useAuth();
  const { storyId } = useParams();
  const navigate = useNavigate();
  const [story, setStory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showPageList, setShowPageList] = useState(false);

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

  const handleDelete = () => {
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      const headers = { "Content-Type": "application/json" };
      if (userId) {
        headers["X-User-Id"] = userId;
      }
      const res = await fetch(`/api/stories/${storyId}`, {
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
        <Button
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
        </Box>
        <Box>
          <IconButton
            onClick={() => navigate("/")}
            sx={{ bgcolor: "rgba(0,0,0,0.5)" }}
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
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={confirmDelete}
            disabled={deleting}
          >
            {deleting ? "Deleting..." : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
}

export default StoryViewPage;
