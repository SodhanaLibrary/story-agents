import { useState, useEffect, useCallback } from "react";
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
  Tooltip,
  Divider,
} from "@mui/material";
import {
  Edit,
  PersonAdd,
  PersonRemove,
  MenuBook,
  People,
  Close,
  ArrowBack,
} from "@mui/icons-material";
import { useAuth } from "../context/AuthContext";

function UserProfile({ userId, onClose, onViewStory }) {
  const { isAuthenticated, userId: currentUserId } = useAuth();
  const [profile, setProfile] = useState(null);
  const [stories, setStories] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", username: "", bio: "" });

  const isOwnProfile = currentUserId === userId;

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    try {
      const [profileRes, storiesRes, followersRes, followingRes] = await Promise.all([
        fetch(`/api/users/${userId}/profile`),
        fetch(`/api/users/${userId}/stories?viewerId=${currentUserId || ""}`),
        fetch(`/api/users/${userId}/followers`),
        fetch(`/api/users/${userId}/following`),
      ]);

      const [profileData, storiesData, followersData, followingData] = await Promise.all([
        profileRes.json(),
        storiesRes.json(),
        followersRes.json(),
        followingRes.json(),
      ]);

      setProfile(profileData.profile);
      setStories(storiesData.stories || []);
      setFollowers(followersData.followers || []);
      setFollowing(followingData.following || []);

      // Check if current user is following
      if (currentUserId && !isOwnProfile) {
        const followRes = await fetch(`/api/users/${currentUserId}/is-following/${userId}`);
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
        await fetch(`/api/users/${userId}/follow?followerId=${currentUserId}`, {
          method: "DELETE",
        });
        setIsFollowing(false);
        setProfile((prev) => ({ ...prev, followerCount: prev.followerCount - 1 }));
      } else {
        await fetch(`/api/users/${userId}/follow`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ followerId: currentUserId }),
        });
        setIsFollowing(true);
        setProfile((prev) => ({ ...prev, followerCount: prev.followerCount + 1 }));
      }
    } catch (err) {
      console.error("Failed to follow/unfollow:", err);
    } finally {
      setFollowLoading(false);
    }
  };

  const handleEditProfile = async () => {
    try {
      await fetch(`/api/users/${userId}/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      setProfile((prev) => ({ ...prev, ...editForm }));
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
        <Typography>User not found</Typography>
      </Box>
    );
  }

  return (
    <Box className="fade-in">
      {/* Back Button */}
      <Button
        startIcon={<ArrowBack />}
        onClick={onClose}
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
              {profile.bio && (
                <Typography variant="body2" sx={{ mt: 1, color: "text.secondary" }}>
                  {profile.bio}
                </Typography>
              )}

              {/* Stats */}
              <Stack direction="row" spacing={3} sx={{ mt: 2 }} justifyContent={{ xs: "center", sm: "flex-start" }}>
                <Box sx={{ textAlign: "center" }}>
                  <Typography variant="h6" sx={{ color: "primary.main" }}>
                    {profile.storyCount}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    Stories
                  </Typography>
                </Box>
                <Box sx={{ textAlign: "center" }}>
                  <Typography variant="h6" sx={{ color: "primary.main" }}>
                    {profile.followerCount}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    Followers
                  </Typography>
                </Box>
                <Box sx={{ textAlign: "center" }}>
                  <Typography variant="h6" sx={{ color: "primary.main" }}>
                    {profile.followingCount}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    Following
                  </Typography>
                </Box>
              </Stack>
            </Box>

            {/* Action Buttons */}
            <Stack spacing={1}>
              {isOwnProfile ? (
                <Button
                  variant="outlined"
                  startIcon={<Edit />}
                  onClick={openEditDialog}
                  sx={{ borderColor: "primary.main", color: "primary.main" }}
                >
                  Edit Profile
                </Button>
              ) : isAuthenticated ? (
                <Button
                  variant={isFollowing ? "outlined" : "contained"}
                  startIcon={isFollowing ? <PersonRemove /> : <PersonAdd />}
                  onClick={handleFollow}
                  disabled={followLoading}
                  sx={isFollowing ? { borderColor: "error.main", color: "error.main" } : {}}
                >
                  {followLoading ? <CircularProgress size={20} /> : isFollowing ? "Unfollow" : "Follow"}
                </Button>
              ) : null}
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs
        value={tabValue}
        onChange={(e, v) => setTabValue(v)}
        sx={{
          mb: 3,
          "& .MuiTab-root": { color: "text.secondary" },
          "& .Mui-selected": { color: "primary.main" },
          "& .MuiTabs-indicator": { backgroundColor: "primary.main" },
        }}
      >
        <Tab icon={<MenuBook sx={{ fontSize: 18 }} />} iconPosition="start" label={`Stories (${stories.length})`} />
        <Tab icon={<People sx={{ fontSize: 18 }} />} iconPosition="start" label={`Followers (${followers.length})`} />
        <Tab icon={<People sx={{ fontSize: 18 }} />} iconPosition="start" label={`Following (${following.length})`} />
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
                  onClick={() => onViewStory(story)}
                  sx={{
                    cursor: "pointer",
                    bgcolor: "rgba(30, 30, 50, 0.6)",
                    border: "1px solid rgba(232, 184, 109, 0.15)",
                    transition: "all 0.3s ease",
                    "&:hover": {
                      transform: "translateY(-4px)",
                      boxShadow: "0 8px 32px rgba(232, 184, 109, 0.15)",
                    },
                  }}
                >
                  {story.coverUrl && (
                    <Box
                      component="img"
                      src={story.coverUrl}
                      alt={story.title}
                      sx={{ width: "100%", height: 160, objectFit: "cover" }}
                    />
                  )}
                  <CardContent>
                    <Typography variant="h6" sx={{ fontFamily: '"Crimson Pro", serif' }}>
                      {story.title}
                    </Typography>
                    {story.summary && (
                      <Typography
                        variant="body2"
                        sx={{
                          color: "text.secondary",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                        }}
                      >
                        {story.summary}
                      </Typography>
                    )}
                    <Chip
                      label={story.artStyle}
                      size="small"
                      sx={{ mt: 1, fontSize: "0.7rem", bgcolor: "rgba(232, 184, 109, 0.15)" }}
                    />
                  </CardContent>
                </Card>
              </Grid>
            ))
          )}
        </Grid>
      )}

      {/* Followers Tab */}
      {tabValue === 1 && (
        <Stack spacing={2}>
          {followers.length === 0 ? (
            <Box sx={{ textAlign: "center", py: 4 }}>
              <Typography sx={{ color: "text.secondary" }}>No followers yet</Typography>
            </Box>
          ) : (
            followers.map((user) => (
              <UserListItem key={user.id} user={user} onViewProfile={() => {}} />
            ))
          )}
        </Stack>
      )}

      {/* Following Tab */}
      {tabValue === 2 && (
        <Stack spacing={2}>
          {following.length === 0 ? (
            <Box sx={{ textAlign: "center", py: 4 }}>
              <Typography sx={{ color: "text.secondary" }}>Not following anyone yet</Typography>
            </Box>
          ) : (
            following.map((user) => (
              <UserListItem key={user.id} user={user} onViewProfile={() => {}} />
            ))
          )}
        </Stack>
      )}

      {/* Edit Profile Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { bgcolor: "background.paper" } }}
      >
        <DialogTitle>
          Edit Profile
          <IconButton
            onClick={() => setEditDialogOpen(false)}
            sx={{ position: "absolute", right: 8, top: 8 }}
          >
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Name"
              value={editForm.name}
              onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
              fullWidth
            />
            <TextField
              label="Username"
              value={editForm.username}
              onChange={(e) => setEditForm((prev) => ({ ...prev, username: e.target.value }))}
              fullWidth
              helperText="This will be your unique identifier"
            />
            <TextField
              label="Bio"
              value={editForm.bio}
              onChange={(e) => setEditForm((prev) => ({ ...prev, bio: e.target.value }))}
              fullWidth
              multiline
              rows={3}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleEditProfile}>
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// Helper component for user list items
function UserListItem({ user, onViewProfile }) {
  return (
    <Card
      sx={{
        bgcolor: "rgba(30, 30, 50, 0.6)",
        border: "1px solid rgba(232, 184, 109, 0.1)",
        cursor: "pointer",
        "&:hover": { borderColor: "rgba(232, 184, 109, 0.3)" },
      }}
      onClick={() => onViewProfile(user.id)}
    >
      <CardContent sx={{ py: 1.5 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Avatar src={user.picture} alt={user.name} sx={{ width: 48, height: 48 }} />
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {user.name}
            </Typography>
            {user.username && (
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                @{user.username}
              </Typography>
            )}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

export default UserProfile;

