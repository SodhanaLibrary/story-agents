import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
  InputAdornment,
  IconButton,
  Divider,
} from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import { GoogleLogin } from "@react-oauth/google";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, loginWithEmail, isAuthenticated } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    navigate("/", { replace: true });
    return null;
  }

  const handleGoogleSuccess = async (credentialResponse) => {
    setError("");
    try {
      await login(credentialResponse.credential);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message || "Google sign-in failed");
    }
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError("Email and password are required");
      return;
    }
    setLoading(true);
    try {
      await loginWithEmail(email, password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 420, mx: "auto", py: 4 }}>
      <Typography variant="h4" sx={{ fontFamily: '"Crimson Pro", serif', fontWeight: 700, mb: 1, textAlign: "center" }}>
        Welcome back
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", mb: 3 }}>
        Sign in to continue to Epic Woven
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
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
            {error}
          </Alert>
        )}

        <Box sx={{ display: "flex", justifyContent: "center", mb: 2 }}>
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => setError("Google sign-in failed")}
            theme="filled_black"
            shape="pill"
            size="large"
            text="signin_with"
            locale="en"
          />
        </Box>

        <Divider sx={{ my: 2 }}>or</Divider>

        <form onSubmit={handleEmailSubmit}>
          <TextField
            id="login-email"
            label="Email"
            type="email"
            fullWidth
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            margin="normal"
          />
          <TextField
            id="login-password"
            label="Password"
            type={showPassword ? "text" : "password"}
            fullWidth
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            margin="normal"
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    id="login-toggle-password"
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
          <Box sx={{ textAlign: "right", mt: 0.5 }}>
            <Link to="/forgot-password" style={{ color: "var(--mui-palette-primary-main)", fontSize: "0.875rem" }}>
              Forgot password?
            </Link>
          </Box>
          <Button
            id="login-submit"
            type="submit"
            variant="contained"
            fullWidth
            size="large"
            disabled={loading}
            sx={{ mt: 2 }}
          >
            {loading ? "Signing in…" : "Sign in with email"}
          </Button>
        </form>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: "center" }}>
          Don&apos;t have an account?{" "}
          <Link to="/signup" style={{ color: "var(--mui-palette-primary-main)" }}>
            Sign up
          </Link>
        </Typography>
      </Paper>
    </Box>
  );
}
