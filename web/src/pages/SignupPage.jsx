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
} from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import { useAuth } from "../context/AuthContext";

export default function SignupPage() {
  const navigate = useNavigate();
  const { signup, isAuthenticated } = useAuth();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    navigate("/", { replace: true });
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!email.trim()) {
      setError("Email is required");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    try {
      const data = await signup(email, name, password);
      setSuccess(data.message || "Account created. Please check your email to verify.");
      if (data.verifyUrl) setSuccess((s) => s + " Dev link: " + data.verifyUrl);
    } catch (err) {
      setError(err.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 420, mx: "auto", py: 4 }}>
      <Typography variant="h4" sx={{ fontFamily: '"Crimson Pro", serif', fontWeight: 700, mb: 1, textAlign: "center" }}>
        Create account
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", mb: 3 }}>
        Sign up with email to start creating stories
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
          {success && (
            <Alert severity="success" sx={{ mb: 2 }}>
              {success}
            </Alert>
          )}
          <TextField
            id="signup-email"
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
            id="signup-name"
            label="Name (optional)"
            fullWidth
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            margin="normal"
          />
          <TextField
            id="signup-password"
            label="Password"
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
                    id="signup-toggle-password"
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
          <Button
            id="signup-submit"
            type="submit"
            variant="contained"
            fullWidth
            size="large"
            disabled={loading}
            sx={{ mt: 3 }}
          >
            {loading ? "Creating account…" : "Sign up"}
          </Button>
        </form>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: "center" }}>
          Already have an account?{" "}
          <Link to="/login" style={{ color: "var(--mui-palette-primary-main)" }}>
            Log in
          </Link>
        </Typography>
      </Paper>
    </Box>
  );
}
