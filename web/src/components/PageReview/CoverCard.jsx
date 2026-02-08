import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  CircularProgress,
  IconButton,
  Chip,
  Stack,
} from "@mui/material";
import {
  Check,
  Edit,
  ZoomIn,
  AutoAwesome,
  MenuBook,
} from "@mui/icons-material";

function CoverCard({
  job,
  approvedPages,
  regenerating,
  isPromptReviewMode,
  onZoom,
  onEditDialog,
  onApprove,
  onGenerateCover,
  setApprovedPages,
}) {
  return (
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
                onClick={() => onZoom(job.cover.illustrationUrl)}
                sx={{
                  bgcolor: "rgba(255,255,255,0.2)",
                  "&:hover": { bgcolor: "rgba(255,255,255,0.3)" },
                }}
              >
                <ZoomIn />
              </IconButton>
              <IconButton
                onClick={() => onEditDialog(job.cover, true)}
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
                    onClick={() => onApprove("cover")}
                    disabled={regenerating.cover}
                    sx={{ flex: 1 }}
                  >
                    Approve Cover
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<Edit />}
                    onClick={() => onEditDialog(job.cover, true)}
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
              <Button
                variant="contained"
                startIcon={<AutoAwesome />}
                onClick={onGenerateCover}
                disabled={regenerating.cover}
                fullWidth
              >
                Generate Cover
              </Button>
            </Stack>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}

export default CoverCard;
