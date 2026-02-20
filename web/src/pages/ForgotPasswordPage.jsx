import { useState } from "react";
import { Link } from "react-router-dom";
import { Box, Paper, Typography, TextField, Button, Alert } from "@mui/material";
import { useAuth } from "../context/AuthContext";

export default function ForgotPasswordPage() {
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!email.trim()) {
      setError("Email is required");
      return;
    }
    setLoading(true);
    try {
      const data = await forgotPassword(email);
      setSuccess(data.message || "If an account exists with this email, you will receive a reset link.");
      if (data.resetUrl) setSuccess((s) => s + " Dev link: " + data.resetUrl);
    } catch (err) {
      setError(err.message || "Request failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 420, mx: "auto", py: 4 }}>
      <Typography variant="h4" sx={{ fontFamily: '"Crimson Pro", serif', fontWeight: 700, mb: 1, textAlign: "center" }}>
        Forgot password?
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", mb: 3 }}>
        Enter your email and we&apos;ll send you a link to reset your password
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
            id="forgot-email"
            label="Email"
            type="email"
            fullWidth
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            margin="normal"
          />
          <Button
            id="forgot-submit"
            type="submit"
            variant="contained"
            fullWidth
            size="large"
            disabled={loading}
            sx={{ mt: 3 }}
          >
            {loading ? "Sending…" : "Send reset link"}
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
