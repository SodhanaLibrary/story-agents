import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
  InputAdornment,
  IconButton,
  Avatar,
  Divider,
} from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import { useAuth } from "../context/AuthContext";

export default function AccountPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated, changePassword, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isAuthenticated || !user) {
    navigate("/login", { replace: true });
    return null;
  }

  const hasPassword = user.dbUser?.hasPassword === true;
  const displayName = user.name || user.email || "User";
  const displayEmail = user.email || user.dbUser?.email;

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      return;
    }
    setLoading(true);
    try {
      await changePassword(currentPassword, newPassword);
      setSuccess("Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err.message || "Failed to change password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 560, mx: "auto", py: 4 }}>
      <Typography variant="h4" sx={{ fontFamily: '"Crimson Pro", serif', fontWeight: 700, mb: 3 }}>
        Account
      </Typography>

      <Paper
        elevation={0}
        sx={{
          p: 3,
          borderRadius: 2,
          bgcolor: "rgba(26, 26, 46, 0.8)",
          border: "1px solid",
          borderColor: "divider",
          mb: 3,
        }}
      >
        <Typography variant="h6" sx={{ mb: 2 }}>
          Profile
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
          <Avatar src={user.picture} sx={{ width: 56, height: 56 }}>
            {displayName.charAt(0)}
          </Avatar>
          <Box>
            <Typography variant="body1" fontWeight={600}>
              {displayName}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {displayEmail}
            </Typography>
          </Box>
        </Box>
        <Typography variant="body2" color="text.secondary">
          To update your name or profile picture, use your sign-in method (Google or email). Profile editing may be added later.
        </Typography>
        <Button
          id="account-view-profile"
          variant="outlined"
          size="small"
          sx={{ mt: 2 }}
          onClick={() => navigate(`/profile/${user.id || user.dbUser?.id}`)}
        >
          View public profile
        </Button>
      </Paper>

      {hasPassword && (
        <Paper
          elevation={0}
          sx={{
            p: 3,
            borderRadius: 2,
            bgcolor: "rgba(26, 26, 46, 0.8)",
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          <Typography variant="h6" sx={{ mb: 2 }}>
            Change password
          </Typography>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
              {error}
            </Alert>
          )}
          {success && (
            <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess("")}>
              {success}
            </Alert>
          )}
          <form onSubmit={handleChangePassword}>
            <TextField
              id="account-current-password"
              label="Current password"
              type={showPasswords ? "text" : "password"}
              fullWidth
              required
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              margin="normal"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      id="account-toggle-passwords"
                      onClick={() => setShowPasswords(!showPasswords)}
                      edge="end"
                      aria-label="toggle password visibility"
                    >
                      {showPasswords ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              id="account-new-password"
              label="New password"
              type={showPasswords ? "text" : "password"}
              fullWidth
              required
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              margin="normal"
              helperText="At least 8 characters"
            />
            <TextField
              id="account-confirm-password"
              label="Confirm new password"
              type={showPasswords ? "text" : "password"}
              fullWidth
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              margin="normal"
            />
            <Button
              id="account-change-password-submit"
              type="submit"
              variant="contained"
              disabled={loading}
              sx={{ mt: 2 }}
            >
              {loading ? "Updating…" : "Update password"}
            </Button>
          </form>
        </Paper>
      )}

      {!hasPassword && (
        <Paper
          elevation={0}
          sx={{
            p: 3,
            borderRadius: 2,
            bgcolor: "rgba(26, 26, 46, 0.8)",
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          <Typography variant="body2" color="text.secondary">
            You signed in with Google. Password change is not available for Google accounts.
          </Typography>
        </Paper>
      )}
    </Box>
  );
}
