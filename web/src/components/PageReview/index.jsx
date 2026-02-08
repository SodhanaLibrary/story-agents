import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  Box,
  Typography,
  Button,
  ButtonGroup,
  Grid,
  TextField,
  CircularProgress,
  Stack,
  LinearProgress,
  Tabs,
  Tab,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import {
  Refresh,
  ArrowBack,
  ArrowForward,
  PhotoLibrary,
  Add,
  ArrowDropDown,
  Speed,
  Schedule,
  MenuBook,
} from "@mui/icons-material";

import PageCard from "./PageCard";
import CoverCard from "./CoverCard";
import {
  EditDialog,
  ZoomDialog,
  TextEditDialog,
  DeleteDialog,
} from "./PageReviewDialogs";
import {
  LoadingState,
  ErrorState,
  BatchProgressState,
  ImmediateGenerationState,
} from "./LoadingStates";

function PageReview({ jobId, onComplete, onBack, setStoryPages }) {
  const { userId } = useAuth();
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

  // Page count regeneration state
  const [desiredPageCount, setDesiredPageCount] = useState("");
  const [regeneratingPages, setRegeneratingPages] = useState(false);

  // Generation mode dropdown state
  const [generateMenuAnchor, setGenerateMenuAnchor] = useState(null);

  // Batch request tracking state
  const [batchRequest, setBatchRequest] = useState(null);
  const [batchPolling, setBatchPolling] = useState(false);

  // Poll job status
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
          setGeneratingIllustrations(false);
          setRegeneratingPages(false);
        }
      } catch (err) {
        console.error("Failed to poll job:", err);
      }
    };

    pollJob();
    const interval = setInterval(pollJob, 2000);

    return () => clearInterval(interval);
  }, [jobId, setStoryPages]);

  // Poll batch request status
  useEffect(() => {
    if (!batchRequest?.batchId || !batchPolling) return;

    const pollBatch = async () => {
      try {
        const headers = {};
        if (userId) {
          headers["X-User-Id"] = userId;
        }

        const response = await fetch(`/api/batch/${batchRequest.batchId}`, {
          headers,
        });

        if (response.ok) {
          const data = await response.json();
          setBatchRequest((prev) => ({
            ...prev,
            ...data.batch,
          }));

          if (
            ["completed", "failed", "cancelled"].includes(data.batch.status)
          ) {
            setBatchPolling(false);
            setGeneratingIllustrations(false);

            if (data.batch.status === "completed") {
              setTimeout(() => {
                setBatchRequest(null);
              }, 3000);
            }
          }
        }
      } catch (err) {
        console.error("Failed to poll batch status:", err);
      }
    };

    pollBatch();
    const interval = setInterval(pollBatch, 3000);

    return () => clearInterval(interval);
  }, [batchRequest?.batchId, batchPolling, userId]);

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
  }, [job?.status, job?.storyPages?.pages?.length, job?.cover, approvedPages]);

  // Handlers
  const handleRegenerateWithPageCount = async () => {
    const pageCount = parseInt(desiredPageCount, 10);
    if (isNaN(pageCount) || pageCount < 4 || pageCount > 20) {
      return;
    }

    setRegeneratingPages(true);
    try {
      await fetch("/api/generate/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          pageCount,
          targetAudience: "children",
          generateCover: true,
        }),
      });
      setApprovedPages({});
    } catch (error) {
      console.error("Failed to regenerate pages:", error);
    } finally {
      setRegeneratingPages(false);
      setDesiredPageCount("");
    }
  };

  const handleGenerateAllIllustrations = async (mode = "immediate") => {
    setGenerateMenuAnchor(null);
    setGeneratingIllustrations(true);

    try {
      const headers = { "Content-Type": "application/json" };
      if (userId) {
        headers["X-User-Id"] = userId;
      }

      if (mode === "batch") {
        const response = await fetch("/api/batch/create", {
          method: "POST",
          headers,
          body: JSON.stringify({ jobId }),
        });

        if (response.ok) {
          const data = await response.json();
          // totalPages from server now includes cover (+1 if cover needs generation)
          setBatchRequest({
            batchId: data.batchId,
            status: "pending",
            total_pages: data.totalPages,
            completed_pages: 0,
            created_at: new Date().toISOString(),
          });
          setBatchPolling(true);
        } else {
          console.warn(
            "Batch creation failed, falling back to immediate generation"
          );
          await fetch("/api/generate/illustrations", {
            method: "POST",
            headers,
            body: JSON.stringify({
              jobId,
              generateCover: true,
            }),
          });
        }
      } else {
        await fetch("/api/generate/illustrations", {
          method: "POST",
          headers,
          body: JSON.stringify({
            jobId,
            generateCover: true,
          }),
        });
      }
    } catch (error) {
      console.error("Failed to start illustration generation:", error);
      setGeneratingIllustrations(false);
    }
  };

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
          setJob((prev) => ({
            ...prev,
            storyPages: {
              ...prev.storyPages,
              pages: [...(prev.storyPages?.pages || []), data.page],
            },
          }));
        } else {
          setJob((prev) => ({
            ...prev,
            storyPages: {
              ...prev.storyPages,
              pages: prev.storyPages.pages.map((p) =>
                p.pageNumber === textEditDialog.page.pageNumber ? data.page : p
              ),
            },
          }));
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
        setJob((prev) => ({
          ...prev,
          storyPages: {
            ...prev.storyPages,
            pages: data.pages,
          },
        }));
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
      const headers = { "Content-Type": "application/json" };
      if (userId) {
        headers["X-User-Id"] = userId;
      }

      const response = await fetch("/api/finalize-story", {
        method: "POST",
        headers,
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

  const handleCancelBatch = async () => {
    if (!batchRequest?.batchId) return;

    try {
      const headers = { "Content-Type": "application/json" };
      if (userId) {
        headers["X-User-Id"] = userId;
      }

      await fetch(`/api/batch/${batchRequest.batchId}/cancel`, {
        method: "POST",
        headers,
      });

      setBatchPolling(false);
      setGeneratingIllustrations(false);
      setBatchRequest(null);
    } catch (error) {
      console.error("Failed to cancel batch:", error);
    }
  };

  // Calculate stats
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

  const isPromptReviewMode =
    !allPagesHaveIllustrations &&
    job?.status !== "running" &&
    job?.status !== "pages_ready";

  const isGeneratingIllustrations =
    generatingIllustrations ||
    (job?.status === "running" && job?.phase === "illustration_generation");

  // Loading state
  if (
    loading ||
    regeneratingPages ||
    !job ||
    (job.status === "running" &&
      !job.storyPages?.pages?.length &&
      job.phase !== "illustration_generation")
  ) {
    return (
      <LoadingState
        job={job}
        regeneratingPages={regeneratingPages}
        desiredPageCount={desiredPageCount}
      />
    );
  }

  // Error state
  if (job.status === "error") {
    return <ErrorState job={job} onBack={onBack} />;
  }

  // Generating illustrations state
  if (isGeneratingIllustrations) {
    if (batchRequest) {
      return (
        <BatchProgressState
          batchRequest={batchRequest}
          onCancelBatch={handleCancelBatch}
          onViewResults={() => {
            setBatchRequest(null);
            setGeneratingIllustrations(false);
          }}
        />
      );
    }
    return <ImmediateGenerationState job={job} />;
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

      {/* Progress indicator */}
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
          <Box
            sx={{
              mb: 3,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 2,
            }}
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Current: {totalPages} pages
              </Typography>
              <TextField
                size="small"
                type="number"
                value={desiredPageCount}
                onChange={(e) => setDesiredPageCount(e.target.value)}
                placeholder="4-20"
                inputProps={{ min: 4, max: 20, style: { width: 60 } }}
                sx={{ width: 100 }}
              />
              <Button
                variant="outlined"
                size="small"
                onClick={handleRegenerateWithPageCount}
                disabled={
                  regeneratingPages ||
                  !desiredPageCount ||
                  parseInt(desiredPageCount) < 4 ||
                  parseInt(desiredPageCount) > 20
                }
                startIcon={
                  regeneratingPages ? (
                    <CircularProgress size={16} />
                  ) : (
                    <Refresh />
                  )
                }
              >
                {regeneratingPages ? "Regenerating..." : "Regenerate Pages"}
              </Button>
            </Stack>

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
              return (
                <Grid item xs={12} sm={6} md={4} key={index}>
                  <PageCard
                    page={page}
                    pageKey={pageKey}
                    approvedPages={approvedPages}
                    regenerating={regenerating}
                    generatingPage={generatingPage}
                    totalPages={totalPages}
                    onZoom={setZoomImage}
                    onEditDialog={openEditDialog}
                    onTextEditDialog={openTextEditDialog}
                    onDeleteDialog={(page) =>
                      setDeleteDialog({ open: true, page })
                    }
                    onApprove={handleApprove}
                    onGenerateIllustration={handleGeneratePageIllustration}
                    setApprovedPages={setApprovedPages}
                  />
                </Grid>
              );
            })}
          </Grid>
        </>
      )}

      {/* Cover Tab */}
      {tabValue === 1 && (
        <CoverCard
          job={job}
          approvedPages={approvedPages}
          regenerating={regenerating}
          isPromptReviewMode={isPromptReviewMode}
          onZoom={setZoomImage}
          onEditDialog={openEditDialog}
          onApprove={handleApprove}
          onGenerateCover={handleGenerateCoverIllustration}
          setApprovedPages={setApprovedPages}
        />
      )}

      {/* Navigation Buttons */}
      <Box sx={{ display: "flex", justifyContent: "space-between" }}>
        <Button variant="outlined" startIcon={<ArrowBack />} onClick={onBack}>
          Back to Avatars
        </Button>
        {isPromptReviewMode ? (
          <>
            <ButtonGroup variant="contained" size="large">
              <Button
                size="small"
                onClick={(e) => setGenerateMenuAnchor(e.currentTarget)}
              >
                Generate All Illustrations <ArrowDropDown />
              </Button>
            </ButtonGroup>
            <Menu
              anchorEl={generateMenuAnchor}
              open={Boolean(generateMenuAnchor)}
              onClose={() => setGenerateMenuAnchor(null)}
              anchorOrigin={{ vertical: "top", horizontal: "right" }}
              transformOrigin={{ vertical: "bottom", horizontal: "right" }}
            >
              <MenuItem
                onClick={() => handleGenerateAllIllustrations("immediate")}
              >
                <ListItemIcon>
                  <Speed fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary="Immediate"
                  secondary="Generate now, wait here"
                />
              </MenuItem>
              <MenuItem onClick={() => handleGenerateAllIllustrations("batch")}>
                <ListItemIcon>
                  <Schedule fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary="Batch Request"
                  secondary="Track progress in Batch Requests"
                />
              </MenuItem>
            </Menu>
          </>
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

      {/* Dialogs */}
      <EditDialog
        open={editDialog.open}
        page={editDialog.page}
        isCover={editDialog.isCover}
        customDescription={customDescription}
        referenceImage={referenceImage}
        referenceImagePreview={referenceImagePreview}
        onClose={() =>
          setEditDialog({ open: false, page: null, isCover: false })
        }
        onCustomDescriptionChange={setCustomDescription}
        onFileSelect={handleFileSelect}
        onClearImage={handleClearImage}
        onRegenerate={() =>
          editDialog.isCover
            ? handleRegenerateCover(true)
            : handleRegeneratePage(editDialog.page, true)
        }
      />

      <ZoomDialog zoomImage={zoomImage} onClose={() => setZoomImage(null)} />

      <TextEditDialog
        open={textEditDialog.open}
        page={textEditDialog.page}
        isNew={textEditDialog.isNew}
        editedText={editedText}
        editedImageDescription={editedImageDescription}
        savingText={savingText}
        onClose={() =>
          setTextEditDialog({ open: false, page: null, isNew: false })
        }
        onTextChange={setEditedText}
        onImageDescriptionChange={setEditedImageDescription}
        onSave={handleSavePageText}
      />

      <DeleteDialog
        open={deleteDialog.open}
        page={deleteDialog.page}
        deleting={deleting}
        onClose={() => setDeleteDialog({ open: false, page: null })}
        onDelete={handleDeletePage}
      />
    </Box>
  );
}

export default PageReview;
