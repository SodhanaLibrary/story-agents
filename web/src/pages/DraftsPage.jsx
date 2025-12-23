import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Stack,
  Chip,
  IconButton,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import { Edit, Delete, PlayArrow } from "@mui/icons-material";
import { useAuth } from "../context/AuthContext";

function DraftsPage() {
  const navigate = useNavigate();
  const { userId } = useAuth();
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, draft: null });
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const fetchDrafts = async () => {
      if (!userId) {
        setLoading(false);
        return;
      }
      
      setLoading(true);
      try {
        const res = await fetch(`/api/drafts?userId=${userId}`);
        const data = await res.json();
        setDrafts(data.drafts || []);
      } catch (err) {
        console.error("Failed to fetch drafts:", err);
        setError("Failed to load drafts");
      } finally {
        setLoading(false);
      }
    };

    fetchDrafts();
  }, [userId]);

  const handleResumeDraft = async (draft) => {
    try {
      const response = await fetch(`/api/drafts/${draft.jobId}/resume`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();
      
      if (data.success) {
        // Navigate to create page with draft state
        navigate("/create", { state: { draft: data.draft, jobId: data.jobId } });
      } else {
        setError(data.error || "Failed to resume draft");
      }
    } catch (err) {
      console.error("Failed to resume draft:", err);
      setError("Failed to resume draft");
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog.draft) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/drafts/${deleteDialog.draft.jobId}`, { method: "DELETE" });
      if (res.ok) {
        setDrafts((prev) => prev.filter((d) => d.jobId !== deleteDialog.draft.jobId));
        setDeleteDialog({ open: false, draft: null });
      } else {
        setError("Failed to delete draft");
      }
    } catch (err) {
      console.error("Failed to delete draft:", err);
      setError("Failed to delete draft");
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "Unknown";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
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
        ✏️ My Drafts
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {drafts.length === 0 ? (
        <Box sx={{ textAlign: "center", py: 8 }}>
          <Edit sx={{ fontSize: 64, color: "text.secondary", opacity: 0.5, mb: 2 }} />
          <Typography variant="h6" sx={{ color: "text.secondary" }}>
            No drafts
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary", mb: 3 }}>
            Stories you start but don&apos;t finish will appear here
          </Typography>
          <Button variant="contained" onClick={() => navigate("/create")}>
            Create New Story
          </Button>
        </Box>
      ) : (
        <Stack spacing={2}>
          {drafts.map((draft) => (
            <Card
              key={draft.jobId}
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
              <Box
                sx={{
                  width: 100,
                  bgcolor: "rgba(123, 104, 238, 0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Edit sx={{ fontSize: 32, color: "secondary.main" }} />
              </Box>
              
              <CardContent sx={{ flex: 1, py: 1.5 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
                  {draft.title || "Untitled Draft"}
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip
                    label={draft.stepLabel || "In Progress"}
                    size="small"
                    color="secondary"
                    sx={{ fontSize: "0.7rem" }}
                  />
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
                  onClick={() => handleResumeDraft(draft)}
                >
                  Continue
                </Button>
                <IconButton
                  size="small"
                  sx={{ color: "error.main" }}
                  onClick={() => setDeleteDialog({ open: true, draft })}
                >
                  <Delete fontSize="small" />
                </IconButton>
              </Box>
            </Card>
          ))}
        </Stack>
      )}

      {/* Delete Dialog */}
      <Dialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, draft: null })}
        PaperProps={{ sx: { bgcolor: "background.paper" } }}
      >
        <DialogTitle>Delete Draft?</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete &quot;{deleteDialog.draft?.title || "this draft"}&quot;?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, draft: null })} disabled={deleting}>
            Cancel
          </Button>
          <Button onClick={handleDelete} color="error" variant="contained" disabled={deleting}>
            {deleting ? <CircularProgress size={20} /> : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default DraftsPage;

