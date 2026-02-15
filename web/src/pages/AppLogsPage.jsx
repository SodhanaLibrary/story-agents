import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
  Stack,
} from "@mui/material";
import {
  Visibility,
  Refresh,
  FilterList,
  ArrowBack,
  Info,
  Warning,
  Error as ErrorIcon,
  BugReport,
  CheckCircle,
  DeleteSweep,
  Search,
} from "@mui/icons-material";
import api from "../services/api";

function AppLogsPage() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState([]);

  // Filters
  const [levelFilter, setLevelFilter] = useState("");
  const [contextFilter, setContextFilter] = useState("");
  const [searchFilter, setSearchFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Detail dialog
  const [selectedLog, setSelectedLog] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Clear logs dialog
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [clearDays, setClearDays] = useState(7);
  const [clearing, setClearing] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        limit: rowsPerPage,
        offset: page * rowsPerPage,
      });

      if (levelFilter) params.append("level", levelFilter);
      if (contextFilter) params.append("context", contextFilter);
      if (searchFilter) params.append("search", searchFilter);

      const response = await api.get(`/api/app-logs?${params}`);
      const data = await response.json();

      if (data.logs) {
        setLogs(data.logs);
        setTotalCount(
          data.logs.length < rowsPerPage
            ? page * rowsPerPage + data.logs.length
            : (page + 2) * rowsPerPage
        );
      }
    } catch (err) {
      setError("Failed to fetch application logs");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get("/api/app-logs/stats");
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
  }, [page, rowsPerPage, levelFilter, contextFilter, searchFilter]);

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
    setLevelFilter("");
    setContextFilter("");
    setSearchFilter("");
    setPage(0);
  };

  const handleClearLogs = async () => {
    setClearing(true);
    try {
      const response = await api.delete(`/api/app-logs/clear?daysOld=${clearDays}`);
      const data = await response.json();
      if (data.success) {
        setClearDialogOpen(false);
        fetchLogs();
        fetchStats();
      }
    } catch (err) {
      console.error("Failed to clear logs:", err);
    } finally {
      setClearing(false);
    }
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

  const getLevelIcon = (level) => {
    switch (level) {
      case "debug":
        return <BugReport sx={{ fontSize: 16, color: "#9c27b0" }} />;
      case "info":
        return <Info sx={{ fontSize: 16, color: "#2196f3" }} />;
      case "warn":
        return <Warning sx={{ fontSize: 16, color: "#ff9800" }} />;
      case "error":
        return <ErrorIcon sx={{ fontSize: 16, color: "#f44336" }} />;
      case "success":
        return <CheckCircle sx={{ fontSize: 16, color: "#4caf50" }} />;
      default:
        return <Info sx={{ fontSize: 16 }} />;
    }
  };

  const getLevelColor = (level) => {
    switch (level) {
      case "debug":
        return { bg: "rgba(156, 39, 176, 0.2)", color: "#9c27b0" };
      case "info":
        return { bg: "rgba(33, 150, 243, 0.2)", color: "#2196f3" };
      case "warn":
        return { bg: "rgba(255, 152, 0, 0.2)", color: "#ff9800" };
      case "error":
        return { bg: "rgba(244, 67, 54, 0.2)", color: "#f44336" };
      case "success":
        return { bg: "rgba(76, 175, 80, 0.2)", color: "#4caf50" };
      default:
        return { bg: "rgba(158, 158, 158, 0.2)", color: "#9e9e9e" };
    }
  };

  // Calculate summary stats by level
  const logsByLevel = stats.reduce((acc, s) => {
    const level = s.level || "unknown";
    acc[level] = (acc[level] || 0) + (s.count || 0);
    return acc;
  }, {});

  const totalLogs = Object.values(logsByLevel).reduce((sum, count) => sum + count, 0);

  return (
    <Box>
      <Button
        id="btn-back-to-library"
        startIcon={<ArrowBack />}
        onClick={() => navigate("/")}
        sx={{ mb: 2, color: "text.secondary" }}
      >
        Back to Library
      </Button>

      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 3,
          flexWrap: "wrap",
          gap: 2,
        }}
      >
        <Typography variant="h4" sx={{ fontFamily: '"Crimson Pro", serif' }}>
          Server Logs
        </Typography>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button
            id="btn-clear-old-logs"
            startIcon={<DeleteSweep />}
            onClick={() => setClearDialogOpen(true)}
            variant="outlined"
            color="warning"
            size="small"
          >
            Clear Old
          </Button>
          <Button
            id="btn-toggle-filters"
            startIcon={<FilterList />}
            onClick={() => setShowFilters(!showFilters)}
            variant={showFilters ? "contained" : "outlined"}
            size="small"
          >
            Filters
          </Button>
          <IconButton id="btn-refresh-logs" onClick={fetchLogs} color="primary">
            <Refresh />
          </IconButton>
        </Box>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={2.4}>
          <Card
            sx={{
              bgcolor: "rgba(33, 150, 243, 0.1)",
              border: "1px solid rgba(33, 150, 243, 0.3)",
            }}
          >
            <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Info sx={{ color: "#2196f3" }} />
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Info
                  </Typography>
                  <Typography variant="h6">
                    {(logsByLevel.info || 0).toLocaleString()}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={2.4}>
          <Card
            sx={{
              bgcolor: "rgba(76, 175, 80, 0.1)",
              border: "1px solid rgba(76, 175, 80, 0.3)",
            }}
          >
            <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <CheckCircle sx={{ color: "#4caf50" }} />
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Success
                  </Typography>
                  <Typography variant="h6">
                    {(logsByLevel.success || 0).toLocaleString()}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={2.4}>
          <Card
            sx={{
              bgcolor: "rgba(255, 152, 0, 0.1)",
              border: "1px solid rgba(255, 152, 0, 0.3)",
            }}
          >
            <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Warning sx={{ color: "#ff9800" }} />
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Warnings
                  </Typography>
                  <Typography variant="h6">
                    {(logsByLevel.warn || 0).toLocaleString()}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={2.4}>
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
                    {(logsByLevel.error || 0).toLocaleString()}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={2.4}>
          <Card
            sx={{
              bgcolor: "rgba(156, 39, 176, 0.1)",
              border: "1px solid rgba(156, 39, 176, 0.3)",
            }}
          >
            <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <BugReport sx={{ color: "#9c27b0" }} />
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Debug
                  </Typography>
                  <Typography variant="h6">
                    {(logsByLevel.debug || 0).toLocaleString()}
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
                <InputLabel>Level</InputLabel>
                <Select
                  id="filter-level"
                  value={levelFilter}
                  label="Level"
                  onChange={(e) => setLevelFilter(e.target.value)}
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="debug">Debug</MenuItem>
                  <MenuItem value="info">Info</MenuItem>
                  <MenuItem value="success">Success</MenuItem>
                  <MenuItem value="warn">Warning</MenuItem>
                  <MenuItem value="error">Error</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                id="filter-context"
                fullWidth
                size="small"
                label="Context"
                value={contextFilter}
                onChange={(e) => setContextFilter(e.target.value)}
                placeholder="e.g., Server, HTTP"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                id="filter-search"
                fullWidth
                size="small"
                label="Search"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Search in message or details..."
                InputProps={{
                  startAdornment: <Search sx={{ mr: 1, color: "text.secondary" }} />,
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Button
                id="btn-clear-filters"
                variant="outlined"
                onClick={clearFilters}
                fullWidth
              >
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
                <TableCell>Level</TableCell>
                <TableCell>Context</TableCell>
                <TableCell>Message</TableCell>
                <TableCell>Job ID</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <CircularProgress size={24} />
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">
                      No logs found
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => {
                  const levelStyle = getLevelColor(log.level);
                  return (
                    <TableRow key={log.id} hover>
                      <TableCell
                        sx={{ whiteSpace: "nowrap", fontSize: "0.75rem" }}
                      >
                        {formatDate(log.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Chip
                          icon={getLevelIcon(log.level)}
                          label={log.level}
                          size="small"
                          sx={{
                            bgcolor: levelStyle.bg,
                            color: levelStyle.color,
                            fontSize: "0.7rem",
                            "& .MuiChip-icon": { color: levelStyle.color },
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ fontSize: "0.75rem" }}>
                        {log.context || "-"}
                      </TableCell>
                      <TableCell sx={{ maxWidth: 400, fontSize: "0.75rem" }}>
                        <Tooltip title={log.message}>
                          <Typography
                            variant="body2"
                            sx={{
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              fontSize: "0.75rem",
                            }}
                          >
                            {truncateText(log.message, 80)}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell sx={{ fontSize: "0.75rem" }}>
                        {log.jobId ? (
                          <Chip
                            label={truncateText(log.jobId, 12)}
                            size="small"
                            variant="outlined"
                            sx={{ fontSize: "0.65rem" }}
                          />
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <IconButton
                          id={`btn-view-log-${log.id}`}
                          size="small"
                          onClick={() => handleViewDetail(log)}
                        >
                          <Visibility fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[25, 50, 100, 200]}
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
          Log Details
          {selectedLog && (
            <Chip
              icon={getLevelIcon(selectedLog.level)}
              label={selectedLog.level}
              size="small"
              sx={{
                ml: 2,
                ...getLevelColor(selectedLog.level),
              }}
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
                    Level
                  </Typography>
                  <Typography sx={{ textTransform: "capitalize" }}>
                    {selectedLog.level}
                  </Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">
                    Context
                  </Typography>
                  <Typography>{selectedLog.context || "-"}</Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">
                    Job ID
                  </Typography>
                  <Typography sx={{ wordBreak: "break-all" }}>
                    {selectedLog.jobId || "-"}
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

              {/* Message */}
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Message
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
                      fontSize: "0.85rem",
                    }}
                  >
                    {selectedLog.message}
                  </Typography>
                </Paper>
              </Box>

              {/* Details */}
              {selectedLog.details && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Details
                  </Typography>
                  <Paper
                    sx={{
                      p: 2,
                      bgcolor: "rgba(255,255,255,0.02)",
                      maxHeight: 300,
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
                      {typeof selectedLog.details === "string"
                        ? selectedLog.details
                        : JSON.stringify(selectedLog.details, null, 2)}
                    </Typography>
                  </Paper>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button id="btn-close-log-detail" onClick={handleCloseDetail}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Clear Logs Dialog */}
      <Dialog
        open={clearDialogOpen}
        onClose={() => setClearDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Clear Old Logs</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography color="text.secondary">
              This will permanently delete logs older than the specified number of days.
            </Typography>
            <TextField
              id="input-clear-days"
              type="number"
              label="Days to keep"
              value={clearDays}
              onChange={(e) => setClearDays(parseInt(e.target.value) || 7)}
              inputProps={{ min: 1, max: 365 }}
              fullWidth
              helperText="Logs older than this will be deleted"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button id="btn-cancel-clear" onClick={() => setClearDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            id="btn-confirm-clear"
            onClick={handleClearLogs}
            color="warning"
            variant="contained"
            disabled={clearing}
          >
            {clearing ? <CircularProgress size={20} /> : "Clear Logs"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default AppLogsPage;
