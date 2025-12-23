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
  Tabs,
  Tab,
} from "@mui/material";
import {
  Check,
  Refresh,
  Edit,
  ArrowBack,
  ArrowForward,
  ZoomIn,
  Close,
  CloudUpload,
  Image as ImageIcon,
  AutoAwesome,
  Delete,
  MenuBook,
  PhotoLibrary,
} from "@mui/icons-material";

function PageReview({ jobId, onComplete, onBack }) {
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState({});
  const [editDialog, setEditDialog] = useState({ open: false, page: null, isCover: false });
  const [customDescription, setCustomDescription] = useState("");
  const [referenceImage, setReferenceImage] = useState(null);
  const [referenceImagePreview, setReferenceImagePreview] = useState(null);
  const [zoomImage, setZoomImage] = useState(null);
  const [approvedPages, setApprovedPages] = useState({});
  const [tabValue, setTabValue] = useState(0);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!jobId) return;

    const pollJob = async () => {
      try {
        const response = await fetch(`/api/job/${jobId}`);
        const data = await response.json();
        setJob(data);

        if (data.status === "pages_ready" || data.status === "completed" || data.status === "error") {
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

  // Initialize approved state when pages are ready
  useEffect(() => {
    if (job?.status === "pages_ready" && job.storyPages?.pages) {
      const approved = {};
      job.storyPages.pages.forEach((page) => {
        approved[`page_${page.pageNumber}`] = page.approved || false;
      });
      if (job.cover) {
        approved["cover"] = job.cover.approved || false;
      }
      if (Object.keys(approvedPages).length === 0) {
        setApprovedPages(approved);
      }
    }
  }, [job?.status, job?.storyPages?.pages?.length]);

  const handleFileSelect = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setReferenceImagePreview(reader.result);
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

  const handleRegeneratePage = async (page, useDialog = false) => {
    const pageKey = `page_${page.pageNumber}`;
    setRegenerating((prev) => ({ ...prev, [pageKey]: true }));

    if (useDialog) {
      setEditDialog({ open: false, page: null, isCover: false });
    }

    try {
      const response = await fetch("/api/regenerate-page", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          pageNumber: page.pageNumber,
          customDescription: useDialog ? customDescription : null,
          referenceImageBase64: useDialog ? referenceImage : null,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setJob((prev) => ({
          ...prev,
          storyPages: {
            ...prev.storyPages,
            pages: prev.storyPages.pages.map((p) =>
              p.pageNumber === page.pageNumber ? data.page : p
            ),
          },
        }));
        setApprovedPages((prev) => ({ ...prev, [pageKey]: false }));
      }
    } catch (error) {
      console.error("Failed to regenerate page:", error);
    } finally {
      setRegenerating((prev) => ({ ...prev, [pageKey]: false }));
      setCustomDescription("");
      setReferenceImage(null);
      setReferenceImagePreview(null);
    }
  };

  const handleRegenerateCover = async (useDialog = false) => {
    setRegenerating((prev) => ({ ...prev, cover: true }));

    if (useDialog) {
      setEditDialog({ open: false, page: null, isCover: false });
    }

    try {
      const response = await fetch("/api/regenerate-cover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          customDescription: useDialog ? customDescription : null,
          referenceImageBase64: useDialog ? referenceImage : null,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setJob((prev) => ({
          ...prev,
          cover: data.cover,
        }));
        setApprovedPages((prev) => ({ ...prev, cover: false }));
      }
    } catch (error) {
      console.error("Failed to regenerate cover:", error);
    } finally {
      setRegenerating((prev) => ({ ...prev, cover: false }));
      setCustomDescription("");
      setReferenceImage(null);
      setReferenceImagePreview(null);
    }
  };

  const handleApprove = (key) => {
    setApprovedPages((prev) => ({ ...prev, [key]: true }));
  };

  const handleFinalize = async () => {
    try {
      const response = await fetch("/api/finalize-story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });

      const data = await response.json();
      if (data.success) {
        onComplete(data.result);
      }
    } catch (error) {
      console.error("Failed to finalize story:", error);
    }
  };

  const openEditDialog = (page, isCover = false) => {
    setCustomDescription(page?.customDescription || page?.imageDescription || "");
    setReferenceImage(null);
    setReferenceImagePreview(null);
    setEditDialog({ open: true, page, isCover });
  };

  // Calculate approval stats
  const totalItems = (job?.storyPages?.pages?.length || 0) + (job?.cover ? 1 : 0);
  const approvedCount = Object.values(approvedPages).filter(Boolean).length;
  const allApproved = totalItems > 0 && approvedCount === totalItems;

  // Loading state
  if (loading || !job || (job.status === "running" && !job.storyPages?.pages?.length)) {
    return (
      <Box className="fade-in">
        <Box sx={{ textAlign: "center", mb: 4 }}>
          <Typography variant="h2" sx={{ mb: 2, color: "primary.main" }}>
            Creating Pages
          </Typography>
          <Typography variant="body1" sx={{ color: "text.secondary" }}>
            Generating illustrations for your story...
          </Typography>
        </Box>

        <Card sx={{ maxWidth: 500, mx: "auto" }}>
          <CardContent sx={{ p: 4, textAlign: "center" }}>
            <CircularProgress sx={{ color: "primary.main", mb: 3 }} size={60} />
            <Typography variant="h6" sx={{ mb: 1 }}>
              {job?.phase === "page_generation"
                ? "Creating Story Pages"
                : job?.phase === "illustration_generation"
                ? "Generating Illustrations"
                : job?.phase === "cover_generation"
                ? "Creating Book Cover"
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
          Review Page Illustrations
        </Typography>
        <Typography
          variant="body1"
          sx={{ color: "text.secondary", maxWidth: 700, mx: "auto" }}
        >
          Review each page illustration. If you're not satisfied, you can regenerate it
          with a custom description or reference image.
        </Typography>
      </Box>

      {/* Progress indicator */}
      <Box sx={{ mb: 3, textAlign: "center" }}>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          <strong>{approvedCount}</strong> of {totalItems} illustrations approved
        </Typography>
        <LinearProgress
          variant="determinate"
          value={(approvedCount / totalItems) * 100}
          sx={{ mt: 1, height: 6, borderRadius: 3, maxWidth: 400, mx: "auto" }}
        />
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 3 }}>
        <Tabs
          value={tabValue}
          onChange={(e, v) => setTabValue(v)}
          centered
          sx={{
            "& .MuiTab-root": { color: "text.secondary" },
            "& .Mui-selected": { color: "primary.main" },
          }}
        >
          <Tab icon={<PhotoLibrary />} label={`Pages (${job.storyPages?.pages?.length || 0})`} />
          {job.cover && <Tab icon={<MenuBook />} label="Cover" />}
        </Tabs>
      </Box>

      {/* Pages Tab */}
      {tabValue === 0 && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          {job.storyPages?.pages?.map((page, index) => {
            const pageKey = `page_${page.pageNumber}`;
            return (
              <Grid item xs={12} sm={6} md={4} key={index}>
                <Card
                  sx={{
                    height: "100%",
                    border: approvedPages[pageKey]
                      ? "2px solid"
                      : "1px solid",
                    borderColor: approvedPages[pageKey]
                      ? "success.main"
                      : "rgba(232, 184, 109, 0.15)",
                    transition: "all 0.2s",
                    opacity: regenerating[pageKey] ? 0.7 : 1,
                  }}
                >
                  <Box
                    sx={{
                      position: "relative",
                      "&:hover .actions": { opacity: 1 },
                    }}
                  >
                    {regenerating[pageKey] ? (
                      <Box
                        sx={{
                          height: 200,
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          bgcolor: "rgba(0,0,0,0.3)",
                          gap: 2,
                        }}
                      >
                        <CircularProgress sx={{ color: "primary.main" }} />
                        <Typography variant="body2" sx={{ color: "text.secondary" }}>
                          Regenerating...
                        </Typography>
                      </Box>
                    ) : (
                      <img
                        src={page.illustrationUrl}
                        alt={`Page ${page.pageNumber}`}
                        style={{
                          width: "100%",
                          height: 200,
                          objectFit: "cover",
                          display: "block",
                        }}
                      />
                    )}

                    {/* Overlay Actions */}
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
                        onClick={() => setZoomImage(page.illustrationUrl)}
                        sx={{
                          bgcolor: "rgba(255,255,255,0.2)",
                          "&:hover": { bgcolor: "rgba(255,255,255,0.3)" },
                        }}
                      >
                        <ZoomIn />
                      </IconButton>
                      <IconButton
                        onClick={() => openEditDialog(page, false)}
                        sx={{
                          bgcolor: "rgba(255,255,255,0.2)",
                          "&:hover": { bgcolor: "rgba(255,255,255,0.3)" },
                        }}
                      >
                        <Edit />
                      </IconButton>
                    </Box>

                    {/* Badges */}
                    <Chip
                      label={`Page ${page.pageNumber}`}
                      size="small"
                      sx={{
                        position: "absolute",
                        top: 8,
                        left: 8,
                        bgcolor: "rgba(0,0,0,0.6)",
                      }}
                    />
                    {approvedPages[pageKey] && (
                      <Chip
                        icon={<Check />}
                        label="Approved"
                        color="success"
                        size="small"
                        sx={{ position: "absolute", top: 8, right: 8 }}
                      />
                    )}
                    {page.regenerated && (
                      <Chip
                        icon={<Refresh />}
                        label="Edited"
                        size="small"
                        sx={{
                          position: "absolute",
                          bottom: 8,
                          right: 8,
                          bgcolor: "rgba(123, 104, 238, 0.8)",
                        }}
                      />
                    )}
                  </Box>

                  <CardContent>
                    <Typography
                      variant="body2"
                      sx={{
                        color: "text.secondary",
                        mb: 2,
                        minHeight: 60,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        display: "-webkit-box",
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: "vertical",
                      }}
                    >
                      {page.text}
                    </Typography>

                    <Stack direction="row" spacing={1}>
                      {!approvedPages[pageKey] ? (
                        <>
                          <Button
                            variant="contained"
                            size="small"
                            startIcon={<Check />}
                            onClick={() => handleApprove(pageKey)}
                            disabled={regenerating[pageKey]}
                            sx={{ flex: 1 }}
                          >
                            Approve
                          </Button>
                          <Button
                            variant="outlined"
                            size="small"
                            startIcon={<Edit />}
                            onClick={() => openEditDialog(page, false)}
                            disabled={regenerating[pageKey]}
                          >
                            Edit
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="outlined"
                          size="small"
                          color="success"
                          startIcon={<Check />}
                          onClick={() =>
                            setApprovedPages((prev) => ({
                              ...prev,
                              [pageKey]: false,
                            }))
                          }
                          fullWidth
                        >
                          Approved
                        </Button>
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* Cover Tab */}
      {tabValue === 1 && job.cover && (
        <Box sx={{ display: "flex", justifyContent: "center", mb: 4 }}>
          <Card
            sx={{
              maxWidth: 400,
              border: approvedPages.cover ? "2px solid" : "1px solid",
              borderColor: approvedPages.cover
                ? "success.main"
                : "rgba(232, 184, 109, 0.15)",
              transition: "all 0.2s",
              opacity: regenerating.cover ? 0.7 : 1,
            }}
          >
            <Box
              sx={{
                position: "relative",
                "&:hover .actions": { opacity: 1 },
              }}
            >
              {regenerating.cover ? (
                <Box
                  sx={{
                    height: 500,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    bgcolor: "rgba(0,0,0,0.3)",
                    gap: 2,
                  }}
                >
                  <CircularProgress sx={{ color: "primary.main" }} />
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    Regenerating cover...
                  </Typography>
                </Box>
              ) : (
                <img
                  src={job.cover.illustrationUrl}
                  alt="Book Cover"
                  style={{
                    width: "100%",
                    height: "auto",
                    maxHeight: 500,
                    objectFit: "contain",
                    display: "block",
                  }}
                />
              )}

              {/* Overlay Actions */}
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
                  onClick={() => setZoomImage(job.cover.illustrationUrl)}
                  sx={{
                    bgcolor: "rgba(255,255,255,0.2)",
                    "&:hover": { bgcolor: "rgba(255,255,255,0.3)" },
                  }}
                >
                  <ZoomIn />
                </IconButton>
                <IconButton
                  onClick={() => openEditDialog(job.cover, true)}
                  sx={{
                    bgcolor: "rgba(255,255,255,0.2)",
                    "&:hover": { bgcolor: "rgba(255,255,255,0.3)" },
                  }}
                >
                  <Edit />
                </IconButton>
              </Box>

              {approvedPages.cover && (
                <Chip
                  icon={<Check />}
                  label="Approved"
                  color="success"
                  size="small"
                  sx={{ position: "absolute", top: 8, right: 8 }}
                />
              )}
            </Box>

            <CardContent>
              <Typography variant="h6" sx={{ mb: 1 }}>
                {job.cover.title || job.storyPages?.title || "Book Cover"}
              </Typography>

              <Stack direction="row" spacing={1}>
                {!approvedPages.cover ? (
                  <>
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<Check />}
                      onClick={() => handleApprove("cover")}
                      disabled={regenerating.cover}
                      sx={{ flex: 1 }}
                    >
                      Approve Cover
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<Edit />}
                      onClick={() => openEditDialog(job.cover, true)}
                      disabled={regenerating.cover}
                    >
                      Edit
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="outlined"
                    size="small"
                    color="success"
                    startIcon={<Check />}
                    onClick={() =>
                      setApprovedPages((prev) => ({ ...prev, cover: false }))
                    }
                    fullWidth
                  >
                    Approved
                  </Button>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Navigation Buttons */}
      <Box sx={{ display: "flex", justifyContent: "space-between" }}>
        <Button variant="outlined" startIcon={<ArrowBack />} onClick={onBack}>
          Back to Avatars
        </Button>
        <Button
          variant="contained"
          size="large"
          endIcon={<ArrowForward />}
          onClick={handleFinalize}
          disabled={!allApproved}
        >
          {allApproved
            ? "View Final Story"
            : `Approve All (${approvedCount}/${totalItems})`}
        </Button>
      </Box>

      {/* Edit Dialog */}
      <Dialog
        open={editDialog.open}
        onClose={() => setEditDialog({ open: false, page: null, isCover: false })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <AutoAwesome sx={{ color: "primary.main" }} />
            <Typography variant="h6">
              Regenerate {editDialog.isCover ? "Cover" : `Page ${editDialog.page?.pageNumber}`}
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: "text.secondary", mb: 3 }}>
            Provide a custom description and/or upload a reference image to regenerate
            the illustration.
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
              Scene Description
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={4}
              value={customDescription}
              onChange={(e) => setCustomDescription(e.target.value)}
              placeholder="Describe the scene, characters, mood, colors, and style you want..."
              helperText="Be specific about what you want to see in the illustration"
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button
            onClick={() => setEditDialog({ open: false, page: null, isCover: false })}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() =>
              editDialog.isCover
                ? handleRegenerateCover(true)
                : handleRegeneratePage(editDialog.page, true)
            }
            disabled={!customDescription.trim() && !referenceImage}
            startIcon={<AutoAwesome />}
          >
            Regenerate
          </Button>
        </DialogActions>
      </Dialog>

      {/* Zoom Dialog */}
      <Dialog open={!!zoomImage} onClose={() => setZoomImage(null)} maxWidth="lg">
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
              alt="Zoomed illustration"
              style={{ maxWidth: "100%", maxHeight: "85vh", display: "block" }}
            />
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}

export default PageReview;

