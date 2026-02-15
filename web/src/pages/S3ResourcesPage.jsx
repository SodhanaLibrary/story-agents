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
  Grid,
  Card,
  CardContent,
  Tooltip,
  CircularProgress,
  Alert,
  Stack,
  Checkbox,
  FormControlLabel,
  LinearProgress,
} from "@mui/material";
import {
  Refresh,
  ArrowBack,
  Delete,
  DeleteSweep,
  Storage,
  CloudQueue,
  Link as LinkIcon,
  LinkOff,
  Image as ImageIcon,
  Visibility,
  Warning,
} from "@mui/icons-material";
import api from "../services/api";

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function formatDate(dateStr) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleString();
}

function S3ResourcesPage() {
  const navigate = useNavigate();
  const [objects, setObjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [bucketInfo, setBucketInfo] = useState(null);
  const [stats, setStats] = useState({
    totalCount: 0,
    totalSize: 0,
    orphanCount: 0,
    orphanSize: 0,
    linkedCount: 0,
  });

  // Filters
  const [showOrphansOnly, setShowOrphansOnly] = useState(false);
  const [prefixFilter, setPrefixFilter] = useState("");

  // Selection for deletion
  const [selected, setSelected] = useState(new Set());

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteAllOrphansDialogOpen, setDeleteAllOrphansDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteResult, setDeleteResult] = useState(null);

  // Preview dialog
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const fetchObjects = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (prefixFilter) params.append("prefix", prefixFilter);

      const response = await api.get(`/api/s3/objects?${params}`);
      const data = await response.json();

      if (data.objects) {
        setObjects(data.objects);
        setBucketInfo({
          bucket: data.bucket,
          region: data.region,
          cdnUrl: data.cdnUrl,
        });
        setStats({
          totalCount: data.totalCount,
          totalSize: data.totalSize,
          orphanCount: data.orphanCount,
          orphanSize: data.orphanSize,
          linkedCount: data.linkedCount,
        });
        setSelected(new Set());
      }
    } catch (err) {
      setError("Failed to fetch S3 objects. S3 storage may not be enabled.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchObjects();
  }, [prefixFilter]);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleSelectAll = (event) => {
    if (event.target.checked) {
      const newSelected = new Set(
        filteredObjects.map((obj) => obj.key)
      );
      setSelected(newSelected);
    } else {
      setSelected(new Set());
    }
  };

  const handleSelectOne = (key) => {
    const newSelected = new Set(selected);
    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.add(key);
    }
    setSelected(newSelected);
  };

  const handleDeleteSelected = async () => {
    if (selected.size === 0) return;
    
    setDeleting(true);
    setDeleteResult(null);
    try {
      const response = await api.fetch("/api/s3/objects", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keys: Array.from(selected) }),
      });
      const data = await response.json();
      setDeleteResult(data);
      setDeleteDialogOpen(false);
      fetchObjects();
    } catch (err) {
      setError("Failed to delete objects");
      console.error(err);
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteAllOrphans = async () => {
    setDeleting(true);
    setDeleteResult(null);
    try {
      const params = new URLSearchParams();
      if (prefixFilter) params.append("prefix", prefixFilter);

      const response = await api.del(`/api/s3/orphans?${params}`);
      const data = await response.json();
      setDeleteResult(data);
      setDeleteAllOrphansDialogOpen(false);
      fetchObjects();
    } catch (err) {
      setError("Failed to delete orphan objects");
      console.error(err);
    } finally {
      setDeleting(false);
    }
  };

  const handlePreview = (url) => {
    setPreviewUrl(url);
    setPreviewOpen(true);
  };

  // Filter objects
  const filteredObjects = showOrphansOnly
    ? objects.filter((obj) => obj.isOrphan)
    : objects;

  // Paginate
  const paginatedObjects = filteredObjects.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  const allSelected = paginatedObjects.length > 0 && 
    paginatedObjects.every((obj) => selected.has(obj.key));

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: "auto" }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", mb: 3, gap: 2 }}>
        <IconButton id="btn-back-library" onClick={() => navigate("/library")}>
          <ArrowBack />
        </IconButton>
        <CloudQueue sx={{ fontSize: 32, color: "primary.main" }} />
        <Typography variant="h4">S3 Resources</Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Tooltip title="Refresh">
          <IconButton id="btn-refresh-s3" onClick={fetchObjects} disabled={loading}>
            <Refresh />
          </IconButton>
        </Tooltip>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {deleteResult && (
        <Alert 
          severity={deleteResult.failedCount > 0 ? "warning" : "success"} 
          sx={{ mb: 3 }}
          onClose={() => setDeleteResult(null)}
        >
          Deleted {deleteResult.deletedCount} objects
          {deleteResult.failedCount > 0 && `, ${deleteResult.failedCount} failed`}
        </Alert>
      )}

      {/* Bucket Info */}
      {bucketInfo && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="subtitle2" color="text.secondary">
            Bucket: <strong>{bucketInfo.bucket}</strong> | 
            Region: <strong>{bucketInfo.region}</strong>
            {bucketInfo.cdnUrl && (
              <> | CDN: <strong>{bucketInfo.cdnUrl}</strong></>
            )}
          </Typography>
        </Paper>
      )}

      {/* Stats Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Storage color="primary" />
                <Box>
                  <Typography variant="h5">{stats.totalCount}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Objects
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatBytes(stats.totalSize)}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1}>
                <LinkIcon color="success" />
                <Box>
                  <Typography variant="h5">{stats.linkedCount}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Linked (In Use)
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: stats.orphanCount > 0 ? "warning.light" : "inherit" }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1}>
                <LinkOff color={stats.orphanCount > 0 ? "warning" : "disabled"} />
                <Box>
                  <Typography variant="h5">{stats.orphanCount}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Orphaned (Unused)
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatBytes(stats.orphanSize)}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1}>
                <ImageIcon color="info" />
                <Box>
                  <Typography variant="h5">{selected.size}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Selected
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Actions & Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
          <TextField
            size="small"
            label="Prefix Filter"
            value={prefixFilter}
            onChange={(e) => setPrefixFilter(e.target.value)}
            placeholder="e.g., avatars/"
            sx={{ minWidth: 200 }}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={showOrphansOnly}
                onChange={(e) => setShowOrphansOnly(e.target.checked)}
              />
            }
            label="Show orphans only"
          />
          <Box sx={{ flexGrow: 1 }} />
          <Button
            id="btn-delete-selected"
            variant="outlined"
            color="error"
            startIcon={<Delete />}
            disabled={selected.size === 0}
            onClick={() => setDeleteDialogOpen(true)}
          >
            Delete Selected ({selected.size})
          </Button>
          <Button
            id="btn-delete-all-orphans"
            variant="contained"
            color="warning"
            startIcon={<DeleteSweep />}
            disabled={stats.orphanCount === 0}
            onClick={() => setDeleteAllOrphansDialogOpen(true)}
          >
            Delete All Orphans ({stats.orphanCount})
          </Button>
        </Stack>
      </Paper>

      {/* Loading */}
      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {/* Objects Table */}
      <Paper>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={allSelected}
                    indeterminate={selected.size > 0 && !allSelected}
                    onChange={handleSelectAll}
                  />
                </TableCell>
                <TableCell>Key</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Size</TableCell>
                <TableCell>Last Modified</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedObjects.map((obj) => (
                <TableRow 
                  key={obj.key}
                  sx={{
                    bgcolor: obj.isOrphan ? "rgba(255, 152, 0, 0.08)" : "inherit",
                  }}
                >
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selected.has(obj.key)}
                      onChange={() => handleSelectOne(obj.key)}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        maxWidth: 400, 
                        overflow: "hidden", 
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={obj.key}
                    >
                      {obj.key}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {obj.isOrphan ? (
                      <Chip
                        icon={<LinkOff />}
                        label="Orphan"
                        color="warning"
                        size="small"
                      />
                    ) : (
                      <Chip
                        icon={<LinkIcon />}
                        label="Linked"
                        color="success"
                        size="small"
                        variant="outlined"
                      />
                    )}
                  </TableCell>
                  <TableCell>{formatBytes(obj.size)}</TableCell>
                  <TableCell>{formatDate(obj.lastModified)}</TableCell>
                  <TableCell>
                    <Tooltip title="Preview">
                      <IconButton
                        size="small"
                        onClick={() => handlePreview(obj.url)}
                      >
                        <Visibility />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              {paginatedObjects.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Typography color="text.secondary" sx={{ py: 4 }}>
                      {showOrphansOnly
                        ? "No orphan objects found"
                        : "No objects found in bucket"}
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={filteredObjects.length}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[25, 50, 100, 250]}
        />
      </Paper>

      {/* Delete Selected Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Warning color="error" />
            <span>Delete Selected Objects</span>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete {selected.size} selected object(s)?
          </Typography>
          <Typography variant="body2" color="error" sx={{ mt: 1 }}>
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button
            id="btn-confirm-delete"
            variant="contained"
            color="error"
            onClick={handleDeleteSelected}
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={16} /> : <Delete />}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete All Orphans Dialog */}
      <Dialog 
        open={deleteAllOrphansDialogOpen} 
        onClose={() => setDeleteAllOrphansDialogOpen(false)}
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <DeleteSweep color="warning" />
            <span>Delete All Orphan Objects</span>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete all {stats.orphanCount} orphan object(s)?
          </Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            Total size: {formatBytes(stats.orphanSize)}
          </Typography>
          <Alert severity="warning" sx={{ mt: 2 }}>
            Orphan objects are images not linked to any story, character, page, or draft.
            Make sure they are not needed before deleting.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteAllOrphansDialogOpen(false)}>Cancel</Button>
          <Button
            id="btn-confirm-delete-orphans"
            variant="contained"
            color="warning"
            onClick={handleDeleteAllOrphans}
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={16} /> : <DeleteSweep />}
          >
            Delete All Orphans
          </Button>
        </DialogActions>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog 
        open={previewOpen} 
        onClose={() => setPreviewOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Image Preview</DialogTitle>
        <DialogContent>
          {previewUrl && (
            <Box sx={{ textAlign: "center" }}>
              <img
                src={previewUrl}
                alt="Preview"
                style={{ maxWidth: "100%", maxHeight: "70vh" }}
                onError={(e) => {
                  e.target.style.display = "none";
                  e.target.nextSibling.style.display = "block";
                }}
              />
              <Typography 
                color="error" 
                sx={{ display: "none" }}
              >
                Failed to load image
              </Typography>
              <Typography 
                variant="caption" 
                color="text.secondary" 
                sx={{ mt: 2, display: "block", wordBreak: "break-all" }}
              >
                {previewUrl}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewOpen(false)}>Close</Button>
          <Button
            href={previewUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open in New Tab
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default S3ResourcesPage;
