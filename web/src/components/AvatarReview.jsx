import { useState, useEffect, useRef } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  TextField,
  CircularProgress,
  Alert,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  LinearProgress,
} from "@mui/material";
import {
  Check,
  Refresh,
  Edit,
  ArrowBack,
  ArrowForward,
  Person,
  ZoomIn,
  Close,
  CloudUpload,
  Image as ImageIcon,
  AutoAwesome,
  Delete,
} from "@mui/icons-material";

function AvatarReview({ jobId, onApprove, onBack }) {
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState({});
  const [editDialog, setEditDialog] = useState({
    open: false,
    character: null,
  });
  const [customDescription, setCustomDescription] = useState("");
  const [referenceImage, setReferenceImage] = useState(null);
  const [referenceImagePreview, setReferenceImagePreview] = useState(null);
  const [zoomImage, setZoomImage] = useState(null);
  const [approvedAvatars, setApprovedAvatars] = useState({});
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!jobId) return;

    const pollJob = async () => {
      try {
        const response = await fetch(`/api/job/${jobId}`);
        const data = await response.json();
        setJob(data);

        // Stop loading when characters are ready (or when editing a completed story)
        if (
          data.status === "characters_ready" ||
          data.status === "avatars_ready" ||
          data.status === "pages_ready" ||
          data.status === "pages_text_ready" ||
          data.status === "error"
        ) {
          setLoading(false);
        }
      } catch (err) {
        console.error("Failed to poll job:", err);
      }
    };

    pollJob();
    const interval = setInterval(pollJob, 2000);

    return () => clearInterval(interval);
  }, [jobId]);

  // Initialize approved state when characters are ready
  useEffect(() => {
    if (
      job?.status === "characters_ready" ||
      job?.status === "avatars_ready" ||
      job?.status === "pages_ready" ||
      job?.status === "pages_text_ready"
    ) {
      // Only initialize if not already set (to preserve user changes)
      if (Object.keys(approvedAvatars).length === 0) {
        const approved = {};
        job.characters?.forEach((char) => {
          // When editing (pages_ready status), auto-approve all existing avatars
          // For new creation, don't auto-approve
          if (job.status === "pages_ready" && char.avatarGenerated) {
            approved[char.name] = true;
          } else {
            approved[char.name] = false;
          }
        });
        setApprovedAvatars(approved);
      }
    }
  }, [job?.status, job?.characters?.length]);

  const handleFileSelect = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setReferenceImagePreview(reader.result);
        // Get base64 without the data:image/xxx;base64, prefix
        const base64 = reader.result.split(",")[1];
        setReferenceImage(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleClearImage = () => {
    setReferenceImage(null);
    setReferenceImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleGenerateAvatar = async (character, useDialog = false) => {
    const charName = character.name;
    setGenerating((prev) => ({ ...prev, [charName]: true }));

    if (useDialog) {
      setEditDialog({ open: false, character: null });
    }

    try {
      const response = await fetch("/api/generate-avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          characterName: charName,
          customDescription: useDialog
            ? customDescription
            : character.avatarPrompt,
          referenceImageBase64: useDialog ? referenceImage : null,
        }),
      });

      const data = await response.json();
      if (data.success) {
        // Update local state with new character data
        setJob((prev) => ({
          ...prev,
          characters: prev.characters.map((c) =>
            c.name === charName ? data.character : c
          ),
        }));
        // Reset approval for this character
        setApprovedAvatars((prev) => ({ ...prev, [charName]: false }));
      }
    } catch (error) {
      console.error("Failed to generate avatar:", error);
    } finally {
      setGenerating((prev) => ({ ...prev, [charName]: false }));
      setCustomDescription("");
      setReferenceImage(null);
      setReferenceImagePreview(null);
    }
  };

  const handleApprove = (characterName) => {
    setApprovedAvatars((prev) => ({ ...prev, [characterName]: true }));
  };

  const handleProceed = () => {
    onApprove(job.characters);
  };

  const openEditDialog = (character) => {
    setCustomDescription(
      character.customDescription || character.avatarPrompt || ""
    );
    setReferenceImage(null);
    setReferenceImagePreview(null);
    setEditDialog({ open: true, character });
  };

  // Check if all characters have avatars and are approved
  const allAvatarsGenerated =
    job?.characters?.length > 0 &&
    job.characters.every((char) => char.avatarGenerated);

  const allApproved =
    allAvatarsGenerated &&
    job.characters.every((char) => approvedAvatars[char.name]);

  const generatedCount =
    job?.characters?.filter((c) => c.avatarGenerated).length || 0;
  const approvedCount = Object.values(approvedAvatars).filter(Boolean).length;

  // Loading state while extracting characters
  if (
    loading ||
    !job ||
    (job.status === "running" && !job.characters?.length)
  ) {
    return (
      <Box className="fade-in">
        <Box sx={{ textAlign: "center", mb: 4 }}>
          <Typography variant="h2" sx={{ mb: 2, color: "primary.main" }}>
            Analyzing Story
          </Typography>
          <Typography variant="body1" sx={{ color: "text.secondary" }}>
            Our AI is reading your story and identifying characters...
          </Typography>
        </Box>

        <Card sx={{ maxWidth: 500, mx: "auto" }}>
          <CardContent sx={{ p: 4, textAlign: "center" }}>
            <CircularProgress sx={{ color: "primary.main", mb: 3 }} size={60} />
            <Typography variant="h6" sx={{ mb: 1 }}>
              {job?.phase === "character_extraction"
                ? "Extracting Characters"
                : job?.phase === "art_style_selection"
                  ? "Selecting Art Style"
                  : "Processing..."}
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {job?.message || "Please wait..."}
            </Typography>
            {job?.progress > 0 && (
              <Box sx={{ mt: 2 }}>
                <LinearProgress
                  variant="determinate"
                  value={job.progress}
                  sx={{ height: 6, borderRadius: 3 }}
                />
              </Box>
            )}
          </CardContent>
        </Card>
      </Box>
    );
  }

  // Error state
  if (job.status === "error") {
    return (
      <Box className="fade-in" sx={{ textAlign: "center", py: 8 }}>
        <Alert severity="error" sx={{ maxWidth: 500, mx: "auto" }}>
          <Typography variant="h6" sx={{ mb: 1 }}>
            Generation Failed
          </Typography>
          <Typography variant="body2">{job.error}</Typography>
        </Alert>
        <Button variant="outlined" onClick={onBack} sx={{ mt: 3 }}>
          Go Back
        </Button>
      </Box>
    );
  }

  return (
    <Box className="fade-in">
      <Box sx={{ textAlign: "center", mb: 4 }}>
        <Typography variant="h2" sx={{ mb: 2, color: "primary.main" }}>
          Create Character Avatars
        </Typography>
        <Typography
          variant="body1"
          sx={{ color: "text.secondary", maxWidth: 700, mx: "auto" }}
        >
          We found {job.characters?.length || 0} characters in your story. For
          each character, you can provide a custom description or upload a
          reference image, then generate their avatar.
        </Typography>
      </Box>

      {/* Art Style Info */}
      {job.artStyleDecision && (
        <Alert
          severity="info"
          sx={{
            mb: 3,
            bgcolor: "rgba(123, 104, 238, 0.1)",
            border: "1px solid rgba(123, 104, 238, 0.3)",
          }}
        >
          <Typography variant="body2">
            <strong>Art Style:</strong>{" "}
            {job.artStyleDecision.styleDetails?.name ||
              job.artStyleDecision.selectedStyle}
          </Typography>
        </Alert>
      )}

      {/* Progress indicator */}
      <Box sx={{ mb: 3, textAlign: "center" }}>
        <Stack direction="row" spacing={4} justifyContent="center">
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            <strong>{generatedCount}</strong> of {job.characters?.length || 0}{" "}
            avatars generated
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            <strong>{approvedCount}</strong> of {job.characters?.length || 0}{" "}
            approved
          </Typography>
        </Stack>
        <LinearProgress
          variant="determinate"
          value={(approvedCount / (job.characters?.length || 1)) * 100}
          sx={{ mt: 1, height: 6, borderRadius: 3, maxWidth: 400, mx: "auto" }}
        />
      </Box>

      {/* Character Grid */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {job.characters?.map((character, index) => (
          <Grid item xs={12} sm={6} md={4} key={index}>
            <Card
              sx={{
                height: "100%",
                border: approvedAvatars[character.name]
                  ? "2px solid"
                  : character.avatarGenerated
                    ? "1px solid rgba(76, 175, 80, 0.5)"
                    : "1px solid",
                borderColor: approvedAvatars[character.name]
                  ? "success.main"
                  : "rgba(232, 184, 109, 0.15)",
                transition: "all 0.2s",
                opacity: generating[character.name] ? 0.7 : 1,
              }}
            >
              {/* Avatar Image or Placeholder */}
              <Box
                sx={{
                  position: "relative",
                  "&:hover .actions": { opacity: 1 },
                }}
              >
                {generating[character.name] ? (
                  <Box
                    sx={{
                      height: 250,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      bgcolor: "rgba(0,0,0,0.3)",
                      gap: 2,
                    }}
                  >
                    <CircularProgress sx={{ color: "primary.main" }} />
                    <Typography
                      variant="body2"
                      sx={{ color: "text.secondary" }}
                    >
                      Generating avatar...
                    </Typography>
                  </Box>
                ) : character.avatarGenerated && character.avatarUrl ? (
                  <img
                    src={character.avatarUrl}
                    alt={character.name}
                    style={{
                      width: "100%",
                      height: 250,
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                ) : (
                  <Box
                    sx={{
                      height: 250,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      bgcolor: "rgba(232, 184, 109, 0.05)",
                      border: "2px dashed rgba(232, 184, 109, 0.3)",
                      gap: 2,
                    }}
                  >
                    <Person
                      sx={{ fontSize: 60, color: "rgba(232, 184, 109, 0.3)" }}
                    />
                    <Typography
                      variant="body2"
                      sx={{ color: "text.secondary" }}
                    >
                      No avatar yet
                    </Typography>
                  </Box>
                )}

                {/* Overlay Actions for existing avatar */}
                {character.avatarGenerated && character.avatarUrl && (
                  <Box
                    className="actions"
                    sx={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      bgcolor: "rgba(0,0,0,0.5)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 1,
                      opacity: 0,
                      transition: "opacity 0.2s",
                    }}
                  >
                    <IconButton
                      onClick={() => setZoomImage(character.avatarUrl)}
                      sx={{
                        bgcolor: "rgba(255,255,255,0.2)",
                        "&:hover": { bgcolor: "rgba(255,255,255,0.3)" },
                      }}
                    >
                      <ZoomIn />
                    </IconButton>
                    <IconButton
                      onClick={() => openEditDialog(character)}
                      sx={{
                        bgcolor: "rgba(255,255,255,0.2)",
                        "&:hover": { bgcolor: "rgba(255,255,255,0.3)" },
                      }}
                    >
                      <Refresh />
                    </IconButton>
                  </Box>
                )}

                {/* Approved Badge */}
                {approvedAvatars[character.name] && (
                  <Chip
                    icon={<Check />}
                    label="Approved"
                    color="success"
                    size="small"
                    sx={{ position: "absolute", top: 8, right: 8 }}
                  />
                )}

                {/* Reference Image Badge */}
                {character.hasReferenceImage && (
                  <Chip
                    icon={<ImageIcon />}
                    label="With Reference"
                    size="small"
                    sx={{
                      position: "absolute",
                      top: 8,
                      left: 8,
                      bgcolor: "rgba(123, 104, 238, 0.8)",
                    }}
                  />
                )}
              </Box>

              <CardContent>
                <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                  <Person sx={{ color: "primary.main" }} />
                  <Typography variant="h6">{character.name}</Typography>
                  <Chip
                    label={character.role}
                    size="small"
                    variant="outlined"
                  />
                </Stack>

                <Typography
                  variant="body2"
                  sx={{ color: "text.secondary", mb: 2, minHeight: 40 }}
                >
                  {character.description}
                </Typography>

                {/* Action Buttons */}
                <Stack spacing={1}>
                  {!character.avatarGenerated ? (
                    <>
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<AutoAwesome />}
                        onClick={() => openEditDialog(character)}
                        disabled={generating[character.name]}
                        fullWidth
                      >
                        Create Avatar
                      </Button>
                      <Typography
                        variant="caption"
                        sx={{ color: "text.secondary", textAlign: "center" }}
                      >
                        Add description or upload reference image
                      </Typography>
                    </>
                  ) : !approvedAvatars[character.name] ? (
                    <Stack direction="row" spacing={1}>
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<Check />}
                        onClick={() => handleApprove(character.name)}
                        disabled={generating[character.name]}
                        sx={{ flex: 1 }}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<Edit />}
                        onClick={() => openEditDialog(character)}
                        disabled={generating[character.name]}
                      >
                        Redo
                      </Button>
                    </Stack>
                  ) : (
                    <Button
                      variant="outlined"
                      size="small"
                      color="success"
                      startIcon={<Check />}
                      onClick={() =>
                        setApprovedAvatars((prev) => ({
                          ...prev,
                          [character.name]: false,
                        }))
                      }
                      fullWidth
                    >
                      Approved - Click to Edit
                    </Button>
                  )}
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Navigation Buttons */}
      <Box sx={{ display: "flex", justifyContent: "space-between" }}>
        <Button variant="outlined" startIcon={<ArrowBack />} onClick={onBack}>
          Back to Styles
        </Button>
        <Button
          variant="contained"
          size="large"
          endIcon={<ArrowForward />}
          onClick={handleProceed}
          disabled={!allApproved}
        >
          {allApproved
            ? "Generate Story Pages"
            : !allAvatarsGenerated
              ? `Create All Avatars First`
              : `Approve All (${approvedCount}/${job.characters?.length || 0})`}
        </Button>
      </Box>

      {/* Create/Edit Avatar Dialog */}
      <Dialog
        open={editDialog.open}
        onClose={() => setEditDialog({ open: false, character: null })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <AutoAwesome sx={{ color: "primary.main" }} />
            <Typography variant="h6">
              {editDialog.character?.avatarGenerated ? "Regenerate" : "Create"}{" "}
              Avatar - {editDialog.character?.name}
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: "text.secondary", mb: 3 }}>
            Provide a custom description and/or upload a reference image to
            create the avatar. The AI will use these inputs to generate a unique
            character design.
          </Typography>

          {/* Reference Image Upload */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Reference Image (Optional)
            </Typography>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              style={{ display: "none" }}
            />
            {referenceImagePreview ? (
              <Box sx={{ position: "relative", display: "inline-block" }}>
                <img
                  src={referenceImagePreview}
                  alt="Reference"
                  style={{
                    maxWidth: "100%",
                    maxHeight: 200,
                    borderRadius: 8,
                    border: "2px solid rgba(232, 184, 109, 0.3)",
                  }}
                />
                <IconButton
                  size="small"
                  onClick={handleClearImage}
                  sx={{
                    position: "absolute",
                    top: -8,
                    right: -8,
                    bgcolor: "error.main",
                    "&:hover": { bgcolor: "error.dark" },
                  }}
                >
                  <Delete fontSize="small" />
                </IconButton>
              </Box>
            ) : (
              <Button
                variant="outlined"
                startIcon={<CloudUpload />}
                onClick={() => fileInputRef.current?.click()}
                sx={{
                  py: 3,
                  width: "100%",
                  border: "2px dashed rgba(232, 184, 109, 0.3)",
                  "&:hover": { border: "2px dashed rgba(232, 184, 109, 0.6)" },
                }}
              >
                Click to upload reference image
              </Button>
            )}
          </Box>

          {/* Custom Description */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Character Description
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={4}
              value={customDescription}
              onChange={(e) => setCustomDescription(e.target.value)}
              placeholder="e.g., A young woman with long flowing red hair, wearing a blue medieval dress, gentle smile, fantasy portrait style..."
              helperText="Describe appearance, clothing, expression, and any specific style preferences"
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button
            onClick={() => setEditDialog({ open: false, character: null })}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => handleGenerateAvatar(editDialog.character, true)}
            disabled={!customDescription.trim() && !referenceImage}
            startIcon={<AutoAwesome />}
          >
            Generate Avatar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Zoom Dialog */}
      <Dialog
        open={!!zoomImage}
        onClose={() => setZoomImage(null)}
        maxWidth="md"
      >
        <IconButton
          onClick={() => setZoomImage(null)}
          sx={{
            position: "absolute",
            top: 8,
            right: 8,
            bgcolor: "rgba(0,0,0,0.5)",
          }}
        >
          <Close />
        </IconButton>
        <DialogContent sx={{ p: 0 }}>
          {zoomImage && (
            <img
              src={zoomImage}
              alt="Zoomed avatar"
              style={{ maxWidth: "100%", maxHeight: "80vh", display: "block" }}
            />
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}

export default AvatarReview;
