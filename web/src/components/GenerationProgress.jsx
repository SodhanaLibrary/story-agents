import { useState, useEffect } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Stack,
  Chip,
  Avatar,
  Alert,
} from "@mui/material";
import {
  AutoAwesome,
  Person,
  Image,
  MenuBook,
  Brush,
  CheckCircle,
} from "@mui/icons-material";

const phaseInfo = {
  page_generation: { icon: <MenuBook />, label: "Creating Story Pages", progress: 50 },
  illustration_generation: { icon: <Brush />, label: "Creating Illustrations", progress: 75 },
  cover_generation: { icon: <Image />, label: "Designing Cover", progress: 95 },
  complete: { icon: <CheckCircle />, label: "Complete", progress: 100 },
};

function GenerationProgress({ jobId, phase, onComplete, onError }) {
  const [job, setJob] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!jobId) return;

    const pollJob = async () => {
      try {
        const response = await fetch(`/api/job/${jobId}`);
        const data = await response.json();
        setJob(data);

        if (data.status === "completed" && data.result) {
          onComplete(data.result);
        } else if (data.status === "error") {
          setError(data.error);
          onError(data.error);
        }
      } catch (err) {
        console.error("Failed to poll job:", err);
      }
    };

    // Poll immediately and then every 2 seconds
    pollJob();
    const interval = setInterval(pollJob, 2000);

    return () => clearInterval(interval);
  }, [jobId]);

  if (error) {
    return (
      <Box className="fade-in" sx={{ textAlign: "center", py: 8 }}>
        <Alert severity="error" sx={{ maxWidth: 500, mx: "auto" }}>
          <Typography variant="h6" sx={{ mb: 1 }}>Generation Failed</Typography>
          <Typography variant="body2">{error}</Typography>
        </Alert>
      </Box>
    );
  }

  const currentPhase = phaseInfo[job?.phase] || { icon: <AutoAwesome />, label: "Processing...", progress: 50 };
  const progress = job?.progress || 50;

  return (
    <Box className="fade-in">
      <Box sx={{ textAlign: "center", mb: 4 }}>
        <Typography variant="h2" sx={{ mb: 2, color: "primary.main" }}>
          Creating Your Story
        </Typography>
        <Typography variant="body1" sx={{ color: "text.secondary" }}>
          Generating illustrated pages based on your approved characters
        </Typography>
      </Box>

      <Card sx={{ maxWidth: 600, mx: "auto", mb: 4 }}>
        <CardContent sx={{ p: 4 }}>
          {/* Progress Bar */}
          <Box sx={{ mb: 4 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Progress
              </Typography>
              <Typography variant="body2" sx={{ color: "primary.main", fontWeight: 600 }}>
                {progress}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={progress}
              sx={{
                height: 10,
                borderRadius: 5,
                bgcolor: "rgba(232, 184, 109, 0.1)",
                "& .MuiLinearProgress-bar": {
                  bgcolor: "primary.main",
                  borderRadius: 5,
                },
              }}
            />
          </Box>

          {/* Current Phase */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              p: 2,
              bgcolor: "rgba(232, 184, 109, 0.1)",
              borderRadius: 2,
              mb: 3,
            }}
          >
            <Box
              className="pulse"
              sx={{
                p: 1.5,
                bgcolor: "primary.main",
                borderRadius: "50%",
                color: "background.paper",
                display: "flex",
              }}
            >
              {currentPhase.icon}
            </Box>
            <Box>
              <Typography variant="h6">{currentPhase.label}</Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                {job?.message || "Processing..."}
              </Typography>
            </Box>
          </Box>

          {/* Characters being used */}
          {job?.characters && job.characters.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" sx={{ color: "text.secondary", mb: 1 }}>
                Characters in your story:
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {job.characters.map((char, index) => (
                  <Chip
                    key={index}
                    avatar={
                      <Avatar
                        src={char.avatarUrl}
                        sx={{ bgcolor: "primary.main" }}
                      >
                        {char.name[0]}
                      </Avatar>
                    }
                    label={char.name}
                    variant="outlined"
                    size="small"
                  />
                ))}
              </Stack>
            </Box>
          )}

          {/* Story info */}
          {job?.storyPages?.title && (
            <Box sx={{ p: 2, bgcolor: "rgba(123, 104, 238, 0.1)", borderRadius: 2 }}>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Story Title:
              </Typography>
              <Typography variant="h6">{job.storyPages.title}</Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Phase Timeline */}
      <Card sx={{ maxWidth: 600, mx: "auto" }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>Generation Progress</Typography>
          <Stack spacing={1}>
            {/* Avatars - already complete */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 2,
                p: 1,
                borderRadius: 1,
              }}
            >
              <CheckCircle sx={{ color: "success.main" }} />
              <Typography variant="body2" sx={{ color: "success.main" }}>
                Character Avatars (Approved)
              </Typography>
            </Box>

            {Object.entries(phaseInfo).map(([key, info]) => {
              const phaseProgress = info.progress;
              const isComplete = progress >= phaseProgress;
              const isCurrent = job?.phase === key;

              return (
                <Box
                  key={key}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 2,
                    p: 1,
                    borderRadius: 1,
                    bgcolor: isCurrent ? "rgba(232, 184, 109, 0.1)" : "transparent",
                  }}
                >
                  {isComplete ? (
                    <CheckCircle sx={{ color: "success.main" }} />
                  ) : (
                    <Box sx={{ color: isCurrent ? "primary.main" : "text.secondary" }}>
                      {info.icon}
                    </Box>
                  )}
                  <Typography
                    variant="body2"
                    sx={{
                      color: isComplete ? "success.main" : isCurrent ? "primary.main" : "text.secondary",
                      fontWeight: isCurrent ? 600 : 400,
                    }}
                  >
                    {info.label}
                  </Typography>
                </Box>
              );
            })}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}

export default GenerationProgress;
