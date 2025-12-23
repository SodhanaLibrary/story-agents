import { useState, useEffect } from "react";
import {
  Box,
  Chip,
  TextField,
  Autocomplete,
  Typography,
  Stack,
  IconButton,
  Tooltip,
  CircularProgress,
} from "@mui/material";
import { Add, LocalOffer } from "@mui/icons-material";

function TagManager({ storyId, isEditable = false }) {
  const [tags, setTags] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  // Fetch tags for this story and all available tags
  useEffect(() => {
    const fetchTags = async () => {
      setLoading(true);
      try {
        const [storyTagsRes, allTagsRes] = await Promise.all([
          fetch(`/api/stories/${storyId}/tags`),
          fetch("/api/tags"),
        ]);

        const storyTagsData = await storyTagsRes.json();
        const allTagsData = await allTagsRes.json();

        setTags(storyTagsData.tags || []);
        setAllTags(allTagsData.tags || []);
      } catch (err) {
        console.error("Failed to fetch tags:", err);
      } finally {
        setLoading(false);
      }
    };

    if (storyId) {
      fetchTags();
    }
  }, [storyId]);

  const handleAddTag = async (tagName) => {
    if (!tagName.trim() || !isEditable) return;

    setSaving(true);
    try {
      const newTags = [...tags.map((t) => t.name), tagName.trim().toLowerCase()];
      await fetch(`/api/stories/${storyId}/tags`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: [...new Set(newTags)] }),
      });

      // Refresh tags
      const res = await fetch(`/api/stories/${storyId}/tags`);
      const data = await res.json();
      setTags(data.tags || []);
      setInputValue("");
    } catch (err) {
      console.error("Failed to add tag:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveTag = async (tagId) => {
    if (!isEditable) return;

    setSaving(true);
    try {
      const newTags = tags.filter((t) => t.id !== tagId).map((t) => t.name);
      await fetch(`/api/stories/${storyId}/tags`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: newTags }),
      });

      setTags(tags.filter((t) => t.id !== tagId));
    } catch (err) {
      console.error("Failed to remove tag:", err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <LocalOffer sx={{ fontSize: 16, color: "text.secondary" }} />
        <CircularProgress size={16} />
      </Box>
    );
  }

  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" gap={0.5}>
        <LocalOffer sx={{ fontSize: 16, color: "text.secondary" }} />

        {tags.length === 0 && !isEditing && (
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            No tags
          </Typography>
        )}

        {tags.map((tag) => (
          <Chip
            key={tag.id}
            label={tag.name}
            size="small"
            onDelete={isEditable ? () => handleRemoveTag(tag.id) : undefined}
            sx={{
              bgcolor: tag.color || "rgba(99, 102, 241, 0.2)",
              color: "text.primary",
              fontSize: "0.75rem",
            }}
          />
        ))}

        {isEditable && !isEditing && (
          <Tooltip title="Add tag">
            <IconButton
              size="small"
              onClick={() => setIsEditing(true)}
              sx={{ color: "text.secondary" }}
            >
              <Add fontSize="small" />
            </IconButton>
          </Tooltip>
        )}

        {isEditable && isEditing && (
          <Autocomplete
            freeSolo
            size="small"
            options={allTags.map((t) => t.name)}
            inputValue={inputValue}
            onInputChange={(e, value) => setInputValue(value)}
            onChange={(e, value) => {
              if (value) {
                handleAddTag(value);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && inputValue.trim()) {
                handleAddTag(inputValue);
              } else if (e.key === "Escape") {
                setIsEditing(false);
                setInputValue("");
              }
            }}
            onBlur={() => {
              if (!inputValue.trim()) {
                setIsEditing(false);
              }
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder="Add tag..."
                autoFocus
                sx={{
                  minWidth: 120,
                  "& .MuiOutlinedInput-root": {
                    fontSize: "0.75rem",
                    py: 0,
                  },
                }}
              />
            )}
            sx={{ minWidth: 150 }}
            disabled={saving}
          />
        )}

        {saving && <CircularProgress size={14} />}
      </Stack>
    </Box>
  );
}

export default TagManager;

