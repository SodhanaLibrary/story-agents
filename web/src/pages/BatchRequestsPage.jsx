import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  LinearProgress,
  Stack,
} from "@mui/material";
import {
  ArrowBack,
  Refresh,
  Cancel,
  CheckCircle,
  Error as ErrorIcon,
  HourglassEmpty,
  PlayCircle,
} from "@mui/icons-material";
import { useAuth } from "../context/AuthContext";

const statusConfig = {
  pending: { color: "warning", icon: HourglassEmpty, label: "Pending" },
  processing: { color: "info", icon: PlayCircle, label: "Processing" },
  completed: { color: "success", icon: CheckCircle, label: "Completed" },
  failed: { color: "error", icon: ErrorIcon, label: "Failed" },
  cancelled: { color: "default", icon: Cancel, label: "Cancelled" },
};

function BatchRequestsPage() {
  const navigate = useNavigate();
  const { userId } = useAuth();
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cancelling, setCancelling] = useState(null);

  const fetchBatches = async () => {
    if (!userId) return;

    try {
      const response = await fetch("/api/batch/list", {
        headers: { "X-User-Id": userId },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch batch requests");
      }

      const data = await response.json();
      setBatches(data.batches || []);
    } catch (err) {
      console.error("Error fetching batches:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
    // Poll for updates every 5 seconds
    const interval = setInterval(fetchBatches, 5000);
    return () => clearInterval(interval);
  }, [userId]);

  const handleCancel = async (batchId) => {
    setCancelling(batchId);
    try {
      const response = await fetch(`/api/batch/${batchId}/cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": userId,
        },
      });

      if (response.ok) {
        fetchBatches();
      } else {
        const data = await response.json();
        setError(data.error || "Failed to cancel batch");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setCancelling(null);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleString();
  };

  const getProgress = (batch) => {
    if (batch.total_pages === 0) return 0;
    return Math.round((batch.completed_pages / batch.total_pages) * 100);
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box className="fade-in">
      <Button
        startIcon={<ArrowBack />}
        onClick={() => navigate("/")}
        sx={{ mb: 2, color: "text.secondary" }}
      >
        Back to Library
      </Button>

      <Box sx={{ textAlign: "center", mb: 4 }}>
        <Typography variant="h2" sx={{ mb: 2, color: "primary.main" }}>
          Batch Requests
        </Typography>
        <Typography variant="body1" sx={{ color: "text.secondary", maxWidth: 600, mx: "auto" }}>
          View and manage your batch illustration generation requests.
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={fetchBatches}
          disabled={loading}
        >
          Refresh
        </Button>
      </Box>

      {batches.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: "center", py: 6 }}>
            <Typography variant="h6" sx={{ color: "text.secondary", mb: 2 }}>
              No batch requests yet
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              When you generate all illustrations for a story, they will appear here.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <TableContainer component={Paper} sx={{ bgcolor: "rgba(0,0,0,0.2)" }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Story</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Progress</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Completed</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {batches.map((batch) => {
                const status = statusConfig[batch.status] || statusConfig.pending;
                const StatusIcon = status.icon;
                const progress = getProgress(batch);

                return (
                  <TableRow key={batch.id}>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {batch.story_title || "Untitled"}
                      </Typography>
                      <Typography variant="caption" sx={{ color: "text.secondary" }}>
                        ID: {batch.job_id}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        icon={<StatusIcon fontSize="small" />}
                        label={status.label}
                        color={status.color}
                        size="small"
                      />
                      {batch.error_message && (
                        <Tooltip title={batch.error_message}>
                          <Typography
                            variant="caption"
                            sx={{ display: "block", color: "error.main", mt: 0.5 }}
                          >
                            {batch.error_message.substring(0, 30)}...
                          </Typography>
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell>
                      <Stack spacing={0.5}>
                        <Typography variant="caption">
                          {batch.completed_pages} / {batch.total_pages} pages
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={progress}
                          sx={{ width: 100, height: 6, borderRadius: 3 }}
                        />
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">
                        {formatDate(batch.created_at)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">
                        {formatDate(batch.completed_at)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      {(batch.status === "pending" || batch.status === "processing") && (
                        <Tooltip title="Cancel">
                          <IconButton
                            size="small"
                            onClick={() => handleCancel(batch.id)}
                            disabled={cancelling === batch.id}
                            sx={{ color: "error.main" }}
                          >
                            {cancelling === batch.id ? (
                              <CircularProgress size={16} />
                            ) : (
                              <Cancel />
                            )}
                          </IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}

export default BatchRequestsPage;

