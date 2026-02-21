import { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  ToggleButton,
  ToggleButtonGroup,
  CircularProgress,
  Alert,
  Tooltip,
} from "@mui/material";
import { Download, Info } from "@mui/icons-material";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTokens(n) {
  if (n == null || n === 0) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function UsageDashboardPage() {
  const { isPremium, isAuthenticated } = useAuth();
  const [cycle, setCycle] = useState(null);
  const [usage, setUsage] = useState({ entries: [], teamSpend: 0, startDate: "", endDate: "" });
  const [loadingCycle, setLoadingCycle] = useState(true);
  const [loadingUsage, setLoadingUsage] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState("30d");

  const fetchCycle = async () => {
    setLoadingCycle(true);
    setError(null);
    try {
      const res = await api.get("/api/v1/billing/cycle");
      if (res.ok) {
        const data = await res.json();
        setCycle(data);
      }
    } catch (err) {
      setError("Failed to load billing cycle");
      console.error(err);
    } finally {
      setLoadingCycle(false);
    }
  };

  const fetchUsage = async () => {
    setLoadingUsage(true);
    setError(null);
    try {
      const params = new URLSearchParams({ period });
      const res = await api.get(`/api/v1/billing/usage?${params}`);
      if (res.ok) {
        const data = await res.json();
        setUsage(data);
      }
    } catch (err) {
      setError("Failed to load usage");
      console.error(err);
    } finally {
      setLoadingUsage(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) fetchCycle();
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) fetchUsage();
  }, [isAuthenticated, period]);

  const handleExportCSV = async () => {
    try {
      const params = new URLSearchParams({ period });
      const res = await api.get(`/api/v1/billing/usage/export?${params}`);
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `usage-${usage.startDate || "export"}-to-${usage.endDate || "export"}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
    }
  };

  const resetDateFormatted = cycle?.resetDate
    ? new Date(cycle.resetDate + "T00:00:00").toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";

  if (!isAuthenticated) {
    return (
      <Box sx={{ py: 4, textAlign: "center" }}>
        <Typography color="text.secondary">Sign in to view usage.</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 3,
        }}
      >
        <Typography variant="h4" sx={{ fontFamily: '"Crimson Pro", serif' }}>
          Usage Dashboard
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Billing cycle cards */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
          gap: 2,
          mb: 3,
        }}
      >
        <Paper
          sx={{
            p: 2,
            bgcolor: "rgba(255,255,255,0.04)",
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Your included usage
          </Typography>
          {loadingCycle ? (
            <CircularProgress size={24} />
          ) : (
            <>
              <Typography variant="h5">
                ${cycle?.usedIncludedUsd ?? 0} / ${cycle?.includedLimitUsd ?? 20}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                Resets {resetDateFormatted}
              </Typography>
            </>
          )}
        </Paper>
        <Paper
          sx={{
            p: 2,
            bgcolor: "rgba(255,255,255,0.04)",
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            On-Demand Usage
          </Typography>
          {loadingCycle ? (
            <CircularProgress size={24} />
          ) : (
            <>
              <Typography variant="h5">${cycle?.onDemandUsd ?? 0}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                Pay for extra usage beyond your plan limits.
              </Typography>
              {usage.teamSpend != null && usage.teamSpend > 0 && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                  ${usage.teamSpend.toFixed(2)} team spend
                </Typography>
              )}
            </>
          )}
        </Paper>
      </Box>

      {/* Date range + Export */}
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 2,
          mb: 2,
        }}
      >
        <Typography variant="body2" color="text.secondary">
          {usage.startDate && usage.endDate
            ? `${usage.startDate} – ${usage.endDate}`
            : "Select period"}
        </Typography>
        <ToggleButtonGroup
          value={period}
          exclusive
          onChange={(_, v) => v != null && setPeriod(v)}
          size="small"
          sx={{
            "& .MuiToggleButton-root": {
              py: 0.5,
              px: 1.5,
              fontSize: "0.75rem",
            },
          }}
        >
          <ToggleButton value="1d">1d</ToggleButton>
          <ToggleButton value="7d">7d</ToggleButton>
          <ToggleButton value="30d">30d</ToggleButton>
        </ToggleButtonGroup>
        <Button
          variant="outlined"
          size="small"
          startIcon={<Download />}
          onClick={handleExportCSV}
          disabled={loadingUsage || !usage.entries?.length}
        >
          Export CSV
        </Button>
      </Box>

      {/* Usage table */}
      <Paper
        sx={{
          overflow: "hidden",
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        <TableContainer sx={{ maxHeight: 520 }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>User</TableCell>
                <TableCell>
                  Type
                  <Tooltip title="Free: no cost. Included: counts toward your plan allowance.">
                    <Info sx={{ fontSize: 14, verticalAlign: "middle", ml: 0.5, opacity: 0.7 }} />
                  </Tooltip>
                </TableCell>
                <TableCell>Model</TableCell>
                <TableCell align="right">Tokens</TableCell>
                <TableCell align="right">Cost</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loadingUsage ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <CircularProgress size={24} />
                  </TableCell>
                </TableRow>
              ) : !usage.entries?.length ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">No usage in this period</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                usage.entries.map((row, idx) => (
                  <TableRow key={idx} hover>
                    <TableCell sx={{ whiteSpace: "nowrap", fontSize: "0.8rem" }}>
                      {formatDate(row.date)}
                    </TableCell>
                    <TableCell sx={{ fontSize: "0.8rem" }}>{row.userEmail}</TableCell>
                    <TableCell sx={{ fontSize: "0.8rem" }}>{row.type}</TableCell>
                    <TableCell sx={{ fontSize: "0.8rem" }}>{row.model}</TableCell>
                    <TableCell align="right" sx={{ fontSize: "0.8rem" }}>
                      {formatTokens(row.tokens)}
                    </TableCell>
                    <TableCell align="right" sx={{ fontSize: "0.8rem" }}>
                      {row.type === "Free" ? "—" : `$${(row.cost || 0).toFixed(2)}`}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}
