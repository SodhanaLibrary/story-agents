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
  Tooltip,
  CircularProgress,
  Alert,
  Stack,
  Avatar,
  InputAdornment,
} from "@mui/material";
import {
  Refresh,
  ArrowBack,
  Edit,
  Search,
  Person,
  AdminPanelSettings,
  SupervisorAccount,
  Star,
  Group,
} from "@mui/icons-material";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

const ROLE_CONFIG = {
  user: {
    label: "User",
    color: "default",
    icon: <Person fontSize="small" />,
  },
  "premium-user": {
    label: "Premium",
    color: "info",
    icon: <Star fontSize="small" />,
  },
  admin: {
    label: "Admin",
    color: "warning",
    icon: <SupervisorAccount fontSize="small" />,
  },
  "super-admin": {
    label: "Super Admin",
    color: "error",
    icon: <AdminPanelSettings fontSize="small" />,
  },
};

function formatDate(dateStr) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString();
}

function UserManagementPage() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [stats, setStats] = useState({ total: 0, byRole: {} });

  // Filters
  const [searchFilter, setSearchFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  // Edit role dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [newRole, setNewRole] = useState("");
  const [saving, setSaving] = useState(false);

  // Current user's role
  const [currentUserRole, setCurrentUserRole] = useState(null);

  const fetchCurrentUserRole = async () => {
    try {
      const response = await api.get("/api/v1/users/me");
      const data = await response.json();
      setCurrentUserRole(data.role);
    } catch (err) {
      console.error("Failed to fetch current user role:", err);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        limit: rowsPerPage,
        offset: page * rowsPerPage,
      });

      if (searchFilter) params.append("search", searchFilter);
      if (roleFilter) params.append("role", roleFilter);

      const response = await api.get(`/api/v1/admin/users?${params}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch users");
      }

      const data = await response.json();
      setUsers(data.users || []);
    } catch (err) {
      setError(err.message || "Failed to fetch users. You may not have admin access.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get("/api/v1/admin/users/stats");
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    }
  };

  useEffect(() => {
    fetchCurrentUserRole();
    fetchStats();
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [page, rowsPerPage, searchFilter, roleFilter]);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleEditRole = (user) => {
    setSelectedUser(user);
    setNewRole(user.role);
    setEditDialogOpen(true);
  };

  const handleSaveRole = async () => {
    if (!selectedUser || !newRole) return;

    setSaving(true);
    setError(null);
    try {
      const response = await api.put(
        `/api/v1/admin/users/${selectedUser.id}/role`,
        { role: newRole }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update role");
      }

      setSuccess(`Updated ${selectedUser.name}'s role to ${ROLE_CONFIG[newRole]?.label || newRole}`);
      setEditDialogOpen(false);
      fetchUsers();
      fetchStats();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(0);
    fetchUsers();
  };

  const isSuperAdmin = currentUserRole === "super-admin";

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: "auto" }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", mb: 3, gap: 2 }}>
        <IconButton id="btn-back-library" onClick={() => navigate("/library")}>
          <ArrowBack />
        </IconButton>
        <Group sx={{ fontSize: 32, color: "primary.main" }} />
        <Typography variant="h4">User Management</Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Tooltip title="Refresh">
          <IconButton id="btn-refresh-users" onClick={fetchUsers} disabled={loading}>
            <Refresh />
          </IconButton>
        </Tooltip>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {/* Stats Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={4} md={2}>
          <Card>
            <CardContent sx={{ textAlign: "center", py: 2 }}>
              <Typography variant="h4">{stats.total}</Typography>
              <Typography variant="body2" color="text.secondary">
                Total Users
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        {Object.entries(ROLE_CONFIG).map(([role, config]) => (
          <Grid item xs={6} sm={4} md={2} key={role}>
            <Card>
              <CardContent sx={{ textAlign: "center", py: 2 }}>
                <Stack direction="row" justifyContent="center" alignItems="center" spacing={0.5}>
                  {config.icon}
                  <Typography variant="h5">{stats.byRole?.[role] || 0}</Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  {config.label}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <form onSubmit={handleSearch}>
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
            <TextField
              size="small"
              placeholder="Search by name or email..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              sx={{ minWidth: 250 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
              }}
            />
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Role</InputLabel>
              <Select
                value={roleFilter}
                label="Role"
                onChange={(e) => {
                  setRoleFilter(e.target.value);
                  setPage(0);
                }}
              >
                <MenuItem value="">All Roles</MenuItem>
                {Object.entries(ROLE_CONFIG).map(([role, config]) => (
                  <MenuItem key={role} value={role}>
                    {config.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button type="submit" variant="outlined">
              Search
            </Button>
          </Stack>
        </form>
      </Paper>

      {/* Users Table */}
      <Paper>
        {loading && (
          <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
            <CircularProgress />
          </Box>
        )}

        {!loading && (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>User</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Stories</TableCell>
                  <TableCell>Joined</TableCell>
                  {isSuperAdmin && <TableCell>Actions</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {users.map((user) => {
                  const roleConfig = ROLE_CONFIG[user.role] || ROLE_CONFIG.user;
                  const isCurrentUser = user.id === currentUser?.id;

                  return (
                    <TableRow key={user.id}>
                      <TableCell>
                        <Stack direction="row" alignItems="center" spacing={1.5}>
                          <Avatar src={user.picture} alt={user.name} sx={{ width: 36, height: 36 }}>
                            {user.name?.charAt(0)}
                          </Avatar>
                          <Box>
                            <Typography variant="body2" fontWeight={500}>
                              {user.name}
                              {isCurrentUser && (
                                <Chip label="You" size="small" sx={{ ml: 1 }} />
                              )}
                            </Typography>
                          </Box>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {user.email}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          icon={roleConfig.icon}
                          label={roleConfig.label}
                          color={roleConfig.color}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{user.storyCount || 0}</TableCell>
                      <TableCell>{formatDate(user.createdAt)}</TableCell>
                      {isSuperAdmin && (
                        <TableCell>
                          <Tooltip title={isCurrentUser ? "Cannot edit own role" : "Edit Role"}>
                            <span>
                              <IconButton
                                size="small"
                                onClick={() => handleEditRole(user)}
                                disabled={isCurrentUser}
                              >
                                <Edit fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
                {users.length === 0 && !loading && (
                  <TableRow>
                    <TableCell colSpan={isSuperAdmin ? 6 : 5} align="center">
                      <Typography color="text.secondary" sx={{ py: 4 }}>
                        No users found
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        <TablePagination
          component="div"
          count={-1}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[10, 25, 50, 100]}
          labelDisplayedRows={({ from, to }) => `${from}-${to}`}
        />
      </Paper>

      {/* Edit Role Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Edit User Role</DialogTitle>
        <DialogContent>
          {selectedUser && (
            <Box sx={{ mt: 1 }}>
              <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
                <Avatar src={selectedUser.picture} alt={selectedUser.name} sx={{ width: 48, height: 48 }}>
                  {selectedUser.name?.charAt(0)}
                </Avatar>
                <Box>
                  <Typography fontWeight={600}>{selectedUser.name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {selectedUser.email}
                  </Typography>
                </Box>
              </Stack>

              <FormControl fullWidth>
                <InputLabel>Role</InputLabel>
                <Select
                  value={newRole}
                  label="Role"
                  onChange={(e) => setNewRole(e.target.value)}
                >
                  {Object.entries(ROLE_CONFIG).map(([role, config]) => (
                    <MenuItem key={role} value={role}>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        {config.icon}
                        <span>{config.label}</span>
                      </Stack>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  <strong>Roles:</strong>
                </Typography>
                <Typography variant="caption" component="div">
                  • User: Basic access
                </Typography>
                <Typography variant="caption" component="div">
                  • Premium: Enhanced features
                </Typography>
                <Typography variant="caption" component="div">
                  • Admin: Can view all users
                </Typography>
                <Typography variant="caption" component="div">
                  • Super Admin: Can manage user roles
                </Typography>
              </Alert>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSaveRole}
            disabled={saving || newRole === selectedUser?.role}
            startIcon={saving ? <CircularProgress size={16} /> : null}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default UserManagementPage;
