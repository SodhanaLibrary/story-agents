import { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Paper,
  Button,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import { Check, Star } from "@mui/icons-material";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

const RAZORPAY_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";

function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(window.Razorpay);
      return;
    }
    const script = document.createElement("script");
    script.src = RAZORPAY_SCRIPT;
    script.async = true;
    script.onload = () => resolve(window.Razorpay);
    script.onerror = () => resolve(null);
    document.body.appendChild(script);
  });
}

export default function PricingPage() {
  const { isAuthenticated, isPro, refreshUser } = useAuth();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [payLoading, setPayLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    api
      .get("/api/v1/plans/status")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setStatus(data);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load plan status");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [isAuthenticated]);

  const handleUpgrade = async () => {
    setError(null);
    setSuccess(null);
    setPayLoading(true);
    try {
      const orderRes = await api.post("/api/v1/razorpay/create-order");
      if (!orderRes.ok) {
        const err = await orderRes.json().catch(() => ({}));
        throw new Error(err.error || "Failed to create order");
      }
      const { orderId, amount, currency, keyId } = await orderRes.json();

      const Razorpay = await loadRazorpayScript();
      if (!Razorpay) {
        throw new Error("Could not load Razorpay checkout");
      }

      const options = {
        order_id: orderId,
        amount,
        currency,
        name: "Epic Woven",
        description: "Pro plan (monthly) — unlimited AI usage",
        handler: async (response) => {
          try {
            const verifyRes = await api.post("/api/v1/razorpay/verify", {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            if (!verifyRes.ok) {
              const err = await verifyRes.json().catch(() => ({}));
              setError(err.error || "Payment verification failed");
              return;
            }
            await refreshUser();
            setStatus((s) => (s ? { ...s, plan: "pro", upgradeRequired: false } : s));
            setSuccess("You're now on Pro! Enjoy unlimited usage.");
          } catch (e) {
            setError(e.message || "Verification failed");
          } finally {
            setPayLoading(false);
          }
        },
        modal: {
          ondismiss: () => setPayLoading(false),
        },
      };

      const rzp = new Razorpay({ key: keyId });
      rzp.on("payment.failed", () => {
        setError("Payment failed or was cancelled.");
        setPayLoading(false);
      });
      rzp.open(options);
    } catch (e) {
      setError(e.message || "Something went wrong");
      setPayLoading(false);
    }
  };

  const formatTokens = (n) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
  };

  const proPrice =
    status?.proCurrency === "USD"
      ? `$${(status.proPriceCents / 100).toFixed(0)}`
      : status?.proCurrency === "INR"
        ? `₹${(status.proPriceCents / 100).toFixed(0)}`
        : `${(status?.proPriceCents ?? 1900) / 100}`;

  return (
    <Box sx={{ py: 4, maxWidth: 720, mx: "auto" }}>
      <Typography
        variant="h4"
        sx={{ fontFamily: '"Crimson Pro", serif', mb: 1, textAlign: "center" }}
      >
        Plans
      </Typography>
      <Typography color="text.secondary" sx={{ textAlign: "center", mb: 3 }}>
        Free: 1M tokens once. Pro: unlimited, monthly. Team: create an org and add members for shared usage.
      </Typography>

      {!isAuthenticated && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Sign in to see your usage and upgrade to Pro.
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, gap: 2 }}>
        {/* Free plan */}
        <Card
          sx={{
            flex: 1,
            border: "1px solid",
            borderColor: "divider",
            bgcolor: "rgba(255,255,255,0.03)",
          }}
        >
          <CardContent sx={{ py: 3 }}>
            <Typography variant="h6" gutterBottom>
              Free
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
              $0
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              1 million tokens total (one-time)
            </Typography>
            {isAuthenticated && status && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Used: {formatTokens(status.freeTokensUsed)} / {formatTokens(status.freeTokensLimit)}
              </Typography>
            )}
            <List dense disablePadding>
              <ListItem disablePadding sx={{ mb: 0.5 }}>
                <ListItemIcon sx={{ minWidth: 28 }}>
                  <Check color="primary" fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="1M tokens once" />
              </ListItem>
              <ListItem disablePadding>
                <ListItemIcon sx={{ minWidth: 28 }}>
                  <Check color="primary" fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="Create stories & avatars" />
              </ListItem>
            </List>
          </CardContent>
        </Card>

        {/* Pro plan */}
        <Card
          sx={{
            flex: 1,
            border: "2px solid",
            borderColor: "primary.main",
            bgcolor: "rgba(232, 184, 109, 0.06)",
          }}
        >
          <CardContent sx={{ py: 3 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
              <Typography variant="h6">Pro</Typography>
              <Star sx={{ color: "primary.main", fontSize: 18 }} />
            </Box>
            <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
              {loading ? "—" : proPrice}/month
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Unlimited AI usage (monthly)
            </Typography>
            <List dense disablePadding sx={{ mb: 2 }}>
              <ListItem disablePadding sx={{ mb: 0.5 }}>
                <ListItemIcon sx={{ minWidth: 28 }}>
                  <Check color="primary" fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="Unlimited tokens" />
              </ListItem>
              <ListItem disablePadding sx={{ mb: 0.5 }}>
                <ListItemIcon sx={{ minWidth: 28 }}>
                  <Check color="primary" fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="All story & avatar features" />
              </ListItem>
              <ListItem disablePadding>
                <ListItemIcon sx={{ minWidth: 28 }}>
                  <Check color="primary" fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="Billed monthly via Razorpay" />
              </ListItem>
            </List>
            {isPro ? (
              <Button id="btn-pricing-current-plan" variant="contained" disabled fullWidth>
                Current plan
              </Button>
            ) : (
              <Button
                id="btn-pricing-upgrade"
                variant="contained"
                fullWidth
                disabled={!isAuthenticated || payLoading}
                onClick={handleUpgrade}
              >
                {payLoading ? <CircularProgress size={24} color="inherit" /> : "Upgrade to Pro"}
              </Button>
            )}
          </CardContent>
        </Card>
      </Box>

      <Typography variant="caption" display="block" sx={{ mt: 2, textAlign: "center", color: "text.secondary" }}>
        Payments powered by Razorpay. Payouts to your bank can be configured in your Razorpay dashboard.
      </Typography>
    </Box>
  );
}
