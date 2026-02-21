import { useState, useEffect, useRef } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Box, Paper, Typography, Button, Alert, CircularProgress } from "@mui/material";
import { CheckCircle, Error as ErrorIcon } from "@mui/icons-material";
import { useAuth } from "../context/AuthContext";

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const { verifyEmail } = useAuth();
  const [status, setStatus] = useState("loading"); // loading | success | error
  const [message, setMessage] = useState("");
  const verifyEmailRef = useRef(verifyEmail);
  const attemptedTokenRef = useRef(null);

  verifyEmailRef.current = verifyEmail;

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Missing verification link.");
      return;
    }
    // Run verification only once per token to avoid re-running when context callbacks change
    if (attemptedTokenRef.current === token) return;
    attemptedTokenRef.current = token;

    let cancelled = false;
    verifyEmailRef.current(token)
      .then(() => {
        if (!cancelled) {
          setStatus("success");
          setMessage("Your email is verified. You can now sign in.");
        }
      })
      .catch((err) => {
        const msg =
          err?.message ||
          err?.error ||
          (typeof err?.data?.error === "string" ? err.data.error : null) ||
          "Verification failed.";
        if (!cancelled) {
          setStatus("error");
          setMessage(msg);
        }
      });
    return () => {
      cancelled = true;
    };
    // Intentionally depend only on token so we don't re-run when verifyEmail identity changes (avoids infinite loop)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <Box sx={{ maxWidth: 420, mx: "auto", py: 4 }}>
      <Paper
        elevation={0}
        sx={{
          p: 3,
          borderRadius: 2,
          bgcolor: "rgba(26, 26, 46, 0.8)",
          border: "1px solid",
          borderColor: "divider",
          textAlign: "center",
        }}
      >
        {status === "loading" && (
          <>
            <CircularProgress sx={{ color: "primary.main", mb: 2 }} />
            <Typography variant="body1">Verifying your email…</Typography>
          </>
        )}
        {status === "success" && (
          <>
            <CheckCircle sx={{ fontSize: 56, color: "success.main", mb: 1 }} />
            <Typography variant="h6" sx={{ mb: 1 }}>
              Email verified
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {message}
            </Typography>
            <Button id="verify-email-sign-in" component={Link} to="/login" variant="contained">
              Sign in
            </Button>
          </>
        )}
        {status === "error" && (
          <>
            <ErrorIcon sx={{ fontSize: 56, color: "error.main", mb: 1 }} />
            <Typography variant="h6" sx={{ mb: 1 }}>
              Verification failed
            </Typography>
            <Alert severity="error" sx={{ mb: 2, textAlign: "left" }}>
              {message}
            </Alert>
            <Button id="verify-email-retry" component={Link} to="/signup" variant="outlined" sx={{ mr: 1 }}>
              Sign up again
            </Button>
            <Button id="verify-email-login" component={Link} to="/login" variant="contained">
              Sign in
            </Button>
          </>
        )}
      </Paper>
    </Box>
  );
}
