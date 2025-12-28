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
  Add,
  TextFields,
} from "@mui/icons-material";

function PageReview({ jobId, onComplete, onBack, setStoryPages }) {
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(false);
  const [regenerating, setRegenerating] = useState({});
  const [editDialog, setEditDialog] = useState({
    open: false,
    page: null,
    isCover: false,
  });
  const [customDescription, setCustomDescription] = useState("");
  const [referenceImage, setReferenceImage] = useState(null);
  const [referenceImagePreview, setReferenceImagePreview] = useState(null);
  const [zoomImage, setZoomImage] = useState(null);
  const [approvedPages, setApprovedPages] = useState({});
  const [tabValue, setTabValue] = useState(0);
  const fileInputRef = useRef(null);

  const [generatingIllustrations, setGeneratingIllustrations] = useState(false);
  const [generatingPage, setGeneratingPage] = useState(null);

  // Text editing state
  const [textEditDialog, setTextEditDialog] = useState({
    open: false,
    page: null,
    isNew: false,
  });
  const [editedText, setEditedText] = useState("");
  const [editedImageDescription, setEditedImageDescription] = useState("");
  const [savingText, setSavingText] = useState(false);

  // Delete confirmation state
  const [deleteDialog, setDeleteDialog] = useState({
    open: false,
    page: null,
  });
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!jobId) return;

    const pollJob = async () => {
      try {
        const response = await fetch(`/api/job/${jobId}`);
        const data = await response.json();
        setJob(data);
        setStoryPages(data.storyPages);

        if (
          data.status === "pages_ready" ||
          data.status === "pages_text_ready" ||
          data.status === "completed" ||
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

  // Generate all illustrations at once
  const handleGenerateAllIllustrations = async () => {
    setGeneratingIllustrations(true);
    try {
      await fetch("/api/generate/illustrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          generateCover: true,
        }),
      });
      // Polling will pick up the status change
    } catch (error) {
      console.error("Failed to start illustration generation:", error);
    }
  };

  // Generate illustration for a single page
  const handleGeneratePageIllustration = async (pageNumber) => {
    setGeneratingPage(pageNumber);
    try {
      const response = await fetch(
        `/api/generate/page/${pageNumber}/illustration`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId }),
        }
      );

      const data = await response.json();
      if (data.success) {
        setJob((prev) => ({
          ...prev,
          storyPages: {
            ...prev.storyPages,
            pages: prev.storyPages.pages.map((p) =>
              p.pageNumber === pageNumber ? data.page : p
            ),
          },
        }));
      }
    } catch (error) {
      console.error("Failed to generate page illustration:", error);
    } finally {
      setGeneratingPage(null);
    }
  };

  // Generate cover illustration only
  const handleGenerateCoverIllustration = async () => {
    setRegenerating((prev) => ({ ...prev, cover: true }));
    try {
      const response = await fetch("/api/generate/cover/illustration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });

      const data = await response.json();
      if (data.success) {
        setJob((prev) => ({
          ...prev,
          cover: data.cover,
        }));
      }
    } catch (error) {
      console.error("Failed to generate cover illustration:", error);
    } finally {
      setRegenerating((prev) => ({ ...prev, cover: false }));
    }
  };

  // Open text edit dialog
  const openTextEditDialog = (page = null, isNew = false) => {
    if (isNew) {
      setEditedText("");
      setEditedImageDescription("");
      setTextEditDialog({ open: true, page: null, isNew: true });
    } else {
      setEditedText(page?.text || "");
      setEditedImageDescription(page?.imageDescription || "");
      setTextEditDialog({ open: true, page, isNew: false });
    }
  };

  // Save page text changes
  const handleSavePageText = async () => {
    setSavingText(true);
    try {
      const isNew = textEditDialog.isNew;
      const endpoint = isNew ? "/api/pages/add" : "/api/pages/update";

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          pageNumber: isNew
            ? (job.storyPages?.pages?.length || 0) + 1
            : textEditDialog.page?.pageNumber,
          text: editedText,
          imageDescription: editedImageDescription,
        }),
      });

      const data = await response.json();
      if (data.success) {
        if (isNew) {
          // Add new page to the list
          setJob((prev) => ({
            ...prev,
            storyPages: {
              ...prev.storyPages,
              pages: [...(prev.storyPages?.pages || []), data.page],
            },
          }));
        } else {
          // Update existing page
          setJob((prev) => ({
            ...prev,
            storyPages: {
              ...prev.storyPages,
              pages: prev.storyPages.pages.map((p) =>
                p.pageNumber === textEditDialog.page.pageNumber ? data.page : p
              ),
            },
          }));
          // Reset approval for edited page
          setApprovedPages((prev) => ({
            ...prev,
            [`page_${textEditDialog.page.pageNumber}`]: false,
          }));
        }
        setTextEditDialog({ open: false, page: null, isNew: false });
      }
    } catch (error) {
      console.error("Failed to save page text:", error);
    } finally {
      setSavingText(false);
    }
  };

  // Delete page
  const handleDeletePage = async () => {
    if (!deleteDialog.page) return;
    setDeleting(true);
    try {
      const response = await fetch("/api/pages/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          pageNumber: deleteDialog.page.pageNumber,
        }),
      });

      const data = await response.json();
      if (data.success) {
        // Remove page and renumber remaining pages
        setJob((prev) => ({
          ...prev,
          storyPages: {
            ...prev.storyPages,
            pages: data.pages,
          },
        }));
        // Reset approved pages state
        const newApproved = {};
        data.pages.forEach((p) => {
          newApproved[`page_${p.pageNumber}`] = false;
        });
        if (job.cover) {
          newApproved.cover = approvedPages.cover || false;
        }
        setApprovedPages(newApproved);
        setDeleteDialog({ open: false, page: null });
      }
    } catch (error) {
      console.error("Failed to delete page:", error);
    } finally {
      setDeleting(false);
    }
  };

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
    setCustomDescription(
      page?.customDescription || page?.imageDescription || ""
    );
    setReferenceImage(null);
    setReferenceImagePreview(null);
    setEditDialog({ open: true, page, isCover });
  };

  // Calculate approval stats - only count items that have illustrations
  const pagesWithIllustrations =
    job?.storyPages?.pages?.filter(
      (p) => p.illustrationGenerated || p.illustrationUrl
    )?.length || 0;
  const totalPages = job?.storyPages?.pages?.length || 0;
  const allPagesHaveIllustrations =
    totalPages > 0 && pagesWithIllustrations === totalPages;
  const hasCoverIllustration = job?.cover?.illustrationUrl ? 1 : 0;
  const totalItems = pagesWithIllustrations + hasCoverIllustration;
  const approvedCount = Object.values(approvedPages).filter(Boolean).length;
  const allApproved = totalItems > 0 && approvedCount === totalItems;

  // Check if we're in prompt review mode (pages have text but not all have illustrations yet)
  // We're NOT in prompt review mode if all pages have illustrations (regardless of status)
  const isPromptReviewMode =
    !allPagesHaveIllustrations &&
    job?.status !== "running" &&
    job?.status !== "pages_ready";

  // Check if illustrations are being generated
  const isGeneratingIllustrations =
    generatingIllustrations ||
    (job?.status === "running" && job?.phase === "illustration_generation");

  // Loading state - only show when actually loading or generating illustrations
  if (
    loading ||
    !job ||
    (job.status === "running" &&
      !job.storyPages?.pages?.length &&
      job.phase !== "illustration_generation")
  ) {
    return (
      <Box className="fade-in">
        <Box sx={{ textAlign: "center", mb: 4 }}>
          <Typography variant="h2" sx={{ mb: 2, color: "primary.main" }}>
            Creating Pages
          </Typography>
          <Typography variant="body1" sx={{ color: "text.secondary" }}>
            Generating story pages...
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

  // If illustrations are being generated, show progress
  if (isGeneratingIllustrations) {
    return (
      <Box className="fade-in">
        <Box sx={{ textAlign: "center", mb: 4 }}>
          <Typography variant="h2" sx={{ mb: 2, color: "primary.main" }}>
            Generating Illustrations
          </Typography>
          <Typography variant="body1" sx={{ color: "text.secondary" }}>
            Creating illustrations for your story pages...
          </Typography>
        </Box>

        <Card sx={{ maxWidth: 500, mx: "auto" }}>
          <CardContent sx={{ p: 4, textAlign: "center" }}>
            <CircularProgress sx={{ color: "primary.main", mb: 3 }} size={60} />
            <Typography variant="h6" sx={{ mb: 1 }}>
              {job?.phase === "illustration_generation"
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

  return (
    <Box className="fade-in">
      <Box sx={{ textAlign: "center", mb: 4 }}>
        <Typography variant="h2" sx={{ mb: 2, color: "primary.main" }}>
          {isPromptReviewMode
            ? "Review Page Prompts"
            : "Review Page Illustrations"}
        </Typography>
        <Typography
          variant="body1"
          sx={{ color: "text.secondary", maxWidth: 700, mx: "auto" }}
        >
          {isPromptReviewMode
            ? "Review each page's text and illustration prompt. Edit if needed, then click Generate to create illustrations."
            : "Review each page illustration. If you're not satisfied, you can regenerate it with a custom description or reference image."}
        </Typography>
      </Box>

      {/* Progress indicator - only show in illustration review mode */}
      {!isPromptReviewMode && (
        <Box sx={{ mb: 3, textAlign: "center" }}>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            <strong>{approvedCount}</strong> of {totalItems} illustrations
            approved
          </Typography>
          <LinearProgress
            variant="determinate"
            value={(approvedCount / totalItems) * 100}
            sx={{
              mt: 1,
              height: 6,
              borderRadius: 3,
              maxWidth: 400,
              mx: "auto",
            }}
          />
        </Box>
      )}

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
          <Tab
            icon={<PhotoLibrary />}
            label={`Pages (${job.storyPages?.pages?.length || 0})`}
          />
          <Tab
            icon={<MenuBook />}
            label={job.cover ? "Cover" : "Cover (Pending)"}
          />
        </Tabs>
      </Box>

      {/* Pages Tab */}
      {tabValue === 0 && (
        <>
          {/* Add Page Button */}
          <Box sx={{ mb: 3, display: "flex", justifyContent: "flex-end" }}>
            <Button
              variant="outlined"
              startIcon={<Add />}
              onClick={() => openTextEditDialog(null, true)}
            >
              Add New Page
            </Button>
          </Box>

          <Grid container spacing={3} sx={{ mb: 4 }}>
            {job.storyPages?.pages?.map((page, index) => {
              const pageKey = `page_${page.pageNumber}`;
              const hasIllustration =
                page.illustrationGenerated || page.illustrationUrl;
              const isGeneratingThis = generatingPage === page.pageNumber;

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
                      opacity:
                        regenerating[pageKey] || isGeneratingThis ? 0.7 : 1,
                    }}
                  >
                    <Box
                      sx={{
                        position: "relative",
                        "&:hover .actions": { opacity: 1 },
                      }}
                    >
                      {regenerating[pageKey] || isGeneratingThis ? (
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
                          <Typography
                            variant="body2"
                            sx={{ color: "text.secondary" }}
                          >
                            {isGeneratingThis
                              ? "Generating..."
                              : "Regenerating..."}
                          </Typography>
                        </Box>
                      ) : hasIllustration ? (
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
                      ) : (
                        // No illustration yet - show placeholder
                        <Box
                          sx={{
                            height: 200,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            bgcolor: "rgba(232, 184, 109, 0.1)",
                            border: "2px dashed rgba(232, 184, 109, 0.3)",
                            gap: 1,
                          }}
                        >
                          <ImageIcon
                            sx={{
                              fontSize: 48,
                              color: "rgba(232, 184, 109, 0.5)",
                            }}
                          />
                          <Button
                            variant="contained"
                            size="small"
                            startIcon={<AutoAwesome />}
                            onClick={() =>
                              handleGeneratePageIllustration(page.pageNumber)
                            }
                          >
                            Generate
                          </Button>
                        </Box>
                      )}

                      {/* Overlay Actions - only show when illustration exists */}
                      {hasIllustration && (
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
                      )}

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

                      {/* Edit/Delete buttons - top right when no approval badge */}
                      {!approvedPages[pageKey] && (
                        <Box
                          sx={{
                            position: "absolute",
                            top: 8,
                            right: 8,
                            display: "flex",
                            gap: 0.5,
                          }}
                        >
                          <IconButton
                            size="small"
                            onClick={() => openTextEditDialog(page, false)}
                            sx={{
                              bgcolor: "rgba(0,0,0,0.6)",
                              "&:hover": { bgcolor: "rgba(0,0,0,0.8)" },
                            }}
                            title="Edit text"
                          >
                            <TextFields fontSize="small" />
                          </IconButton>
                          {totalPages > 1 && (
                            <IconButton
                              size="small"
                              onClick={() =>
                                setDeleteDialog({ open: true, page })
                              }
                              sx={{
                                bgcolor: "rgba(0,0,0,0.6)",
                                color: "error.main",
                                "&:hover": { bgcolor: "rgba(0,0,0,0.8)" },
                              }}
                              title="Delete page"
                            >
                              <Delete fontSize="small" />
                            </IconButton>
                          )}
                        </Box>
                      )}
                    </Box>

                    <CardContent>
                      {/* Page Text */}
                      <Typography
                        variant="body2"
                        sx={{
                          color: "text.primary",
                          mb: 1,
                          minHeight: hasIllustration ? 60 : 40,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          display: "-webkit-box",
                          WebkitLineClamp: hasIllustration ? 3 : 2,
                          WebkitBoxOrient: "vertical",
                        }}
                      >
                        {page.text}
                      </Typography>

                      {/* Show image description/prompt when no illustration */}
                      {!hasIllustration && (
                        <Box
                          sx={{
                            mb: 2,
                            p: 1.5,
                            bgcolor: "rgba(0,0,0,0.2)",
                            borderRadius: 1,
                            border: "1px solid rgba(232, 184, 109, 0.2)",
                          }}
                        >
                          <Typography
                            variant="caption"
                            sx={{
                              color: "primary.main",
                              fontWeight: "bold",
                              display: "block",
                              mb: 0.5,
                            }}
                          >
                            Illustration Prompt:
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{
                              color: "text.secondary",
                              fontSize: "0.75rem",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              display: "-webkit-box",
                              WebkitLineClamp: 4,
                              WebkitBoxOrient: "vertical",
                            }}
                          >
                            {page.imageDescription}
                          </Typography>
                        </Box>
                      )}

                      <Stack direction="row" spacing={1}>
                        {hasIllustration ? (
                          // Illustration exists - show approve/edit buttons
                          !approvedPages[pageKey] ? (
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
                          )
                        ) : (
                          // No illustration - show generate button
                          <Button
                            variant="contained"
                            size="small"
                            startIcon={<AutoAwesome />}
                            onClick={() =>
                              handleGeneratePageIllustration(page.pageNumber)
                            }
                            disabled={isGeneratingThis}
                            fullWidth
                          >
                            Generate Illustration
                          </Button>
                        )}
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </>
      )}

      {/* Cover Tab */}
      {tabValue === 1 && (
        <Box sx={{ display: "flex", justifyContent: "center", mb: 4 }}>
          <Card
            sx={{
              maxWidth: 400,
              width: "100%",
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
                    height: 400,
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
                    Generating cover...
                  </Typography>
                </Box>
              ) : job.cover?.illustrationUrl ? (
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
              ) : (
                // No cover yet - show placeholder
                <Box
                  sx={{
                    height: 400,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    bgcolor: "rgba(232, 184, 109, 0.1)",
                    border: "2px dashed rgba(232, 184, 109, 0.3)",
                    gap: 2,
                  }}
                >
                  <MenuBook
                    sx={{
                      fontSize: 64,
                      color: "rgba(232, 184, 109, 0.5)",
                    }}
                  />
                  <Typography variant="body1" sx={{ color: "text.secondary" }}>
                    Cover will be generated with illustrations
                  </Typography>
                  {!isPromptReviewMode && (
                    <Button
                      variant="contained"
                      startIcon={<AutoAwesome />}
                      onClick={handleGenerateAllIllustrations}
                    >
                      Generate All Illustrations
                    </Button>
                  )}
                </Box>
              )}

              {/* Overlay Actions - only show when cover illustration exists */}
              {job.cover?.illustrationUrl && (
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
              )}

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
                {job.cover?.title || job.storyPages?.title || "Book Cover"}
              </Typography>

              {job.cover?.illustrationUrl ? (
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
              ) : (
                <Stack spacing={2}>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    {isPromptReviewMode
                      ? "Generate cover illustration or use 'Generate All Illustrations' to create everything at once."
                      : "Cover illustration pending..."}
                  </Typography>
                  {isPromptReviewMode && (
                    <Button
                      variant="contained"
                      startIcon={<AutoAwesome />}
                      onClick={handleGenerateCoverIllustration}
                      disabled={regenerating.cover}
                      fullWidth
                    >
                      Generate Cover
                    </Button>
                  )}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Navigation Buttons */}
      <Box sx={{ display: "flex", justifyContent: "space-between" }}>
        <Button variant="outlined" startIcon={<ArrowBack />} onClick={onBack}>
          Back to Avatars
        </Button>
        {isPromptReviewMode ? (
          <Button
            variant="contained"
            size="large"
            endIcon={<AutoAwesome />}
            onClick={handleGenerateAllIllustrations}
          >
            Generate All Illustrations
          </Button>
        ) : (
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
        )}
      </Box>

      {/* Edit Dialog */}
      <Dialog
        open={editDialog.open}
        onClose={() =>
          setEditDialog({ open: false, page: null, isCover: false })
        }
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <AutoAwesome sx={{ color: "primary.main" }} />
            <Typography variant="h6">
              Regenerate{" "}
              {editDialog.isCover
                ? "Cover"
                : `Page ${editDialog.page?.pageNumber}`}
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: "text.secondary", mb: 3 }}>
            Provide a custom description and/or upload a reference image to
            regenerate the illustration.
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
            onClick={() =>
              setEditDialog({ open: false, page: null, isCover: false })
            }
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
      <Dialog
        open={!!zoomImage}
        onClose={() => setZoomImage(null)}
        maxWidth="lg"
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
              alt="Zoomed illustration"
              style={{ maxWidth: "100%", maxHeight: "85vh", display: "block" }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Text Edit Dialog */}
      <Dialog
        open={textEditDialog.open}
        onClose={() =>
          setTextEditDialog({ open: false, page: null, isNew: false })
        }
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <TextFields sx={{ color: "primary.main" }} />
            <Typography variant="h6">
              {textEditDialog.isNew
                ? "Add New Page"
                : `Edit Page ${textEditDialog.page?.pageNumber}`}
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: "text.secondary", mb: 3 }}>
            {textEditDialog.isNew
              ? "Add a new page to your story. The illustration will be generated based on the description."
              : "Edit the page text and illustration prompt. Changes will reset any existing illustration."}
          </Typography>

          {/* Page Text */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Page Text *
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={4}
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              placeholder="The story text that will appear on this page..."
              helperText="This is the text readers will see on the page"
            />
          </Box>

          {/* Illustration Description */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Illustration Description *
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={4}
              value={editedImageDescription}
              onChange={(e) => setEditedImageDescription(e.target.value)}
              placeholder="Describe what should be shown in the illustration for this page..."
              helperText="This prompt will be used to generate the illustration"
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button
            onClick={() =>
              setTextEditDialog({ open: false, page: null, isNew: false })
            }
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSavePageText}
            disabled={
              !editedText.trim() || !editedImageDescription.trim() || savingText
            }
            startIcon={savingText ? <CircularProgress size={16} /> : <Check />}
          >
            {savingText
              ? "Saving..."
              : textEditDialog.isNew
                ? "Add Page"
                : "Save Changes"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, page: null })}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Delete sx={{ color: "error.main" }} />
            <Typography variant="h6">Delete Page?</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Are you sure you want to delete Page {deleteDialog.page?.pageNumber}
            ? This action cannot be undone. Remaining pages will be renumbered
            automatically.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setDeleteDialog({ open: false, page: null })}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeletePage}
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={16} /> : <Delete />}
          >
            {deleting ? "Deleting..." : "Delete Page"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default PageReview;
