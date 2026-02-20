import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  Button,
  TextField,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Avatar,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Alert,
  Menu,
  MenuItem,
} from "@mui/material";
import {
  ArrowBack,
  PersonAdd,
  MoreVert,
  Edit,
  Logout,
  Block,
  AdminPanelSettings,
  Person,
} from "@mui/icons-material";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

export default function TeamDetailPage() {
  const { orgId } = useParams();
  const navigate = useNavigate();
  const { userId, isAuthenticated } = useAuth();
  const [org, setOrg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [editName, setEditName] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [memberMenu, setMemberMenu] = useState({ anchor: null, member: null });
  const [leaving, setLeaving] = useState(false);

  const fetchOrg = async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/api/orgs/${orgId}`);
      const data = await res.json();
      if (res.ok) {
        setOrg(data);
        setEditName(data.name || "");
      } else {
        setError(data.error || "Failed to load team");
      }
    } catch (e) {
      setError("Failed to load team");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && orgId) fetchOrg();
    else setLoading(false);
  }, [isAuthenticated, orgId]);

  const myRole = org?.members?.find((m) => m.user_id === userId)?.role;
  const isOwnerOrAdmin = myRole === "owner" || myRole === "admin";

  const handleAddMember = async () => {
    if (!addEmail.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const res = await api.post(`/api/orgs/${orgId}/members`, { email: addEmail.trim() });
      const data = await res.json();
      if (res.ok) {
        setAddOpen(false);
        setAddEmail("");
        fetchOrg();
      } else {
        setError(data.error || "Failed to add member");
      }
    } catch (e) {
      setError(e.message || "Failed to add member");
    } finally {
      setAdding(false);
    }
  };

  const handleUpdateName = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await api.put(`/api/orgs/${orgId}`, { name: editName.trim() });
      if (res.ok) {
        setEditOpen(false);
        setOrg((o) => (o ? { ...o, name: editName.trim() } : o));
      } else {
        const data = await res.json();
        setError(data.error || "Failed to update name");
      }
    } catch (e) {
      setError(e.message || "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveMember = async (memberId) => {
    setMemberMenu({ anchor: null, member: null });
    try {
      const res = await api.del(`/api/orgs/${orgId}/members/${memberId}`);
      if (res.ok) fetchOrg();
      else {
        const data = await res.json();
        setError(data.error || "Failed to remove member");
      }
    } catch (e) {
      setError(e.message || "Failed to remove member");
    }
  };

  const handleSetRole = async (memberId, role) => {
    setMemberMenu({ anchor: null, member: null });
    try {
      const res = await api.put(`/api/orgs/${orgId}/members/${memberId}/role`, { role });
      if (res.ok) fetchOrg();
      else {
        const data = await res.json();
        setError(data.error || "Failed to update role");
      }
    } catch (e) {
      setError(e.message || "Failed to update role");
    }
  };

  const handleLeave = async () => {
    setLeaving(true);
    setError(null);
    try {
      const res = await api.post(`/api/orgs/${orgId}/leave`);
      if (res.ok) navigate("/teams");
      else {
        const data = await res.json();
        setError(data.error || "Failed to leave");
      }
    } catch (e) {
      setError(e.message || "Failed to leave");
    } finally {
      setLeaving(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <Box sx={{ py: 4, textAlign: "center" }}>
        <Typography color="text.secondary">Sign in to view the team.</Typography>
      </Box>
    );
  }

  if (loading || !org) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  const members = org.members || [];

  return (
    <Box>
      <Button
        id="btn-team-back"
        startIcon={<ArrowBack />}
        onClick={() => navigate("/teams")}
        sx={{ mb: 2, color: "text.secondary" }}
      >
        Back to teams
      </Button>

      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3, flexWrap: "wrap" }}>
        <Typography variant="h4" sx={{ fontFamily: '"Crimson Pro", serif' }}>
          {org.name}
        </Typography>
        {isOwnerOrAdmin && (
          <IconButton id="btn-team-edit-name" size="small" onClick={() => setEditOpen(true)} aria-label="Edit name">
            <Edit fontSize="small" />
          </IconButton>
        )}
        <Chip label={myRole} size="small" color={myRole === "owner" ? "primary" : "default"} />
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {isOwnerOrAdmin && (
        <Button
          id="btn-team-add-member"
          variant="outlined"
          startIcon={<PersonAdd />}
          onClick={() => setAddOpen(true)}
          sx={{ mb: 2 }}
        >
          Add member
        </Button>
      )}

      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
        Members ({members.length})
      </Typography>
      <List sx={{ bgcolor: "rgba(255,255,255,0.03)", borderRadius: 1, border: "1px solid", borderColor: "divider" }}>
        {members.map((m) => (
          <ListItem key={m.user_id}>
            <ListItemAvatar>
              <Avatar src={m.picture} alt={m.name}>
                {(m.name || m.email || "?").charAt(0).toUpperCase()}
              </Avatar>
            </ListItemAvatar>
            <ListItemText
              primary={m.name || m.email}
              secondary={m.email !== m.name ? m.email : null}
            />
            <Chip
              label={m.role}
              size="small"
              sx={{ mr: 1 }}
              color={m.role === "owner" ? "primary" : "default"}
              icon={m.role === "owner" ? <AdminPanelSettings /> : m.role === "admin" ? <AdminPanelSettings /> : <Person />}
            />
            {isOwnerOrAdmin && m.role !== "owner" && m.user_id !== userId && (
              <IconButton
                id={`btn-member-menu-${m.user_id}`}
                size="small"
                onClick={(e) => setMemberMenu({ anchor: e.currentTarget, member: m })}
              >
                <MoreVert />
              </IconButton>
            )}
            {m.user_id === userId && myRole !== "owner" && (
              <Button
                id="btn-leave-team"
                size="small"
                color="error"
                startIcon={<Logout />}
                onClick={handleLeave}
                disabled={leaving}
              >
                Leave
              </Button>
            )}
          </ListItem>
        ))}
      </List>

      {myRole === "owner" && (
        <Button
          color="error"
          startIcon={<Logout />}
          onClick={handleLeave}
          disabled
          sx={{ mt: 2 }}
        >
          Owner cannot leave
        </Button>
      )}

      {myRole !== "owner" && myRole !== "admin" && (
        <Button
          id="btn-leave-team-bottom"
          color="error"
          startIcon={<Logout />}
          onClick={handleLeave}
          disabled={leaving}
          sx={{ mt: 2 }}
        >
          {leaving ? <CircularProgress size={20} /> : "Leave team"}
        </Button>
      )}

      <Menu
        anchorEl={memberMenu.anchor}
        open={Boolean(memberMenu.anchor)}
        onClose={() => setMemberMenu({ anchor: null, member: null })}
      >
        {memberMenu.member?.role === "member" && (
          <MenuItem id="menu-make-admin" onClick={() => handleSetRole(memberMenu.member.user_id, "admin")}>
            <AdminPanelSettings fontSize="small" sx={{ mr: 1 }} />
            Make admin
          </MenuItem>
        )}
        {memberMenu.member?.role === "admin" && (
          <MenuItem id="menu-make-member" onClick={() => handleSetRole(memberMenu.member.user_id, "member")}>
            <Person fontSize="small" sx={{ mr: 1 }} />
            Make member
          </MenuItem>
        )}
        <MenuItem
          id="menu-remove-member"
          onClick={() => handleRemoveMember(memberMenu.member?.user_id)}
          sx={{ color: "error.main" }}
        >
          <Block fontSize="small" sx={{ mr: 1 }} />
          Remove from team
        </MenuItem>
      </Menu>

      <Dialog open={addOpen} onClose={() => !adding && setAddOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add member</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Enter the email of a user who already has an account. They will be added as a member.
          </Typography>
          <TextField
            id="input-add-member-email"
            autoFocus
            margin="dense"
            label="Email"
            type="email"
            fullWidth
            value={addEmail}
            onChange={(e) => setAddEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddMember()}
          />
        </DialogContent>
        <DialogActions>
          <Button id="btn-add-member-cancel" onClick={() => setAddOpen(false)} disabled={adding}>
            Cancel
          </Button>
          <Button id="btn-add-member-submit" onClick={handleAddMember} variant="contained" disabled={!addEmail.trim() || adding}>
            {adding ? <CircularProgress size={24} /> : "Add"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={editOpen} onClose={() => !saving && setEditOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit team name</DialogTitle>
        <DialogContent>
          <TextField
            id="input-edit-team-name"
            autoFocus
            margin="dense"
            label="Organization name"
            fullWidth
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleUpdateName()}
          />
        </DialogContent>
        <DialogActions>
          <Button id="btn-edit-team-cancel" onClick={() => setEditOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button id="btn-edit-team-save" onClick={handleUpdateName} variant="contained" disabled={!editName.trim() || saving}>
            {saving ? <CircularProgress size={24} /> : "Save"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
