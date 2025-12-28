import { useState, useEffect } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import {
  Box,
  Stepper,
  Step,
  StepLabel,
  Alert,
  Button,
  CircularProgress,
} from "@mui/material";
import { ArrowBack } from "@mui/icons-material";
import StoryInput from "../components/StoryInput";
import StyleSelector from "../components/StyleSelector";
import AvatarReview from "../components/AvatarReview";
import PageReview from "../components/PageReview";
import StoryViewer from "../components/StoryViewer";
import { useAuth } from "../context/AuthContext";

const steps = [
  "Write Story",
  "Art Style",
  "Review Avatars",
  "Review Pages",
  "View Story",
];

function CreateStoryPage({ isEditing: isEditingProp = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { storyId } = useParams();
  const { userId } = useAuth();

  const [activeStep, setActiveStep] = useState(0);
  const [story, setStory] = useState("");
  const [characters, setCharacters] = useState(null);
  const [selectedStyle, setSelectedStyle] = useState(null);
  const [customStyle, setCustomStyle] = useState("");
  const [pageCount, setPageCount] = useState(6);
  const [storyPages, setStoryPages] = useState(null);
  const [jobId, setJobId] = useState(null);
  const [generatedStory, setGeneratedStory] = useState(null);
  const [isEditing, setIsEditing] = useState(isEditingProp);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  // Handle resuming from draft
  useEffect(() => {
    const draftState = location.state;
    if (draftState?.draft) {
      const { draft, jobId: resumeJobId } = draftState;
      setJobId(resumeJobId);
      setStory(draft.story || "");
      setCharacters(draft.characters || []);
      setStoryPages(draft.storyPages || []);
      if (draft.artStyleKey) {
        setSelectedStyle(draft.artStyleKey);
      }
      if (draft.artStylePrompt) {
        setCustomStyle(draft.artStylePrompt);
      }
      if (draft.pageCount) {
        setPageCount(draft.pageCount);
      }
      setActiveStep(draft.currentStep || 0);
    }
  }, [location.state]);

  // Handle editing existing story
  useEffect(() => {
    if (storyId && isEditingProp) {
      loadStoryForEdit();
    }
  }, [storyId, isEditingProp]);

  const loadStoryForEdit = async () => {
    try {
      const response = await fetch(`/api/stories/${storyId}/edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();

      if (data.success && data.jobId) {
        setJobId(data.jobId);
        setStory(data.job.story || "");
        setSelectedStyle(data.job.artStyleDecision?.selectedStyle);
        setPageCount(data.job.pageCount || 6);
        setGeneratedStory(data.job);
        setIsEditing(true);
        setActiveStep(2); // Start at avatar review
      } else {
        setError(data.error || "Failed to load story for editing");
      }
    } catch (err) {
      console.error("Failed to load story for editing:", err);
      setError("Failed to load story for editing");
    }
  };

  const handleStorySubmit = async (storyText) => {
    setStory(storyText);
    setSaving(true);
    setError(null);

    try {
      // Create or update draft in database
      if (jobId) {
        // Update existing draft
        await fetch(`/api/drafts/${jobId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            story: storyText,
            pageCount,
            phase: "art_style_selection",
            status: "draft",
            userId,
          }),
        });
      } else {
        // Create new draft
        const response = await fetch("/api/drafts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            story: storyText,
            pageCount,
            targetAudience: "children",
            userId,
          }),
        });

        const data = await response.json();
        if (data.success && data.jobId) {
          setJobId(data.jobId);
        } else {
          throw new Error(data.error || "Failed to create draft");
        }
      }

      setActiveStep(1);
    } catch (err) {
      console.error("Failed to save draft:", err);
      setError("Failed to save draft. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleStyleSelect = async (styleKey, custom) => {
    setSelectedStyle(styleKey);
    setCustomStyle(custom || "");
    setSaving(true);
    setError(null);

    try {
      // Update draft with style selection
      if (jobId) {
        await fetch(`/api/drafts/${jobId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            artStyleKey: styleKey,
            artStylePrompt: custom || null,
            phase: "character_extraction",
            status: "processing",
          }),
        });
      }

      setActiveStep(2);

      if (!characters || characters.length === 0) {
        // Start character extraction with the existing jobId
        const response = await fetch("/api/extract-characters", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            story,
            artStyleKey: styleKey === "auto" ? null : styleKey,
            customArtStyle: styleKey === "custom" ? custom : null,
            jobId, // Pass existing jobId to continue the same draft
          }),
        });

        const data = await response.json();
        if (data.jobId && data.jobId !== jobId) {
          // Update jobId if server created a new one
          setJobId(data.jobId);
        }
      }
    } catch (err) {
      console.error(err);
      console.error("Failed to start character extraction:", err);
      setError("Failed to start character extraction");
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarsApproved = async () => {
    setActiveStep(3);

    if (!isEditing && (!storyPages || storyPages.length === 0)) {
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
      } catch (err) {
        console.error("Failed to start page generation:", err);
      }
    }
  };

  const handlePagesApproved = async (finalStory) => {
    setGeneratedStory(finalStory);
    setActiveStep(4);
  };

  const handleGenerationComplete = (result) => {
    setGeneratedStory(result);
    setActiveStep(4);
  };

  const getStepCompleted = (stepIndex) => {
    if (isEditing) {
      return stepIndex < 2 || stepIndex < activeStep;
    }
    return stepIndex < activeStep;
  };

  return (
    <Box className="fade-in">
      <Button
        startIcon={<ArrowBack />}
        onClick={() => navigate("/")}
        sx={{ mb: 2, color: "text.secondary" }}
      >
        Back to Library
      </Button>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Stepper */}
      <Stepper
        activeStep={activeStep}
        sx={{
          mb: 4,
          "& .MuiStepLabel-label": {
            color: "text.secondary",
            fontSize: "0.85rem",
            "&.Mui-active": {
              color: isEditing ? "secondary.main" : "primary.main",
            },
            "&.Mui-completed": { color: "success.main" },
          },
          "& .MuiStepIcon-root": {
            color: "rgba(232, 184, 109, 0.3)",
            "&.Mui-active": {
              color: isEditing ? "secondary.main" : "primary.main",
            },
            "&.Mui-completed": { color: "success.main" },
          },
        }}
      >
        {steps.map((label, index) => (
          <Step key={label} completed={getStepCompleted(index)}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {/* Step Content */}
      {activeStep === 0 && (
        <StoryInput
          onSubmit={handleStorySubmit}
          pageCount={pageCount}
          onPageCountChange={setPageCount}
          saving={saving}
          initialStory={story}
        />
      )}

      {activeStep === 1 && (
        <StyleSelector
          story={story}
          onSelect={handleStyleSelect}
          onBack={() => setActiveStep(0)}
          initialStyle={selectedStyle}
          initialCustomStyle={customStyle}
        />
      )}

      {activeStep === 2 && (
        <AvatarReview
          jobId={jobId}
          onApprove={handleAvatarsApproved}
          onBack={isEditing ? () => navigate("/") : () => setActiveStep(1)}
          setCharacters={setCharacters}
        />
      )}

      {activeStep === 3 && (
        <PageReview
          jobId={jobId}
          onComplete={handlePagesApproved}
          onBack={() => setActiveStep(2)}
          setStoryPages={setStoryPages}
        />
      )}

      {activeStep === 4 && generatedStory && (
        <StoryViewer
          story={generatedStory}
          onReset={() => navigate("/")}
          isEditable={false}
        />
      )}
    </Box>
  );
}

export default CreateStoryPage;
