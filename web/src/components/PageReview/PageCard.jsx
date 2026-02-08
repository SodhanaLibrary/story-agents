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
  Refresh,
  Edit,
  ZoomIn,
  Image as ImageIcon,
  AutoAwesome,
  Delete,
  TextFields,
} from "@mui/icons-material";

function PageCard({
  page,
  pageKey,
  approvedPages,
  regenerating,
  generatingPage,
  totalPages,
  onZoom,
  onEditDialog,
  onTextEditDialog,
  onDeleteDialog,
  onApprove,
  onGenerateIllustration,
  setApprovedPages,
}) {
  const hasIllustration = page.illustrationGenerated || page.illustrationUrl;
  const isGeneratingThis = generatingPage === page.pageNumber;

  return (
    <Card
      sx={{
        height: "100%",
        border: approvedPages[pageKey] ? "2px solid" : "1px solid",
        borderColor: approvedPages[pageKey]
          ? "success.main"
          : "rgba(232, 184, 109, 0.15)",
        transition: "all 0.2s",
        opacity: regenerating[pageKey] || isGeneratingThis ? 0.7 : 1,
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
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {isGeneratingThis ? "Generating..." : "Regenerating..."}
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
              onClick={() => onGenerateIllustration(page.pageNumber)}
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
              onClick={() => onZoom(page.illustrationUrl)}
              sx={{
                bgcolor: "rgba(255,255,255,0.2)",
                "&:hover": { bgcolor: "rgba(255,255,255,0.3)" },
              }}
            >
              <ZoomIn />
            </IconButton>
            <IconButton
              onClick={() => onEditDialog(page, false)}
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
              onClick={() => onTextEditDialog(page, false)}
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
                onClick={() => onDeleteDialog(page)}
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
            !approvedPages[pageKey] ? (
              <>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<Check />}
                  onClick={() => onApprove(pageKey)}
                  disabled={regenerating[pageKey]}
                  sx={{ flex: 1 }}
                >
                  Approve
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<Edit />}
                  onClick={() => onEditDialog(page, false)}
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
            <Button
              variant="contained"
              size="small"
              startIcon={<AutoAwesome />}
              onClick={() => onGenerateIllustration(page.pageNumber)}
              disabled={isGeneratingThis}
              fullWidth
            >
              Generate Illustration
            </Button>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

export default PageCard;
