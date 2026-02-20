import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  Button,
  Stack,
  CircularProgress,
  Alert,
  TextField,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import {
  ArrowBack,
  ThumbUp,
  ThumbUpOutlined,
  AutoAwesome,
  Edit,
  Delete,
} from "@mui/icons-material";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";

const OPEN_STORY_GENRES = [
  "Real life",
  "Fantasy",
  "Science Fiction",
  "Mystery",
  "Horror",
  "Romance",
  "Adventure",
  "Realistic Fiction",
  "Historical Fiction",
  "Comedy",
  "Children's Stories",
  "Biography",
];

function OpenStoryDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, userId, isPro } = useAuth();
  const [plansStatus, setPlansStatus] = useState(null);

  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [voting, setVoting] = useState(false);

  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  const [editStoryOpen, setEditStoryOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editStory, setEditStory] = useState("");
  const [editGenre, setEditGenre] = useState("");
  const [savingStory, setSavingStory] = useState(false);
  const [deleteStoryConfirmOpen, setDeleteStoryConfirmOpen] = useState(false);
  const [deletingStory, setDeletingStory] = useState(false);

  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingCommentText, setEditingCommentText] = useState("");
  const [savingCommentEdit, setSavingCommentEdit] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState(null);

  const [uploadingImage, setUploadingImage] = useState(false);
  const [deletingImageId, setDeletingImageId] = useState(null);

  const canGenerateIllustrations = isPro || plansStatus?.inTeam;
  const isOwnStory = submission && isAuthenticated && userId != null && Number(submission.user_id) === Number(userId);
  const isOwnComment = (c) => isAuthenticated && userId != null && Number(c.user_id) === Number(userId);

  useEffect(() => {
    let cancelled = false;
    async function fetchSubmission() {
      if (!id) return;
      setLoading(true);
      setError(null);
      try {
        const res = await api.get(`/api/open-stories/${id}`);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error || "Story not found");
          return;
        }
        setSubmission(data);
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to fetch open story:", err);
          setError("Failed to load story");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchSubmission();
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    if (!submission?.id) return;
    setCommentsLoading(true);
    fetch(`/api/open-stories/${submission.id}/comments`)
      .then((res) => res.json())
      .then((data) => setComments(data.comments || []))
      .catch(() => setComments([]))
      .finally(() => setCommentsLoading(false));
  }, [submission?.id]);

  useEffect(() => {
    if (!isAuthenticated || !userId) return;
    api.get("/api/plans/status").then((res) => res.json()).then(setPlansStatus).catch(() => setPlansStatus(null));
  }, [isAuthenticated, userId]);

  const formatDate = (dateStr) => {
    if (!dateStr) return "Unknown";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleVote = async () => {
    if (!isAuthenticated || !submission) return;
    setVoting(true);
    try {
      const res = await api.post(`/api/open-stories/${submission.id}/vote`);
      const data = await res.json();
      setSubmission((prev) =>
        prev
          ? {
              ...prev,
              vote_count: prev.vote_count + (data.voted ? 1 : -1),
              user_has_voted: data.voted,
            }
          : null,
      );
    } catch (e) {
      console.error("Vote failed:", e);
    } finally {
      setVoting(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!submission || !commentText.trim() || !isAuthenticated || submittingComment) return;
    setSubmittingComment(true);
    try {
      const res = await api.post(`/api/open-stories/${submission.id}/comments`, {
        comment: commentText.trim(),
      });
      const created = await res.json();
      setComments((prev) => [...prev, created]);
      setCommentText("");
    } catch (err) {
      console.error("Failed to post comment:", err);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleGenerateIllustrations = () => {
    if (!submission) return;
    navigate("/create", {
      state: {
        openSubmission: {
          id: submission.id,
          title: submission.title,
          story: submission.story_text,
        },
      },
    });
  };

  const openEditStory = () => {
    setEditTitle(submission.title);
    setEditStory(submission.story_text);
    setEditGenre(submission.genre || "");
    setEditStoryOpen(true);
  };

  const saveEditStory = async () => {
    if (!submission || !editTitle.trim() || !editStory.trim()) return;
    setSavingStory(true);
    try {
      const res = await api.put(`/api/open-stories/${submission.id}`, {
        title: editTitle.trim(),
        story: editStory.trim(),
        genre: editGenre.trim() || null,
      });
      if (res.ok) {
        const updated = await res.json();
        setSubmission((prev) => (prev ? { ...prev, ...updated } : null));
        setEditStoryOpen(false);
      }
    } catch (err) {
      console.error("Failed to update story:", err);
    } finally {
      setSavingStory(false);
    }
  };

  const confirmDeleteStory = async () => {
    if (!submission) return;
    setDeletingStory(true);
    try {
      const res = await api.del(`/api/open-stories/${submission.id}`);
      if (res.ok) {
        navigate("/open-stories");
      }
    } catch (err) {
      console.error("Failed to delete story:", err);
    } finally {
      setDeletingStory(false);
    }
  };

  const startEditComment = (c) => {
    setEditingCommentId(c.id);
    setEditingCommentText(c.comment_text);
  };

  const cancelEditComment = () => {
    setEditingCommentId(null);
    setEditingCommentText("");
  };

  const saveEditComment = async () => {
    if (!submission || !editingCommentId || !editingCommentText.trim()) return;
    setSavingCommentEdit(true);
    try {
      const res = await api.put(
        `/api/open-stories/${submission.id}/comments/${editingCommentId}`,
        { comment: editingCommentText.trim() },
      );
      if (res.ok) {
        const updated = await res.json();
        setComments((prev) =>
          prev.map((c) => (c.id === editingCommentId ? { ...c, ...updated } : c)),
        );
        cancelEditComment();
      }
    } catch (err) {
      console.error("Failed to update comment:", err);
    } finally {
      setSavingCommentEdit(false);
    }
  };

  const handleDeleteComment = async (c) => {
    if (!submission || !window.confirm("Delete this comment?")) return;
    setDeletingCommentId(c.id);
    try {
      const res = await api.del(
        `/api/open-stories/${submission.id}/comments/${c.id}`,
      );
      if (res.ok) {
        setComments((prev) => prev.filter((x) => x.id !== c.id));
      }
    } catch (err) {
      console.error("Failed to delete comment:", err);
    } finally {
      setDeletingCommentId(null);
    }
  };

  const fileInputRef = useRef(null);

  const handleUploadImage = (e) => {
    const file = e?.target?.files?.[0];
    if (!file || !submission) return;
    if (!file.type.startsWith("image/")) {
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result;
      setUploadingImage(true);
      try {
        const res = await api.post(`/api/open-stories/${submission.id}/images`, { image: dataUrl });
        if (res.ok) {
          const created = await res.json();
          setSubmission((prev) => (prev ? { ...prev, images: [...(prev.images || []), created] } : null));
        }
      } catch (err) {
        console.error("Failed to upload image:", err);
      } finally {
        setUploadingImage(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteImage = async (img) => {
    if (!submission || !window.confirm("Remove this image?")) return;
    setDeletingImageId(img.id);
    try {
      const res = await api.del(`/api/open-stories/${submission.id}/images/${img.id}`);
      if (res.ok) {
        setSubmission((prev) => (prev ? { ...prev, images: (prev.images || []).filter((i) => i.id !== img.id) } : null));
      }
    } catch (err) {
      console.error("Failed to delete image:", err);
    } finally {
      setDeletingImageId(null);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !submission) {
    return (
      <Box sx={{ py: 4 }}>
        <Button id="btn-open-detail-back-error" startIcon={<ArrowBack />} onClick={() => navigate("/open-stories")} sx={{ mb: 2 }}>
          Back to Open stories
        </Button>
        <Alert severity="error">{error || "Story not found"}</Alert>
      </Box>
    );
  }

  return (
    <Box className="fade-in">
      <Button
        id="btn-open-detail-back"
        startIcon={<ArrowBack />}
        onClick={() => navigate("/open-stories")}
        sx={{ mb: 2 }}
      >
        Back to Open stories
      </Button>

      <Paper
        elevation={0}
        sx={{
          p: 3,
          bgcolor: "rgba(30, 30, 50, 0.6)",
          border: "1px solid rgba(232, 184, 109, 0.15)",
          borderRadius: 2,
        }}
      >
        <Typography
          variant="h4"
          sx={{ fontFamily: '"Crimson Pro", serif', fontWeight: 700, mb: 1 }}
        >
          {submission.title}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
          by {submission.author_name || submission.author_email || "Anonymous"}
        </Typography>
        {submission.genre && (
          <Typography variant="body2" color="primary" sx={{ mb: 2 }}>
            {submission.genre}
          </Typography>
        )}
        {!submission.genre && <Box sx={{ mb: 2 }} />}

        <Typography
          variant="body1"
          sx={{ whiteSpace: "pre-wrap", mb: 2 }}
        >
          {submission.story_text}
        </Typography>

        {(submission.images || []).length > 0 && (
          <Stack direction="row" flexWrap="wrap" gap={1.5} sx={{ mb: 3 }}>
            {(submission.images || []).map((img) => (
              <Box
                key={img.id}
                sx={{
                  position: "relative",
                  borderRadius: 1,
                  overflow: "hidden",
                  border: "1px solid",
                  borderColor: "divider",
                }}
              >
                <Box
                  component="img"
                  src={img.image_url}
                  alt=""
                  sx={{
                    display: "block",
                    maxWidth: 280,
                    maxHeight: 200,
                    objectFit: "contain",
                    bgcolor: "rgba(0,0,0,0.2)",
                  }}
                />
                {isOwnStory && (
                  <Button
                    id={`btn-delete-detail-image-${img.id}`}
                    size="small"
                    color="error"
                    sx={{
                      position: "absolute",
                      top: 4,
                      right: 4,
                      minWidth: 0,
                      py: 0.25,
                      px: 0.75,
                    }}
                    onClick={() => handleDeleteImage(img)}
                    disabled={deletingImageId === img.id}
                  >
                    {deletingImageId === img.id ? "..." : "×"}
                  </Button>
                )}
              </Box>
            ))}
          </Stack>
        )}

        {isOwnStory && (
          <Box sx={{ mb: 3 }}>
            <input
              id="input-detail-upload-image"
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={handleUploadImage}
              style={{ display: "none" }}
            />
            <Button
              id="btn-detail-upload-image"
              size="small"
              variant="outlined"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingImage}
            >
              {uploadingImage ? "Uploading..." : "Upload image"}
            </Button>
          </Box>
        )}

        <Stack direction="row" alignItems="center" spacing={2} flexWrap="wrap">
          <Button
            id="btn-detail-vote"
            size="medium"
            startIcon={
              submission.user_has_voted ? (
                <ThumbUp fontSize="small" />
              ) : (
                <ThumbUpOutlined fontSize="small" />
              )
            }
            onClick={handleVote}
            disabled={!isAuthenticated || voting}
            color={submission.user_has_voted ? "primary" : "inherit"}
          >
            {voting ? "..." : submission.vote_count} {submission.vote_count === 1 ? "vote" : "votes"}
          </Button>
          {canGenerateIllustrations && (
            <Button
              id="btn-detail-generate-illustrations"
              size="medium"
              variant="outlined"
              startIcon={<AutoAwesome fontSize="small" />}
              onClick={handleGenerateIllustrations}
            >
              Generate illustrations
            </Button>
          )}
          {isOwnStory && (
            <>
              <Button
                id="btn-detail-edit-story"
                size="medium"
                startIcon={<Edit fontSize="small" />}
                onClick={openEditStory}
              >
                Edit
              </Button>
              <Button
                id="btn-detail-delete-story"
                size="medium"
                color="error"
                startIcon={<Delete fontSize="small" />}
                onClick={() => setDeleteStoryConfirmOpen(true)}
              >
                Delete
              </Button>
            </>
          )}
        </Stack>
      </Paper>

      {/* Edit story dialog */}
      <Dialog open={editStoryOpen} onClose={() => !savingStory && setEditStoryOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit story</DialogTitle>
        <DialogContent>
          <TextField
            id="input-detail-edit-title"
            autoFocus
            margin="dense"
            label="Title"
            fullWidth
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
          />
          <FormControl fullWidth margin="dense">
            <InputLabel id="edit-genre-label">Genre</InputLabel>
            <Select
              id="input-detail-edit-genre"
              labelId="edit-genre-label"
              label="Genre"
              value={editGenre}
              onChange={(e) => setEditGenre(e.target.value)}
            >
              <MenuItem value="">Select genre</MenuItem>
              {OPEN_STORY_GENRES.map((g) => (
                <MenuItem key={g} value={g}>
                  {g}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            id="input-detail-edit-story"
            margin="dense"
            label="Story"
            fullWidth
            multiline
            minRows={6}
            value={editStory}
            onChange={(e) => setEditStory(e.target.value)}
          />
          <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
            Images
          </Typography>
          <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 1 }}>
            {(submission?.images || []).map((img) => (
              <Box key={img.id} sx={{ position: "relative" }}>
                <Box
                  component="img"
                  src={img.image_url}
                  alt=""
                  sx={{
                    width: 80,
                    height: 80,
                    objectFit: "cover",
                    borderRadius: 1,
                    border: "1px solid",
                    borderColor: "divider",
                  }}
                />
                <Button
                  id={`btn-edit-dialog-delete-image-${img.id}`}
                  size="small"
                  color="error"
                  sx={{ position: "absolute", top: 0, right: 0, minWidth: 0, py: 0, px: 0.5 }}
                  onClick={() => handleDeleteImage(img)}
                  disabled={deletingImageId === img.id}
                >
                  ×
                </Button>
              </Box>
            ))}
          </Stack>
          <Button
            id="btn-detail-edit-add-image"
            size="small"
            variant="outlined"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingImage}
          >
            {uploadingImage ? "Uploading..." : "Add image"}
          </Button>
        </DialogContent>
        <DialogActions>
          <Button id="btn-detail-edit-cancel" onClick={() => setEditStoryOpen(false)} disabled={savingStory}>Cancel</Button>
          <Button id="btn-detail-edit-save" variant="contained" onClick={saveEditStory} disabled={!editTitle.trim() || !editStory.trim() || savingStory}>
            {savingStory ? <CircularProgress size={24} /> : "Save"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete story confirmation */}
      <Dialog open={deleteStoryConfirmOpen} onClose={() => !deletingStory && setDeleteStoryConfirmOpen(false)}>
        <DialogTitle>Delete story?</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this story? This cannot be undone.</Typography>
        </DialogContent>
        <DialogActions>
          <Button id="btn-detail-delete-cancel" onClick={() => setDeleteStoryConfirmOpen(false)} disabled={deletingStory}>Cancel</Button>
          <Button id="btn-detail-delete-confirm" variant="contained" color="error" onClick={confirmDeleteStory} disabled={deletingStory}>
            {deletingStory ? <CircularProgress size={24} /> : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>

      <Typography variant="h6" sx={{ mt: 4, mb: 2 }}>
        Comments
      </Typography>
      {commentsLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
          <CircularProgress size={24} />
        </Box>
      ) : (
        <Stack spacing={1.5} sx={{ mb: 2 }}>
          {comments.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No comments yet. Be the first to comment!
            </Typography>
          ) : (
            comments.map((c) => (
              <Paper
                key={c.id}
                elevation={0}
                sx={{
                  p: 1.5,
                  bgcolor: "rgba(0,0,0,0.2)",
                  borderRadius: 1,
                  borderLeft: "3px solid",
                  borderColor: "primary.main",
                }}
              >
                {editingCommentId === c.id ? (
                  <>
                    <TextField
                      id={`input-detail-edit-comment-${c.id}`}
                      fullWidth
                      multiline
                      minRows={2}
                      value={editingCommentText}
                      onChange={(e) => setEditingCommentText(e.target.value)}
                      disabled={savingCommentEdit}
                      size="small"
                      sx={{ mb: 1 }}
                    />
                    <Stack direction="row" spacing={1}>
                      <Button
                        id={`btn-detail-save-comment-${c.id}`}
                        size="small"
                        variant="contained"
                        onClick={saveEditComment}
                        disabled={!editingCommentText.trim() || savingCommentEdit}
                      >
                        {savingCommentEdit ? <CircularProgress size={18} /> : "Save"}
                      </Button>
                      <Button id={`btn-detail-cancel-comment-${c.id}`} size="small" onClick={cancelEditComment} disabled={savingCommentEdit}>
                        Cancel
                      </Button>
                    </Stack>
                  </>
                ) : (
                  <>
                    <Typography variant="body2">{c.comment_text}</Typography>
                    <Stack direction="row" alignItems="center" flexWrap="wrap" gap={0.5}>
                      <Typography variant="caption" color="text.secondary">
                        — {c.author_name || c.author_email || "Anonymous"}
                        {" · "}
                        {formatDate(c.created_at)}
                      </Typography>
                      {isOwnComment(c) && (
                        <>
                          <Button id={`btn-detail-edit-comment-${c.id}`} size="small" sx={{ minWidth: 0, py: 0 }} onClick={() => startEditComment(c)}>
                            Edit
                          </Button>
                          <Button
                            id={`btn-detail-delete-comment-${c.id}`}
                            size="small"
                            color="error"
                            sx={{ minWidth: 0, py: 0 }}
                            onClick={() => handleDeleteComment(c)}
                            disabled={deletingCommentId === c.id}
                          >
                            {deletingCommentId === c.id ? "..." : "Delete"}
                          </Button>
                        </>
                      )}
                    </Stack>
                  </>
                )}
              </Paper>
            ))
          )}
        </Stack>
      )}
      {isAuthenticated && (
        <Box sx={{ mt: 2 }}>
          <TextField
            id="input-detail-new-comment"
            fullWidth
            multiline
            minRows={2}
            placeholder="Write a comment..."
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            disabled={submittingComment}
            size="small"
            sx={{ mb: 1 }}
          />
          <Button
            id="btn-detail-post-comment"
            variant="contained"
            size="small"
            onClick={handleSubmitComment}
            disabled={!commentText.trim() || submittingComment}
          >
            {submittingComment ? <CircularProgress size={20} /> : "Post comment"}
          </Button>
        </Box>
      )}
    </Box>
  );
}

export default OpenStoryDetailPage;
