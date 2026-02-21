import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Stack,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import {
  Add,
  ThumbUp,
  ThumbUpOutlined,
  AutoAwesome,
  Comment as CommentIcon,
  Edit,
  Delete,
} from "@mui/icons-material";
import { GoogleLogin } from "@react-oauth/google";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";

import { STORY_GENRES } from "../constants/genres";

function OpenStoriesPage() {
  const navigate = useNavigate();
  const { isAuthenticated, userId, isPro, login } = useAuth();

  const [openSubmissions, setOpenSubmissions] = useState([]);
  const [plansStatus, setPlansStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [submitTitle, setSubmitTitle] = useState("");
  const [submitStory, setSubmitStory] = useState("");
  const [submitGenre, setSubmitGenre] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [votingId, setVotingId] = useState(null);

  const [commentsDialogOpen, setCommentsDialogOpen] = useState(false);
  const [commentsSubmission, setCommentsSubmission] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editSubmission, setEditSubmission] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editStory, setEditStory] = useState("");
  const [editGenre, setEditGenre] = useState("");
  const [editImages, setEditImages] = useState([]);
  const [savingEdit, setSavingEdit] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [deletingImageId, setDeletingImageId] = useState(null);
  const editImageInputRef = useRef(null);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteSubmission, setDeleteSubmission] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingCommentText, setEditingCommentText] = useState("");
  const [savingCommentEdit, setSavingCommentEdit] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState(null);

  const canGenerateIllustrations = isPro || plansStatus?.inTeam;

  const handleLoginSuccess = async (credentialResponse) => {
    try {
      await login(credentialResponse.credential);
    } catch (e) {
      console.error("Login failed:", e);
    }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (isAuthenticated && userId) {
        const [openRes, plansRes] = await Promise.all([
          fetch("/api/v1/open-stories"),
          api.get("/api/v1/plans/status"),
        ]);
        const openData = await openRes.json();
        setOpenSubmissions(openData.submissions || []);
        try {
          const plansData = await plansRes.json();
          setPlansStatus(plansData);
        } catch {
          setPlansStatus(null);
        }
      } else {
        const openRes = await fetch("/api/v1/open-stories");
        const openData = await openRes.json();
        setOpenSubmissions(openData.submissions || []);
      }
    } catch (err) {
      console.error("Failed to fetch open stories:", err);
      setError("Failed to load open stories");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, userId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatDate = (dateStr) => {
    if (!dateStr) return "Unknown";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleSubmitStory = async () => {
    if (!submitTitle.trim() || !submitStory.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post("/api/v1/open-stories", {
        title: submitTitle.trim(),
        story: submitStory.trim(),
        genre: submitGenre.trim() || null,
      });
      if (res.ok) {
        const data = await res.json();
        setOpenSubmissions((prev) => [
          { ...data, vote_count: 0, user_has_voted: false, comment_count: 0 },
          ...prev,
        ]);
        setSubmitDialogOpen(false);
        setSubmitTitle("");
        setSubmitStory("");
        setSubmitGenre("");
      } else {
        const err = await res.json();
        setError(err.reason || err.error || "Failed to submit");
      }
    } catch (e) {
      setError(e.message || "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  const openCommentsDialog = async (sub) => {
    setCommentsSubmission(sub);
    setCommentsDialogOpen(true);
    setComments([]);
    setCommentText("");
    setEditingCommentId(null);
    setEditingCommentText("");
    setDeletingCommentId(null);
    setCommentsLoading(true);
    try {
      const res = await fetch(`/api/v1/open-stories/${sub.id}/comments`);
      const data = await res.json();
      setComments(data.comments || []);
    } catch (err) {
      console.error("Failed to fetch comments:", err);
    } finally {
      setCommentsLoading(false);
    }
  };

  const handleSubmitComment = async () => {
    if (
      !commentsSubmission ||
      !commentText.trim() ||
      !isAuthenticated ||
      submittingComment
    )
      return;
    setSubmittingComment(true);
    try {
      const res = await api.post(
        `/api/v1/open-stories/${commentsSubmission.id}/comments`,
        { comment: commentText.trim() },
      );
      setComments((prev) => [...prev, res.data]);
      setCommentText("");
    } catch (err) {
      console.error("Failed to post comment:", err);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleVote = async (sub) => {
    if (!isAuthenticated) return;
    setVotingId(sub.id);
    try {
      const res = await api.post(`/api/v1/open-stories/${sub.id}/vote`);
      const data = await res.json();
      setOpenSubmissions((prev) =>
        prev.map((s) =>
          s.id === sub.id
            ? {
                ...s,
                vote_count: s.vote_count + (data.voted ? 1 : -1),
                user_has_voted: data.voted,
              }
            : s,
        ),
      );
    } catch (e) {
      console.error("Vote failed:", e);
    } finally {
      setVotingId(null);
    }
  };

  const handleGenerateIllustrations = (sub) => {
    navigate("/create", {
      state: {
        openSubmission: {
          id: sub.id,
          title: sub.title,
          story: sub.story_text,
        },
      },
    });
  };

  const openEditDialog = (sub, e) => {
    if (e) e.stopPropagation();
    setEditSubmission(sub);
    setEditTitle(sub.title);
    setEditStory(sub.story_text);
    setEditGenre(sub.genre || "");
    setEditImages([]);
    setEditDialogOpen(true);
  };

  useEffect(() => {
    if (!editDialogOpen || !editSubmission?.id) return;
    api.get(`/api/v1/open-stories/${editSubmission.id}`)
      .then((res) => res.json())
      .then((data) => setEditImages(data.images || []))
      .catch(() => setEditImages([]));
  }, [editDialogOpen, editSubmission?.id]);

  const handleEditUploadImage = (e) => {
    const file = e?.target?.files?.[0];
    if (!file || !editSubmission) return;
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = async () => {
      setUploadingImage(true);
      try {
        const res = await api.post(`/api/v1/open-stories/${editSubmission.id}/images`, {
          image: reader.result,
        });
        if (res.ok) {
          const created = await res.json();
          setEditImages((prev) => [...prev, created]);
        }
      } catch (err) {
        console.error("Failed to upload image:", err);
      } finally {
        setUploadingImage(false);
        if (editImageInputRef.current) editImageInputRef.current.value = "";
      }
    };
    reader.readAsDataURL(file);
  };

  const handleEditDeleteImage = async (img) => {
    if (!editSubmission) return;
    setDeletingImageId(img.id);
    try {
      const res = await api.del(`/api/v1/open-stories/${editSubmission.id}/images/${img.id}`);
      if (res.ok) {
        setEditImages((prev) => prev.filter((i) => i.id !== img.id));
      }
    } catch (err) {
      console.error("Failed to delete image:", err);
    } finally {
      setDeletingImageId(null);
    }
  };

  const closeEditDialog = () => {
    if (!savingEdit) {
      setEditDialogOpen(false);
      setEditSubmission(null);
      setEditTitle("");
      setEditStory("");
      setEditGenre("");
    }
  };

  const handleSaveEdit = async () => {
    if (!editSubmission || !editTitle.trim() || !editStory.trim()) return;
    setSavingEdit(true);
    try {
      const res = await api.put(`/api/v1/open-stories/${editSubmission.id}`, {
        title: editTitle.trim(),
        story: editStory.trim(),
        genre: editGenre.trim() || null,
      });
      if (res.ok) {
        const updated = await res.json();
        setOpenSubmissions((prev) =>
          prev.map((s) => (s.id === editSubmission.id ? { ...s, ...updated } : s)),
        );
        closeEditDialog();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to update story");
      }
    } catch (err) {
      setError("Failed to update story");
    } finally {
      setSavingEdit(false);
    }
  };

  const openDeleteDialog = (sub, e) => {
    if (e) e.stopPropagation();
    setDeleteSubmission(sub);
    setDeleteDialogOpen(true);
  };

  const closeDeleteDialog = () => {
    if (!deleting) {
      setDeleteDialogOpen(false);
      setDeleteSubmission(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteSubmission) return;
    setDeleting(true);
    try {
      const res = await api.del(`/api/v1/open-stories/${deleteSubmission.id}`);
      if (res.ok) {
        setOpenSubmissions((prev) => prev.filter((s) => s.id !== deleteSubmission.id));
        closeDeleteDialog();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to delete story");
      }
    } catch (err) {
      setError("Failed to delete story");
    } finally {
      setDeleting(false);
    }
  };

  const isOwnSubmission = (sub) => isAuthenticated && userId != null && Number(sub.user_id) === Number(userId);

  const isOwnComment = (c) => isAuthenticated && userId != null && Number(c.user_id) === Number(userId);

  const startEditComment = (c, e) => {
    if (e) e.stopPropagation();
    setEditingCommentId(c.id);
    setEditingCommentText(c.comment_text);
  };

  const cancelEditComment = () => {
    setEditingCommentId(null);
    setEditingCommentText("");
  };

  const saveEditComment = async () => {
    if (!commentsSubmission || !editingCommentId || !editingCommentText.trim()) return;
    setSavingCommentEdit(true);
    try {
      const res = await api.put(
        `/api/v1/open-stories/${commentsSubmission.id}/comments/${editingCommentId}`,
        { comment: editingCommentText.trim() },
      );
      if (res.ok) {
        const updated = await res.json();
        setComments((prev) =>
          prev.map((c) => (c.id === editingCommentId ? { ...c, ...updated } : c)),
        );
        cancelEditComment();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to update comment");
      }
    } catch (err) {
      setError("Failed to update comment");
    } finally {
      setSavingCommentEdit(false);
    }
  };

  const handleDeleteComment = async (c) => {
    if (!commentsSubmission) return;
    if (!window.confirm("Delete this comment?")) return;
    setDeletingCommentId(c.id);
    try {
      const res = await api.del(
        `/api/v1/open-stories/${commentsSubmission.id}/comments/${c.id}`,
      );
      if (res.ok) {
        setComments((prev) => prev.filter((x) => x.id !== c.id));
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to delete comment");
      }
    } catch (err) {
      setError("Failed to delete comment");
    } finally {
      setDeletingCommentId(null);
    }
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
        <Typography
          variant="h4"
          sx={{ fontFamily: '"Crimson Pro", serif', fontWeight: 700 }}
        >
          Open stories
        </Typography>
        <Button
          id="btn-open-submit-story"
          variant="contained"
          startIcon={<Add />}
          onClick={() => setSubmitDialogOpen(true)}
        >
          Submit story
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Anyone can submit a story. Everyone can vote and comment. Premium users
        can generate illustrations for stories they like.
      </Typography>

      {openSubmissions.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
          No open stories yet. Be the first to submit one!
        </Typography>
      ) : (
        <Grid container spacing={2}>
          {openSubmissions.map((sub) => (
            <Grid item xs={12} key={sub.id}>
              <Card
                id={`card-open-story-${sub.id}`}
                sx={{
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  bgcolor: "rgba(30, 30, 50, 0.6)",
                  border: "1px solid rgba(232, 184, 109, 0.15)",
                  cursor: "pointer",
                }}
                onClick={() => navigate(`/open-stories/${sub.id}`)}
              >
                <CardContent sx={{ flexGrow: 1 }}>
                  <Typography
                    variant="h6"
                    sx={{ fontFamily: '"Crimson Pro", serif', mb: 0.5 }}
                  >
                    {sub.title}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: "block", mb: 0.5 }}
                  >
                    by {sub.author_name || sub.author_email || "Anonymous"}
                  </Typography>
                  {sub.genre && (
                    <Typography
                      variant="caption"
                      color="primary"
                      sx={{ display: "block", mb: 1 }}
                    >
                      {sub.genre}
                    </Typography>
                  )}
                  <Typography
                    variant="body2"
                    sx={{
                      color: "text.secondary",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      display: "-webkit-box",
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: "vertical",
                      mb: 1.5,
                    }}
                  >
                    {sub.story_text}
                  </Typography>
                  <Stack
                    direction="row"
                    alignItems="center"
                    spacing={1}
                    flexWrap="wrap"
                  >
                    <Button
                      id={`btn-vote-open-story-${sub.id}`}
                      size="small"
                      startIcon={
                        sub.user_has_voted ? (
                          <ThumbUp fontSize="small" />
                        ) : (
                          <ThumbUpOutlined fontSize="small" />
                        )
                      }
                      onClick={(e) => {
                        e.stopPropagation();
                        handleVote(sub);
                      }}
                      disabled={!isAuthenticated || votingId === sub.id}
                      color={sub.user_has_voted ? "primary" : "inherit"}
                    >
                      {votingId === sub.id ? "..." : sub.vote_count}
                    </Button>
                    <Button
                      id={`btn-comments-open-story-${sub.id}`}
                      size="small"
                      startIcon={<CommentIcon fontSize="small" />}
                      onClick={(e) => {
                        e.stopPropagation();
                        openCommentsDialog(sub);
                      }}
                    >
                      Comments {sub.comment_count != null ? sub.comment_count : 0}
                    </Button>
                    {canGenerateIllustrations && (
                      <Button
                        id={`btn-generate-illustrations-open-story-${sub.id}`}
                        size="small"
                        variant="outlined"
                        startIcon={<AutoAwesome fontSize="small" />}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleGenerateIllustrations(sub);
                        }}
                      >
                        Generate illustrations
                      </Button>
                    )}
                    {isOwnSubmission(sub) && (
                      <>
                        <Button
                          id={`btn-edit-open-story-${sub.id}`}
                          size="small"
                          startIcon={<Edit fontSize="small" />}
                          onClick={(e) => openEditDialog(sub, e)}
                        >
                          Edit
                        </Button>
                        <Button
                          id={`btn-delete-open-story-${sub.id}`}
                          size="small"
                          startIcon={<Delete fontSize="small" />}
                          onClick={(e) => openDeleteDialog(sub, e)}
                          color="error"
                        >
                          Delete
                        </Button>
                      </>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Comments dialog */}
      <Dialog
        open={commentsDialogOpen}
        onClose={() => setCommentsDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {commentsSubmission ? commentsSubmission.title : "Comments"}
        </DialogTitle>
        <DialogContent dividers>
          {commentsSubmission && (
            <>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mb: 1 }}
              >
                by{" "}
                {commentsSubmission.author_name ||
                  commentsSubmission.author_email ||
                  "Anonymous"}
              </Typography>
              <Typography
                variant="body2"
                sx={{ whiteSpace: "pre-wrap", mb: 2 }}
              >
                {commentsSubmission.story_text}
              </Typography>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Comments
              </Typography>
              {commentsLoading ? (
                <Box
                  sx={{ display: "flex", justifyContent: "center", py: 2 }}
                >
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
                      <Box
                        key={c.id}
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
                              id={`input-edit-comment-${c.id}`}
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
                                id={`btn-save-edit-comment-${c.id}`}
                                size="small"
                                variant="contained"
                                onClick={saveEditComment}
                                disabled={!editingCommentText.trim() || savingCommentEdit}
                              >
                                {savingCommentEdit ? <CircularProgress size={18} /> : "Save"}
                              </Button>
                              <Button id={`btn-cancel-edit-comment-${c.id}`} size="small" onClick={cancelEditComment} disabled={savingCommentEdit}>
                                Cancel
                              </Button>
                            </Stack>
                          </>
                        ) : (
                          <>
                            <Typography variant="body2">
                              {c.comment_text}
                            </Typography>
                            <Stack direction="row" alignItems="center" flexWrap="wrap" gap={0.5}>
                              <Typography variant="caption" color="text.secondary">
                                — {c.author_name || c.author_email || "Anonymous"}
                                {" · "}
                                {formatDate(c.created_at)}
                              </Typography>
                              {isOwnComment(c) && (
                                <>
                                  <Button
                                    id={`btn-edit-comment-${c.id}`}
                                    size="small"
                                    sx={{ minWidth: 0, py: 0 }}
                                    onClick={(e) => startEditComment(c, e)}
                                  >
                                    Edit
                                  </Button>
                                  <Button
                                    id={`btn-delete-comment-${c.id}`}
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
                      </Box>
                    ))
                  )}
                </Stack>
              )}
              {isAuthenticated && (
                <>
                  <TextField
                    id="input-new-comment"
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
                    id="btn-post-comment"
                    variant="contained"
                    size="small"
                    onClick={handleSubmitComment}
                    disabled={
                      !commentText.trim() || submittingComment
                    }
                  >
                    {submittingComment ? (
                      <CircularProgress size={20} />
                    ) : (
                      "Post comment"
                    )}
                  </Button>
                </>
              )}
              {!isAuthenticated && (
                <Typography variant="body2" color="text.secondary">
                  Sign in to comment.
                </Typography>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Submit story dialog */}
      <Dialog
        open={submitDialogOpen}
        onClose={() => !submitting && setSubmitDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Submit story</DialogTitle>
        <DialogContent>
          {!isAuthenticated && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Sign in to submit a story.
              <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
                <GoogleLogin
                  onSuccess={handleLoginSuccess}
                  onError={() => console.error("Google Login Failed")}
                  theme="filled_black"
                  shape="pill"
                  size="medium"
                  text="signin_with"
                  locale="en"
                />
              </Box>
            </Alert>
          )}
          <TextField
            id="input-submit-title"
            autoFocus
            margin="dense"
            label="Title"
            fullWidth
            value={submitTitle}
            onChange={(e) => setSubmitTitle(e.target.value)}
            placeholder="Story title"
          />
          <FormControl fullWidth margin="dense">
            <InputLabel id="submit-genre-label">Genre</InputLabel>
            <Select
              id="input-submit-genre"
              labelId="submit-genre-label"
              label="Genre"
              value={submitGenre}
              onChange={(e) => setSubmitGenre(e.target.value)}
            >
              <MenuItem value="">Select genre</MenuItem>
              {STORY_GENRES.map((g) => (
                <MenuItem key={g} value={g}>
                  {g}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            id="input-submit-story"
            margin="dense"
            label="Story"
            fullWidth
            multiline
            minRows={6}
            value={submitStory}
            onChange={(e) => setSubmitStory(e.target.value)}
            placeholder="Write your story here..."
          />
        </DialogContent>
        <DialogActions>
          <Button
            id="btn-submit-dialog-cancel"
            onClick={() => setSubmitDialogOpen(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            id="btn-submit-dialog-submit"
            variant="contained"
            onClick={handleSubmitStory}
            disabled={
              !isAuthenticated ||
              !submitTitle.trim() ||
              !submitStory.trim() ||
              submitting
            }
          >
            {submitting ? <CircularProgress size={24} /> : "Submit"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit story dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={closeEditDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit story</DialogTitle>
        <DialogContent>
          <TextField
            id="input-edit-title"
            autoFocus
            margin="dense"
            label="Title"
            fullWidth
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            placeholder="Story title"
          />
          <FormControl fullWidth margin="dense">
            <InputLabel id="edit-genre-label">Genre</InputLabel>
            <Select
              id="input-edit-genre"
              labelId="edit-genre-label"
              label="Genre"
              value={editGenre}
              onChange={(e) => setEditGenre(e.target.value)}
            >
              <MenuItem value="">Select genre</MenuItem>
              {STORY_GENRES.map((g) => (
                <MenuItem key={g} value={g}>
                  {g}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            id="input-edit-story"
            margin="dense"
            label="Story"
            fullWidth
            multiline
            minRows={6}
            value={editStory}
            onChange={(e) => setEditStory(e.target.value)}
            placeholder="Write your story here..."
          />
          <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
            Images
          </Typography>
          <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 1 }}>
            {editImages.map((img) => (
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
                  id={`btn-delete-edit-image-${img.id}`}
                  size="small"
                  color="error"
                  sx={{ position: "absolute", top: 0, right: 0, minWidth: 0, py: 0, px: 0.5 }}
                  onClick={() => handleEditDeleteImage(img)}
                  disabled={deletingImageId === img.id}
                >
                  ×
                </Button>
              </Box>
            ))}
          </Stack>
          <input
            id="input-edit-image-file"
            type="file"
            accept="image/*"
            ref={editImageInputRef}
            onChange={handleEditUploadImage}
            style={{ display: "none" }}
          />
          <Button
            id="btn-edit-add-image"
            size="small"
            variant="outlined"
            onClick={() => editImageInputRef.current?.click()}
            disabled={uploadingImage}
          >
            {uploadingImage ? "Uploading..." : "Add image"}
          </Button>
        </DialogContent>
        <DialogActions>
          <Button id="btn-edit-dialog-cancel" onClick={closeEditDialog} disabled={savingEdit}>
            Cancel
          </Button>
          <Button
            id="btn-edit-dialog-save"
            variant="contained"
            onClick={handleSaveEdit}
            disabled={!editTitle.trim() || !editStory.trim() || savingEdit}
          >
            {savingEdit ? <CircularProgress size={24} /> : "Save"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete story confirmation */}
      <Dialog open={deleteDialogOpen} onClose={closeDeleteDialog}>
        <DialogTitle>Delete story?</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete &quot;{deleteSubmission?.title}&quot;? This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button id="btn-delete-dialog-cancel" onClick={closeDeleteDialog} disabled={deleting}>
            Cancel
          </Button>
          <Button id="btn-delete-dialog-confirm" variant="contained" color="error" onClick={handleConfirmDelete} disabled={deleting}>
            {deleting ? <CircularProgress size={24} /> : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default OpenStoriesPage;
