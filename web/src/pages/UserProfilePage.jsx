import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Avatar,
  Grid,
  Stack,
  Chip,
  CircularProgress,
  Tabs,
  Tab,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import {
  Edit,
  PersonAdd,
  PersonRemove,
  MenuBook,
  People,
  Close,
  ArrowBack,
  Message as MessageIcon,
  Add,
  Folder,
  Delete,
} from "@mui/icons-material";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";

function UserProfilePage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, userId: currentUserId } = useAuth();
  
  const [profile, setProfile] = useState(null);
  const [stories, setStories] = useState([]);
  const [volumes, setVolumes] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", username: "", bio: "" });
  const [volumeDialogOpen, setVolumeDialogOpen] = useState(false);
  const [volumeEditId, setVolumeEditId] = useState(null);
  const [volumeForm, setVolumeForm] = useState({ title: "", description: "" });
  const [volumeSaving, setVolumeSaving] = useState(false);
  const [storyVolumeAssign, setStoryVolumeAssign] = useState(null);

  const isOwnProfile = currentUserId === parseInt(userId);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    try {
      const [profileRes, storiesRes, volumesRes, followersRes, followingRes] = await Promise.all([
        fetch(`/api/v1/users/${userId}/profile`),
        fetch(`/api/v1/users/${userId}/stories?viewerId=${currentUserId || ""}`),
        fetch(`/api/v1/users/${userId}/volumes`),
        fetch(`/api/v1/users/${userId}/followers`),
        fetch(`/api/v1/users/${userId}/following`),
      ]);

      const [profileData, storiesData, volumesData, followersData, followingData] = await Promise.all([
        profileRes.json(),
        storiesRes.json(),
        volumesRes.json(),
        followersRes.json(),
        followingRes.json(),
      ]);

      setProfile(profileData.profile);
      setStories(storiesData.stories || []);
      setVolumes(volumesData.volumes || []);
      setFollowers(followersData.followers || []);
      setFollowing(followingData.following || []);

      if (currentUserId && !isOwnProfile) {
        const followRes = await fetch(`/api/v1/users/${currentUserId}/is-following/${userId}`);
        const followData = await followRes.json();
        setIsFollowing(followData.isFollowing);
      }
    } catch (err) {
      console.error("Failed to fetch profile:", err);
    } finally {
      setLoading(false);
    }
  }, [userId, currentUserId, isOwnProfile]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleFollow = async () => {
    if (!isAuthenticated) return;

    setFollowLoading(true);
    try {
      if (isFollowing) {
        await fetch(`/api/v1/users/${userId}/follow?followerId=${currentUserId}`, { method: "DELETE" });
        setIsFollowing(false);
        setProfile((prev) => prev && { ...prev, followerCount: prev.followerCount - 1 });
      } else {
        await fetch(`/api/v1/users/${userId}/follow`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ followerId: currentUserId }),
        });
        setIsFollowing(true);
        setProfile((prev) => prev && { ...prev, followerCount: prev.followerCount + 1 });
      }
    } catch (err) {
      console.error("Failed to follow/unfollow:", err);
    } finally {
      setFollowLoading(false);
    }
  };

  const handleEditProfile = async () => {
    try {
      await fetch(`/api/v1/users/${userId}/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      setProfile((prev) => prev && { ...prev, ...editForm });
      setEditDialogOpen(false);
    } catch (err) {
      console.error("Failed to update profile:", err);
    }
  };

  const openEditDialog = () => {
    setEditForm({
      name: profile?.name || "",
      username: profile?.username || "",
      bio: profile?.bio || "",
    });
    setEditDialogOpen(true);
  };

  const openVolumeDialog = (volume = null) => {
    setVolumeEditId(volume?.id ?? null);
    setVolumeForm({ title: volume?.title ?? "", description: volume?.description ?? "" });
    setVolumeDialogOpen(true);
  };

  const handleSaveVolume = async () => {
    if (!volumeForm.title.trim()) return;
    setVolumeSaving(true);
    try {
      if (volumeEditId) {
        await api.put(`/api/v1/volumes/${volumeEditId}`, volumeForm);
      } else {
        await api.post(`/api/v1/users/${userId}/volumes`, volumeForm);
      }
      setVolumeDialogOpen(false);
      const volRes = await fetch(`/api/v1/users/${userId}/volumes`);
      const volData = await volRes.json();
      setVolumes(volData.volumes || []);
    } catch (err) {
      console.error("Failed to save volume:", err);
    } finally {
      setVolumeSaving(false);
    }
  };

  const handleDeleteVolume = async (vol) => {
    if (!window.confirm(`Delete volume "${vol.title}"? Stories will be unassigned.`)) return;
    try {
      await api.delete(`/api/v1/volumes/${vol.id}`);
      setVolumes((prev) => prev.filter((v) => v.id !== vol.id));
    } catch (err) {
      console.error("Failed to delete volume:", err);
    }
  };

  const handleStoryVolumeChange = async (storyId, volumeId) => {
    try {
      await api.put(`/api/v1/stories/${storyId}/volume`, { volumeId: volumeId || null });
      setStories((prev) => prev.map((s) => (s.id === storyId ? { ...s, volumeId: volumeId || null } : s)));
      setStoryVolumeAssign(null);
      const volRes = await fetch(`/api/v1/users/${userId}/volumes`);
      const volData = await volRes.json();
      setVolumes(volData.volumes || []);
    } catch (err) {
      console.error("Failed to update story volume:", err);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!profile) {
    return (
      <Box sx={{ textAlign: "center", py: 8 }}>
        <Typography variant="h6" sx={{ color: "text.secondary" }}>
          User not found
        </Typography>
        <Button id="btn-back-to-library-not-found" variant="contained" onClick={() => navigate("/")} sx={{ mt: 2 }}>
          Back to Library
        </Button>
      </Box>
    );
  }

  return (
    <Box className="fade-in">
      <Button
        id="btn-back-to-library"
        startIcon={<ArrowBack />}
        onClick={() => navigate("/")}
        sx={{ mb: 2, color: "text.secondary" }}
      >
        Back to Library
      </Button>

      {/* Profile Header */}
      <Card
        sx={{
          bgcolor: "rgba(30, 30, 50, 0.6)",
          backdropFilter: "blur(10px)",
          border: "1px solid rgba(232, 184, 109, 0.15)",
          mb: 3,
        }}
      >
        <CardContent sx={{ p: 4 }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={3} alignItems="center">
            <Avatar
              src={profile.picture}
              alt={profile.name}
              sx={{ width: 120, height: 120, border: "3px solid", borderColor: "primary.main" }}
            />

            <Box sx={{ flex: 1, textAlign: { xs: "center", sm: "left" } }}>
              <Typography variant="h4" sx={{ fontFamily: '"Crimson Pro", serif', fontWeight: 700 }}>
                {profile.name}
              </Typography>
              {profile.username && (
                <Typography variant="body1" sx={{ color: "text.secondary" }}>
                  @{profile.username}
                </Typography>
              )}
              {profile.role && (
                <Chip
                  label={profile.role === "admin" ? "Admin" : profile.role === "super-admin" ? "Super Admin" : profile.role.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                  size="small"
                  sx={{ mt: 0.5, fontWeight: 600, bgcolor: "primary.main", color: "primary.contrastText" }}
                />
              )}
              {profile.bio && (
                <Typography variant="body2" sx={{ mt: 1, color: "text.secondary" }}>
                  {profile.bio}
                </Typography>
              )}

              <Stack direction="row" spacing={3} sx={{ mt: 2 }} justifyContent={{ xs: "center", sm: "flex-start" }}>
                <Box sx={{ textAlign: "center" }}>
                  <Typography variant="h6" sx={{ color: "primary.main" }}>{profile.storyCount}</Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>Stories</Typography>
                </Box>
                <Box sx={{ textAlign: "center" }}>
                  <Typography variant="h6" sx={{ color: "primary.main" }}>{profile.followerCount}</Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>Followers</Typography>
                </Box>
                <Box sx={{ textAlign: "center" }}>
                  <Typography variant="h6" sx={{ color: "primary.main" }}>{profile.followingCount}</Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>Following</Typography>
                </Box>
              </Stack>
            </Box>

            <Stack spacing={1} direction="row" flexWrap="wrap">
              {isOwnProfile ? (
                <Button id="btn-edit-profile" variant="outlined" startIcon={<Edit />} onClick={openEditDialog} sx={{ borderColor: "primary.main", color: "primary.main" }}>
                  Edit Profile
                </Button>
              ) : (
                <>
                  {isAuthenticated && (
                    <Button
                      id="btn-message-user"
                      variant="outlined"
                      startIcon={<MessageIcon />}
                      onClick={() => navigate(`/messages?with=${userId}`)}
                      sx={{ borderColor: "primary.main", color: "primary.main" }}
                    >
                      Message
                    </Button>
                  )}
                  {isAuthenticated && (
                    <Button
                      id="btn-follow-user"
                      variant={isFollowing ? "outlined" : "contained"}
                      startIcon={isFollowing ? <PersonRemove /> : <PersonAdd />}
                      onClick={handleFollow}
                      disabled={followLoading}
                      sx={isFollowing ? { borderColor: "error.main", color: "error.main" } : {}}
                    >
                      {followLoading ? <CircularProgress size={20} /> : isFollowing ? "Unfollow" : "Follow"}
                    </Button>
                  )}
                </>
              )}
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs
        id="profile-tabs"
        value={tabValue}
        onChange={(e, v) => setTabValue(v)}
        sx={{
          mb: 3,
          "& .MuiTab-root": { color: "text.secondary" },
          "& .Mui-selected": { color: "primary.main" },
          "& .MuiTabs-indicator": { backgroundColor: "primary.main" },
        }}
      >
        <Tab id="profile-tab-stories" icon={<MenuBook sx={{ fontSize: 18 }} />} iconPosition="start" label={`Stories (${stories.length})`} />
        <Tab id="profile-tab-volumes" icon={<Folder sx={{ fontSize: 18 }} />} iconPosition="start" label={`Volumes (${volumes.length})`} />
        <Tab id="profile-tab-followers" icon={<People sx={{ fontSize: 18 }} />} iconPosition="start" label={`Followers (${followers.length})`} />
        <Tab id="profile-tab-following" icon={<People sx={{ fontSize: 18 }} />} iconPosition="start" label={`Following (${following.length})`} />
      </Tabs>

      {/* Stories Tab */}
      {tabValue === 0 && (
        <Grid container spacing={3}>
          {stories.length === 0 ? (
            <Grid item xs={12}>
              <Box sx={{ textAlign: "center", py: 4 }}>
                <Typography sx={{ color: "text.secondary" }}>No stories yet</Typography>
              </Box>
            </Grid>
          ) : (
            stories.map((story) => (
              <Grid item xs={12} sm={6} md={4} key={story.id}>
                <Card
                  sx={{
                    bgcolor: "rgba(30, 30, 50, 0.6)",
                    border: "1px solid rgba(232, 184, 109, 0.15)",
                    transition: "all 0.3s ease",
                    "&:hover": { boxShadow: "0 8px 32px rgba(232, 184, 109, 0.15)" },
                  }}
                >
                  <Box id={`card-story-link-${story.id}`} onClick={() => navigate(`/story/${story.id}`)} sx={{ cursor: "pointer" }}>
                    {story.coverUrl && (
                      <Box component="img" src={story.coverUrl} alt={story.title} sx={{ width: "100%", height: 160, objectFit: "cover" }} />
                    )}
                    <CardContent>
                      <Typography variant="h6" sx={{ fontFamily: '"Crimson Pro", serif' }}>{story.title}</Typography>
                      {story.summary && (
                        <Typography variant="body2" sx={{ color: "text.secondary", overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                          {story.summary}
                        </Typography>
                      )}
                      <Chip label={story.artStyle} size="small" sx={{ mt: 1, fontSize: "0.7rem", bgcolor: "rgba(232, 184, 109, 0.15)" }} />
                    </CardContent>
                  </Box>
                  {isOwnProfile && (
                    <Box id={`story-volume-select-wrap-${story.id}`} sx={{ px: 2, pb: 2 }} onClick={(e) => e.stopPropagation()}>
                      <FormControl size="small" fullWidth>
                        <InputLabel>Volume</InputLabel>
                        <Select
                          id={`select-story-volume-${story.id}`}
                          label="Volume"
                          value={story.volumeId ?? ""}
                          onChange={(e) => handleStoryVolumeChange(story.id, e.target.value || null)}
                          onOpen={() => setStoryVolumeAssign(story.id)}
                          onClose={() => setStoryVolumeAssign(null)}
                        >
                          <MenuItem value="">No volume</MenuItem>
                          {volumes.map((v) => (
                            <MenuItem key={v.id} value={v.id}>{v.title}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Box>
                  )}
                </Card>
              </Grid>
            ))
          )}
        </Grid>
      )}

      {/* Volumes Tab */}
      {tabValue === 1 && (
        <Box>
          {isOwnProfile && (
            <Button
              id="btn-create-volume"
              variant="outlined"
              startIcon={<Add />}
              onClick={() => openVolumeDialog()}
              sx={{ mb: 2, borderColor: "primary.main", color: "primary.main" }}
            >
              Create volume
            </Button>
          )}
          {volumes.length === 0 ? (
            <Box sx={{ textAlign: "center", py: 4 }}>
              <Folder sx={{ fontSize: 48, color: "text.secondary", opacity: 0.5, mb: 1 }} />
              <Typography sx={{ color: "text.secondary" }}>
                {isOwnProfile ? "No volumes yet. Create a volume to group your stories." : "No volumes yet."}
              </Typography>
            </Box>
          ) : (
            <Grid container spacing={2}>
              {volumes.map((vol) => (
                <Grid item xs={12} sm={6} md={4} key={vol.id}>
                  <Card
                    id={`card-volume-${vol.id}`}
                    onClick={() => navigate(`/volume/${vol.id}`)}
                    sx={{
                      cursor: "pointer",
                      bgcolor: "rgba(30, 30, 50, 0.6)",
                      border: "1px solid rgba(232, 184, 109, 0.15)",
                      "&:hover": { borderColor: "rgba(232, 184, 109, 0.4)" },
                    }}
                  >
                    <CardContent>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{vol.title}</Typography>
                      {vol.description && (
                        <Typography variant="body2" color="text.secondary" noWrap>{vol.description}</Typography>
                      )}
                      <Typography variant="caption" color="text.secondary">{vol.storyCount ?? 0} stories</Typography>
                      {isOwnProfile && (
                        <Stack direction="row" spacing={1} sx={{ mt: 1 }} onClick={(e) => e.stopPropagation()}>
                          <Button id={`btn-edit-volume-${vol.id}`} size="small" startIcon={<Edit />} onClick={() => openVolumeDialog(vol)}>Edit</Button>
                          <Button id={`btn-delete-volume-${vol.id}`} size="small" color="error" startIcon={<Delete />} onClick={() => handleDeleteVolume(vol)}>Delete</Button>
                        </Stack>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      )}

      {/* Followers Tab */}
      {tabValue === 2 && (
        <Stack spacing={2}>
          {followers.length === 0 ? (
            <Box sx={{ textAlign: "center", py: 4 }}>
              <Typography sx={{ color: "text.secondary" }}>No followers yet</Typography>
            </Box>
          ) : (
            followers.map((user) => (
              <Card
                key={user.id}
                id={`card-follower-${user.id}`}
                onClick={() => navigate(`/profile/${user.id}`)}
                sx={{ cursor: "pointer", bgcolor: "rgba(30, 30, 50, 0.6)", border: "1px solid rgba(232, 184, 109, 0.1)", "&:hover": { borderColor: "rgba(232, 184, 109, 0.3)" } }}
              >
                <CardContent sx={{ py: 1.5 }}>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Avatar src={user.picture} alt={user.name} sx={{ width: 48, height: 48 }} />
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{user.name}</Typography>
                      {user.username && <Typography variant="body2" sx={{ color: "text.secondary" }}>@{user.username}</Typography>}
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            ))
          )}
        </Stack>
      )}

      {/* Following Tab */}
      {tabValue === 3 && (
        <Stack spacing={2}>
          {following.length === 0 ? (
            <Box sx={{ textAlign: "center", py: 4 }}>
              <Typography sx={{ color: "text.secondary" }}>Not following anyone yet</Typography>
            </Box>
          ) : (
            following.map((user) => (
              <Card
                key={user.id}
                id={`card-following-${user.id}`}
                onClick={() => navigate(`/profile/${user.id}`)}
                sx={{ cursor: "pointer", bgcolor: "rgba(30, 30, 50, 0.6)", border: "1px solid rgba(232, 184, 109, 0.1)", "&:hover": { borderColor: "rgba(232, 184, 109, 0.3)" } }}
              >
                <CardContent sx={{ py: 1.5 }}>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Avatar src={user.picture} alt={user.name} sx={{ width: 48, height: 48 }} />
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{user.name}</Typography>
                      {user.username && <Typography variant="body2" sx={{ color: "text.secondary" }}>@{user.username}</Typography>}
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            ))
          )}
        </Stack>
      )}

      {/* Edit Profile Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { bgcolor: "background.paper" } }}>
        <DialogTitle>
          Edit Profile
          <IconButton id="btn-close-edit-profile" onClick={() => setEditDialogOpen(false)} sx={{ position: "absolute", right: 8, top: 8 }}>
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField id="profile-name-input" label="Name" value={editForm.name} onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))} fullWidth />
            <TextField id="profile-username-input" label="Username" value={editForm.username} onChange={(e) => setEditForm((prev) => ({ ...prev, username: e.target.value }))} fullWidth helperText="This will be your unique identifier" />
            <TextField id="profile-bio-input" label="Bio" value={editForm.bio} onChange={(e) => setEditForm((prev) => ({ ...prev, bio: e.target.value }))} fullWidth multiline rows={3} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button id="btn-cancel-edit-profile" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button id="btn-save-profile" variant="contained" onClick={handleEditProfile}>Save Changes</Button>
        </DialogActions>
      </Dialog>

      {/* Create / Edit Volume Dialog */}
      <Dialog open={volumeDialogOpen} onClose={() => setVolumeDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { bgcolor: "background.paper" } }}>
        <DialogTitle>{volumeEditId ? "Edit volume" : "Create volume"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              id="input-volume-title"
              label="Title"
              value={volumeForm.title}
              onChange={(e) => setVolumeForm((prev) => ({ ...prev, title: e.target.value }))}
              fullWidth
              required
            />
            <TextField
              id="input-volume-description"
              label="Description"
              value={volumeForm.description}
              onChange={(e) => setVolumeForm((prev) => ({ ...prev, description: e.target.value }))}
              fullWidth
              multiline
              rows={2}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button id="btn-volume-dialog-cancel" onClick={() => setVolumeDialogOpen(false)}>Cancel</Button>
          <Button id="btn-volume-dialog-save" variant="contained" onClick={handleSaveVolume} disabled={!volumeForm.title.trim() || volumeSaving}>
            {volumeSaving ? "Saving..." : volumeEditId ? "Save" : "Create"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default UserProfilePage;

