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
  TablePagination,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Grid,
  Card,
  CardContent,
  Collapse,
  Tooltip,
  CircularProgress,
  Alert,
} from "@mui/material";
import {
  Visibility,
  ExpandMore,
  ExpandLess,
  Refresh,
  FilterList,
  Timeline,
  Token,
  Timer,
  Error as ErrorIcon,
  CheckCircle,
} from "@mui/icons-material";
import api from "../services/api";

function PromptLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState([]);

  // Filters
  const [providerFilter, setProviderFilter] = useState("");
  const [modelFilter, setModelFilter] = useState("");
  const [requestTypeFilter, setRequestTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Detail dialog
  const [selectedLog, setSelectedLog] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        limit: rowsPerPage,
        offset: page * rowsPerPage,
      });

      if (providerFilter) params.append("provider", providerFilter);
      if (modelFilter) params.append("model", modelFilter);
      if (requestTypeFilter) params.append("requestType", requestTypeFilter);
      if (statusFilter) params.append("status", statusFilter);

      const response = await api.get(`/api/prompts?${params}`);
      const data = await response.json();

      if (data.logs) {
        setLogs(data.logs);
        // Estimate total count based on returned data
        setTotalCount(
          data.logs.length < rowsPerPage
            ? page * rowsPerPage + data.logs.length
            : (page + 2) * rowsPerPage
        );
      }
    } catch (err) {
      setError("Failed to fetch prompt logs");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get("/api/prompts/stats");
      const data = await response.json();
      if (data.stats) {
        setStats(data.stats);
      }
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    }
  };

  useEffect(() => {
    fetchLogs();
    fetchStats();
  }, [
    page,
    rowsPerPage,
    providerFilter,
    modelFilter,
    requestTypeFilter,
    statusFilter,
  ]);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleViewDetail = (log) => {
    setSelectedLog(log);
    setDetailOpen(true);
  };

  const handleCloseDetail = () => {
    setDetailOpen(false);
    setSelectedLog(null);
  };

  const clearFilters = () => {
    setProviderFilter("");
    setModelFilter("");
    setRequestTypeFilter("");
    setStatusFilter("");
    setPage(0);
  };

  const formatDuration = (ms) => {
    if (!ms) return "-";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  const truncateText = (text, maxLength = 100) => {
    if (!text) return "-";
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "success":
        return "success";
      case "error":
        return "error";
      case "initiated":
        return "info";
      default:
        return "default";
    }
  };

  const getRequestTypeColor = (type) => {
    switch (type) {
      case "completion":
        return "#4caf50";
      case "json":
        return "#2196f3";
      case "image":
        return "#ff9800";
      case "image_edit":
      case "image_edit_pre":
        return "#e91e63";
      case "vision":
        return "#9c27b0";
      default:
        return "#757575";
    }
  };

  // Calculate summary stats
  const totalRequests = stats.reduce(
    (sum, s) => sum + (s.total_requests || 0),
    0
  );
  const totalTokens = stats.reduce(
    (sum, s) => sum + (s.total_tokens_total || 0),
    0
  );
  const totalErrors = stats.reduce((sum, s) => sum + (s.error_count || 0), 0);
  const avgDuration =
    stats.length > 0
      ? stats.reduce((sum, s) => sum + (s.avg_duration_ms || 0), 0) /
        stats.length
      : 0;

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
          AI Prompt Logs
        </Typography>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button
            startIcon={<FilterList />}
            onClick={() => setShowFilters(!showFilters)}
            variant={showFilters ? "contained" : "outlined"}
            size="small"
          >
            Filters
          </Button>
          <IconButton onClick={fetchLogs} color="primary">
            <Refresh />
          </IconButton>
        </Box>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={3}>
          <Card
            sx={{
              bgcolor: "rgba(33, 150, 243, 0.1)",
              border: "1px solid rgba(33, 150, 243, 0.3)",
            }}
          >
            <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Timeline sx={{ color: "#2196f3" }} />
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Total Requests
                  </Typography>
                  <Typography variant="h6">
                    {totalRequests.toLocaleString()}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card
            sx={{
              bgcolor: "rgba(76, 175, 80, 0.1)",
              border: "1px solid rgba(76, 175, 80, 0.3)",
            }}
          >
            <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Token sx={{ color: "#4caf50" }} />
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Total Tokens
                  </Typography>
                  <Typography variant="h6">
                    {totalTokens.toLocaleString()}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card
            sx={{
              bgcolor: "rgba(255, 152, 0, 0.1)",
              border: "1px solid rgba(255, 152, 0, 0.3)",
            }}
          >
            <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Timer sx={{ color: "#ff9800" }} />
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Avg Duration
                  </Typography>
                  <Typography variant="h6">
                    {formatDuration(avgDuration)}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card
            sx={{
              bgcolor: "rgba(244, 67, 54, 0.1)",
              border: "1px solid rgba(244, 67, 54, 0.3)",
            }}
          >
            <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <ErrorIcon sx={{ color: "#f44336" }} />
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Errors
                  </Typography>
                  <Typography variant="h6">
                    {totalErrors.toLocaleString()}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filters */}
      <Collapse in={showFilters}>
        <Paper sx={{ p: 2, mb: 2, bgcolor: "rgba(255,255,255,0.02)" }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Provider</InputLabel>
                <Select
                  value={providerFilter}
                  label="Provider"
                  onChange={(e) => setProviderFilter(e.target.value)}
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="openai">OpenAI</MenuItem>
                  <MenuItem value="gemini">Gemini</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                size="small"
                label="Model"
                value={modelFilter}
                onChange={(e) => setModelFilter(e.target.value)}
                placeholder="e.g., gpt-4o"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Request Type</InputLabel>
                <Select
                  value={requestTypeFilter}
                  label="Request Type"
                  onChange={(e) => setRequestTypeFilter(e.target.value)}
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="completion">Completion</MenuItem>
                  <MenuItem value="json">JSON</MenuItem>
                  <MenuItem value="image">Image</MenuItem>
                  <MenuItem value="image_edit">Image Edit</MenuItem>
                  <MenuItem value="vision">Vision</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select
                  value={statusFilter}
                  label="Status"
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="success">Success</MenuItem>
                  <MenuItem value="error">Error</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Button variant="outlined" onClick={clearFilters} fullWidth>
                Clear Filters
              </Button>
            </Grid>
          </Grid>
        </Paper>
      </Collapse>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Logs Table */}
      <Paper sx={{ width: "100%", overflow: "hidden" }}>
        <TableContainer sx={{ maxHeight: 600 }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell>Time</TableCell>
                <TableCell>Provider</TableCell>
                <TableCell>Model</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Tokens</TableCell>
                <TableCell align="right">Duration</TableCell>
                <TableCell>Prompt</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                    <CircularProgress size={24} />
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">
                      No prompt logs found
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id} hover>
                    <TableCell
                      sx={{ whiteSpace: "nowrap", fontSize: "0.75rem" }}
                    >
                      {formatDate(log.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={log.provider}
                        size="small"
                        sx={{
                          bgcolor:
                            log.provider === "openai"
                              ? "rgba(16, 163, 127, 0.2)"
                              : "rgba(66, 133, 244, 0.2)",
                          color:
                            log.provider === "openai" ? "#10a37f" : "#4285f4",
                          fontSize: "0.7rem",
                        }}
                      />
                    </TableCell>
                    <TableCell sx={{ fontSize: "0.75rem" }}>
                      {log.model}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={log.requestType}
                        size="small"
                        sx={{
                          bgcolor: `${getRequestTypeColor(log.requestType)}20`,
                          color: getRequestTypeColor(log.requestType),
                          fontSize: "0.7rem",
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        icon={
                          log.status === "success" ? (
                            <CheckCircle sx={{ fontSize: 14 }} />
                          ) : (
                            <ErrorIcon sx={{ fontSize: 14 }} />
                          )
                        }
                        label={log.status}
                        size="small"
                        color={getStatusColor(log.status)}
                        sx={{ fontSize: "0.7rem" }}
                      />
                    </TableCell>
                    <TableCell align="right" sx={{ fontSize: "0.75rem" }}>
                      {log.tokensTotal?.toLocaleString() || "-"}
                    </TableCell>
                    <TableCell align="right" sx={{ fontSize: "0.75rem" }}>
                      {formatDuration(log.durationMs)}
                    </TableCell>
                    <TableCell sx={{ maxWidth: 300, fontSize: "0.75rem" }}>
                      <Tooltip
                        title={
                          log.promptText ||
                          (log.promptMessages ? "Click to view" : "-")
                        }
                      >
                        <Typography
                          variant="body2"
                          sx={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            fontSize: "0.75rem",
                          }}
                        >
                          {truncateText(
                            log.promptText ||
                              (log.promptMessages ? "[Messages]" : "-"),
                            50
                          )}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        onClick={() => handleViewDetail(log)}
                      >
                        <Visibility fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[10, 25, 50, 100]}
          component="div"
          count={totalCount}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>

      {/* Detail Dialog */}
      <Dialog
        open={detailOpen}
        onClose={handleCloseDetail}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { bgcolor: "background.paper" },
        }}
      >
        <DialogTitle>
          Prompt Log Details
          {selectedLog && (
            <Chip
              label={selectedLog.status}
              size="small"
              color={getStatusColor(selectedLog.status)}
              sx={{ ml: 2 }}
            />
          )}
        </DialogTitle>
        <DialogContent dividers>
          {selectedLog && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {/* Metadata */}
              <Grid container spacing={2}>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">
                    Provider
                  </Typography>
                  <Typography>{selectedLog.provider}</Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">
                    Model
                  </Typography>
                  <Typography>{selectedLog.model}</Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">
                    Request Type
                  </Typography>
                  <Typography>{selectedLog.requestType}</Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">
                    Duration
                  </Typography>
                  <Typography>
                    {formatDuration(selectedLog.durationMs)}
                  </Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">
                    Input Tokens
                  </Typography>
                  <Typography>
                    {selectedLog.tokensInput?.toLocaleString() || "-"}
                  </Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">
                    Output Tokens
                  </Typography>
                  <Typography>
                    {selectedLog.tokensOutput?.toLocaleString() || "-"}
                  </Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">
                    Total Tokens
                  </Typography>
                  <Typography>
                    {selectedLog.tokensTotal?.toLocaleString() || "-"}
                  </Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">
                    Created
                  </Typography>
                  <Typography sx={{ fontSize: "0.875rem" }}>
                    {formatDate(selectedLog.createdAt)}
                  </Typography>
                </Grid>
              </Grid>

              {/* Error Message */}
              {selectedLog.errorMessage && (
                <Box>
                  <Typography variant="subtitle2" color="error" gutterBottom>
                    Error Message
                  </Typography>
                  <Paper sx={{ p: 2, bgcolor: "rgba(244, 67, 54, 0.1)" }}>
                    <Typography
                      variant="body2"
                      sx={{ fontFamily: "monospace", whiteSpace: "pre-wrap" }}
                    >
                      {selectedLog.errorMessage}
                    </Typography>
                  </Paper>
                </Box>
              )}

              {/* Prompt Text */}
              {selectedLog.promptText && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Prompt
                  </Typography>
                  <Paper
                    sx={{
                      p: 2,
                      bgcolor: "rgba(255,255,255,0.02)",
                      maxHeight: 200,
                      overflow: "auto",
                    }}
                  >
                    <Typography
                      variant="body2"
                      sx={{
                        fontFamily: "monospace",
                        whiteSpace: "pre-wrap",
                        fontSize: "0.75rem",
                      }}
                    >
                      {selectedLog.promptText}
                    </Typography>
                  </Paper>
                </Box>
              )}

              {/* Prompt Messages */}
              {selectedLog.promptMessages && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Messages
                  </Typography>
                  <Paper
                    sx={{
                      p: 2,
                      bgcolor: "rgba(255,255,255,0.02)",
                      maxHeight: 300,
                      overflow: "auto",
                    }}
                  >
                    {selectedLog.promptMessages.map((msg, idx) => (
                      <Box key={idx} sx={{ mb: 2 }}>
                        <Chip
                          label={msg.role}
                          size="small"
                          sx={{
                            mb: 0.5,
                            bgcolor:
                              msg.role === "system"
                                ? "rgba(156, 39, 176, 0.2)"
                                : msg.role === "user"
                                  ? "rgba(33, 150, 243, 0.2)"
                                  : "rgba(76, 175, 80, 0.2)",
                            color:
                              msg.role === "system"
                                ? "#9c27b0"
                                : msg.role === "user"
                                  ? "#2196f3"
                                  : "#4caf50",
                          }}
                        />
                        <Typography
                          variant="body2"
                          sx={{
                            fontFamily: "monospace",
                            whiteSpace: "pre-wrap",
                            fontSize: "0.75rem",
                            pl: 1,
                          }}
                        >
                          {typeof msg.content === "string"
                            ? msg.content
                            : JSON.stringify(msg.content, null, 2)}
                        </Typography>
                      </Box>
                    ))}
                  </Paper>
                </Box>
              )}

              {/* Response */}
              {selectedLog.responseText &&
                !selectedLog.responseText.startsWith("[") && (
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Response
                    </Typography>
                    <Paper
                      sx={{
                        p: 2,
                        bgcolor: "rgba(255,255,255,0.02)",
                        maxHeight: 200,
                        overflow: "auto",
                      }}
                    >
                      <Typography
                        variant="body2"
                        sx={{
                          fontFamily: "monospace",
                          whiteSpace: "pre-wrap",
                          fontSize: "0.75rem",
                        }}
                      >
                        {selectedLog.responseText}
                      </Typography>
                    </Paper>
                  </Box>
                )}

              {/* Metadata */}
              {selectedLog.metadata && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Metadata
                  </Typography>
                  <Paper sx={{ p: 2, bgcolor: "rgba(255,255,255,0.02)" }}>
                    <Typography
                      variant="body2"
                      sx={{
                        fontFamily: "monospace",
                        whiteSpace: "pre-wrap",
                        fontSize: "0.75rem",
                      }}
                    >
                      {JSON.stringify(selectedLog.metadata, null, 2)}
                    </Typography>
                  </Paper>
                </Box>
              )}

              {/* Job/Story IDs */}
              {(selectedLog.jobId || selectedLog.storyId) && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Related
                  </Typography>
                  <Box sx={{ display: "flex", gap: 2 }}>
                    {selectedLog.jobId && (
                      <Chip
                        label={`Job: ${selectedLog.jobId}`}
                        size="small"
                        variant="outlined"
                      />
                    )}
                    {selectedLog.storyId && (
                      <Chip
                        label={`Story: ${selectedLog.storyId}`}
                        size="small"
                        variant="outlined"
                      />
                    )}
                  </Box>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDetail}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default PromptLogsPage;
