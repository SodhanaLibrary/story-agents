import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Chip,
  Stack,
  LinearProgress,
} from "@mui/material";
import { Check, Close } from "@mui/icons-material";

// Loading state component
export function LoadingState({ job, regeneratingPages, desiredPageCount }) {
  return (
    <Box className="fade-in">
      <Box sx={{ textAlign: "center", mb: 4 }}>
        <Typography variant="h2" sx={{ mb: 2, color: "primary.main" }}>
          {regeneratingPages ? "Regenerating Pages" : "Creating Pages"}
        </Typography>
        <Typography variant="body1" sx={{ color: "text.secondary" }}>
          {regeneratingPages
            ? `Creating ${desiredPageCount || "new"} pages...`
            : "Generating story pages..."}
        </Typography>
      </Box>

      <Card sx={{ maxWidth: 500, mx: "auto" }}>
        <CardContent sx={{ p: 4, textAlign: "center" }}>
          <CircularProgress sx={{ color: "primary.main", mb: 3 }} size={60} />
          <Typography variant="h6" sx={{ mb: 1 }}>
            {regeneratingPages
              ? "Regenerating Story Pages"
              : job?.phase === "page_generation"
                ? "Creating Story Pages"
                : job?.phase === "illustration_generation"
                  ? "Generating Illustrations"
                  : job?.phase === "cover_generation"
                    ? "Creating Book Cover"
                    : "Processing..."}
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {regeneratingPages
              ? `Creating ${desiredPageCount || "new"} pages for your story...`
              : job?.message || "Please wait..."}
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

// Error state component
export function ErrorState({ job, onBack }) {
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

// Batch progress state component
export function BatchProgressState({
  batchRequest,
  onCancelBatch,
  onViewResults,
}) {
  const batchProgress =
    batchRequest.total_pages > 0
      ? Math.round(
          (batchRequest.completed_pages / batchRequest.total_pages) * 100
        )
      : 0;
  const isCompleted = batchRequest.status === "completed";
  const isFailed = batchRequest.status === "failed";
  const isCancelled = batchRequest.status === "cancelled";

  return (
    <Box className="fade-in">
      <Box sx={{ textAlign: "center", mb: 4 }}>
        <Typography variant="h2" sx={{ mb: 2, color: "primary.main" }}>
          {isCompleted
            ? "Illustrations Complete!"
            : isFailed
              ? "Generation Failed"
              : isCancelled
                ? "Generation Cancelled"
                : "Batch Processing"}
        </Typography>
        <Typography variant="body1" sx={{ color: "text.secondary" }}>
          {isCompleted
            ? "All illustrations have been generated successfully."
            : isFailed
              ? batchRequest.error_message ||
                "An error occurred during generation."
              : isCancelled
                ? "The batch request was cancelled."
                : "Your illustrations are being generated in the background."}
        </Typography>
      </Box>

      <Card sx={{ maxWidth: 500, mx: "auto" }}>
        <CardContent sx={{ p: 4 }}>
          {/* Status Icon */}
          <Box sx={{ textAlign: "center", mb: 3 }}>
            {isCompleted ? (
              <Check sx={{ fontSize: 60, color: "success.main" }} />
            ) : isFailed || isCancelled ? (
              <Close sx={{ fontSize: 60, color: "error.main" }} />
            ) : (
              <CircularProgress sx={{ color: "primary.main" }} size={60} />
            )}
          </Box>

          {/* Progress Details */}
          <Box sx={{ mb: 3 }}>
            <Stack
              direction="row"
              justifyContent="space-between"
              sx={{ mb: 1 }}
            >
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Progress (pages + cover)
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: "bold" }}>
                {batchRequest.completed_pages || 0} /{" "}
                {batchRequest.total_pages || 0}
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={batchProgress}
              color={
                isCompleted
                  ? "success"
                  : isFailed || isCancelled
                    ? "error"
                    : "primary"
              }
              sx={{ height: 8, borderRadius: 4 }}
            />
          </Box>

          {/* Status Badge */}
          <Box sx={{ textAlign: "center", mb: 2 }}>
            <Chip
              label={batchRequest.status?.toUpperCase() || "PROCESSING"}
              color={
                isCompleted
                  ? "success"
                  : isFailed || isCancelled
                    ? "error"
                    : "primary"
              }
              variant={
                isCompleted || isFailed || isCancelled ? "filled" : "outlined"
              }
            />
          </Box>

          {/* Time Info */}
          {batchRequest.created_at && (
            <Typography
              variant="caption"
              sx={{
                color: "text.secondary",
                display: "block",
                textAlign: "center",
                mb: 2,
              }}
            >
              Started: {new Date(batchRequest.created_at).toLocaleTimeString()}
              {batchRequest.completed_at && (
                <>
                  {" "}
                  • Finished:{" "}
                  {new Date(batchRequest.completed_at).toLocaleTimeString()}
                </>
              )}
            </Typography>
          )}

          {/* Actions */}
          <Stack direction="row" spacing={2} justifyContent="center">
            {!isCompleted && !isFailed && !isCancelled && (
              <Button
                variant="outlined"
                color="error"
                onClick={onCancelBatch}
                startIcon={<Close />}
              >
                Cancel
              </Button>
            )}
            {(isCompleted || isFailed || isCancelled) && (
              <Button variant="contained" onClick={onViewResults}>
                {isCompleted ? "View Results" : "Go Back"}
              </Button>
            )}
          </Stack>
        </CardContent>
      </Card>

      {/* Tip */}
      {!isCompleted && !isFailed && !isCancelled && (
        <Typography
          variant="body2"
          sx={{
            color: "text.secondary",
            textAlign: "center",
            mt: 3,
            maxWidth: 400,
            mx: "auto",
          }}
        >
          💡 You can leave this page and come back later. Your progress is saved
          automatically.
        </Typography>
      )}
    </Box>
  );
}

// Immediate generation progress state
export function ImmediateGenerationState({ job }) {
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
