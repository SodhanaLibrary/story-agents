import { useState } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
  InputAdornment,
  IconButton,
} from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import { useAuth } from "../context/AuthContext";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");
  const { resetPassword } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!token) {
      setError("Invalid reset link. Please request a new one.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      await resetPassword(token, password);
      setSuccess(true);
    } catch (err) {
      setError(err.message || "Reset failed");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <Box sx={{ maxWidth: 420, mx: "auto", py: 4 }}>
        <Paper elevation={0} sx={{ p: 3, borderRadius: 2, bgcolor: "rgba(26, 26, 46, 0.8)", border: "1px solid", borderColor: "divider", textAlign: "center" }}>
          <Alert severity="error" sx={{ mb: 2 }}>Missing or invalid reset link. Please use the link from your email or request a new one.</Alert>
          <Button component={Link} to="/forgot-password" variant="contained">Request reset link</Button>
        </Paper>
      </Box>
    );
  }

  if (success) {
    return (
      <Box sx={{ maxWidth: 420, mx: "auto", py: 4 }}>
        <Paper elevation={0} sx={{ p: 3, borderRadius: 2, bgcolor: "rgba(26, 26, 46, 0.8)", border: "1px solid", borderColor: "divider", textAlign: "center" }}>
          <Typography variant="h6" sx={{ mb: 1 }}>Password reset</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>You can now sign in with your new password.</Typography>
          <Button id="reset-password-sign-in" component={Link} to="/login" variant="contained">Sign in</Button>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 420, mx: "auto", py: 4 }}>
      <Typography variant="h4" sx={{ fontFamily: '"Crimson Pro", serif', fontWeight: 700, mb: 1, textAlign: "center" }}>
        Set new password
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", mb: 3 }}>
        Enter your new password below
      </Typography>

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
        <form onSubmit={handleSubmit}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
              {error}
            </Alert>
          )}
          <TextField
            id="reset-password"
            label="New password"
            type={showPassword ? "text" : "password"}
            fullWidth
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            margin="normal"
            helperText="At least 8 characters"
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    id="reset-toggle-password"
                    onClick={() => setShowPassword(!showPassword)}
                    edge="end"
                    aria-label="toggle password visibility"
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
          <TextField
            id="reset-confirm"
            label="Confirm new password"
            type={showPassword ? "text" : "password"}
            fullWidth
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            margin="normal"
          />
          <Button
            id="reset-submit"
            type="submit"
            variant="contained"
            fullWidth
            size="large"
            disabled={loading}
            sx={{ mt: 3 }}
          >
            {loading ? "Resetting…" : "Reset password"}
          </Button>
        </form>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: "center" }}>
          <Link to="/login" style={{ color: "var(--mui-palette-primary-main)" }}>
            Back to sign in
          </Link>
        </Typography>
      </Paper>
    </Box>
  );
}
