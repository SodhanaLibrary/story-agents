import { useRef } from "react";
import {
  Box,
  Typography,
  Button,
  TextField,
  CircularProgress,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
} from "@mui/material";
import {
  Check,
  Close,
  CloudUpload,
  AutoAwesome,
  Delete,
  TextFields,
} from "@mui/icons-material";

// Edit/Regenerate Illustration Dialog
export function EditDialog({
  open,
  page,
  isCover,
  customDescription,
  referenceImage,
  referenceImagePreview,
  onClose,
  onCustomDescriptionChange,
  onFileSelect,
  onClearImage,
  onRegenerate,
}) {
  const fileInputRef = useRef(null);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={1}>
          <AutoAwesome sx={{ color: "primary.main" }} />
          <Typography variant="h6">
            Regenerate {isCover ? "Cover" : `Page ${page?.pageNumber}`}
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
            onChange={onFileSelect}
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
                onClick={onClearImage}
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
            onChange={(e) => onCustomDescriptionChange(e.target.value)}
            placeholder="Describe the scene, characters, mood, colors, and style you want..."
            helperText="Be specific about what you want to see in the illustration"
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2, pt: 0 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={onRegenerate}
          disabled={!customDescription.trim() && !referenceImage}
          startIcon={<AutoAwesome />}
        >
          Regenerate
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// Zoom Dialog
export function ZoomDialog({ zoomImage, onClose }) {
  return (
    <Dialog open={!!zoomImage} onClose={onClose} maxWidth="lg">
      <IconButton
        onClick={onClose}
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
  );
}

// Text Edit Dialog
export function TextEditDialog({
  open,
  page,
  isNew,
  editedText,
  editedImageDescription,
  savingText,
  onClose,
  onTextChange,
  onImageDescriptionChange,
  onSave,
}) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={1}>
          <TextFields sx={{ color: "primary.main" }} />
          <Typography variant="h6">
            {isNew ? "Add New Page" : `Edit Page ${page?.pageNumber}`}
          </Typography>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ color: "text.secondary", mb: 3 }}>
          {isNew
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
            onChange={(e) => onTextChange(e.target.value)}
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
            onChange={(e) => onImageDescriptionChange(e.target.value)}
            placeholder="Describe what should be shown in the illustration for this page..."
            helperText="This prompt will be used to generate the illustration"
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2, pt: 0 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={onSave}
          disabled={!editedText.trim() || !editedImageDescription.trim() || savingText}
          startIcon={savingText ? <CircularProgress size={16} /> : <Check />}
        >
          {savingText ? "Saving..." : isNew ? "Add Page" : "Save Changes"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// Delete Confirmation Dialog
export function DeleteDialog({ open, page, deleting, onClose, onDelete }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Delete sx={{ color: "error.main" }} />
          <Typography variant="h6">Delete Page?</Typography>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          Are you sure you want to delete Page {page?.pageNumber}? This action
          cannot be undone. Remaining pages will be renumbered automatically.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ p: 2, pt: 0 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          color="error"
          onClick={onDelete}
          disabled={deleting}
          startIcon={deleting ? <CircularProgress size={16} /> : <Delete />}
        >
          {deleting ? "Deleting..." : "Delete Page"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
