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
  IconButton,
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
import { useAuth } from "../context/AuthContext";
import {
  useOrg,
  useUpdateOrg,
  useAddOrgMember,
  useRemoveOrgMember,
  useSetOrgMemberRole,
  useLeaveOrg,
} from "../hooks/useOrgs";

export default function TeamDetailPage() {
  const { orgId } = useParams();
  const navigate = useNavigate();
  const { userId, isAuthenticated } = useAuth();
  const [addOpen, setAddOpen] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [editName, setEditName] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [memberMenu, setMemberMenu] = useState({ anchor: null, member: null });

  const { data: org, isLoading, isError, error } = useOrg(parseInt(orgId, 10));
  const updateOrg = useUpdateOrg(orgId);
  const addMember = useAddOrgMember(orgId);
  const removeMember = useRemoveOrgMember(orgId);
  const setRole = useSetOrgMemberRole(orgId);
  const leaveOrg = useLeaveOrg(orgId);

  useEffect(() => {
    if (org?.name) setEditName(org.name);
  }, [org?.name]);

  const myRole = org?.members?.find((m) => m.user_id === userId)?.role;
  const isOwnerOrAdmin = myRole === "owner" || myRole === "admin";

  const handleAddMember = async () => {
    if (!addEmail.trim()) return;
    try {
      await addMember.mutateAsync(addEmail.trim());
      setAddOpen(false);
      setAddEmail("");
    } catch (e) {
      // Error shown via addMember.error
    }
  };

  const handleUpdateName = async () => {
    try {
      await updateOrg.mutateAsync({ name: editName.trim() });
      setEditOpen(false);
    } catch (e) {}
  };

  const handleRemoveMember = async (memberId) => {
    setMemberMenu({ anchor: null, member: null });
    try {
      await removeMember.mutateAsync(memberId);
    } catch (e) {}
  };

  const handleSetRole = async (memberId, role) => {
    setMemberMenu({ anchor: null, member: null });
    try {
      await setRole.mutateAsync({ memberId, role });
    } catch (e) {}
  };

  const handleLeave = async () => {
    try {
      await leaveOrg.mutateAsync();
      navigate("/teams");
    } catch (e) {}
  };

  if (!isAuthenticated) {
    return (
      <Box sx={{ py: 4, textAlign: "center" }}>
        <Typography color="text.secondary">Sign in to view the team.</Typography>
      </Box>
    );
  }

  if (isLoading || !org) {
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
          <IconButton
            id="btn-team-edit-name"
            size="small"
            onClick={() => setEditOpen(true)}
            aria-label="Edit name"
          >
            <Edit fontSize="small" />
          </IconButton>
        )}
        <Chip label={myRole} size="small" color={myRole === "owner" ? "primary" : "default"} />
      </Box>

      {(isError || updateOrg.isError || addMember.isError || removeMember.isError || setRole.isError || leaveOrg.isError) && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {(error || updateOrg.error || addMember.error || removeMember.error || setRole.error || leaveOrg.error)?.message || "Something went wrong"}
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
                disabled={leaveOrg.isPending}
              >
                Leave
              </Button>
            )}
          </ListItem>
        ))}
      </List>

      {myRole === "owner" && (
        <Button color="error" startIcon={<Logout />} onClick={handleLeave} disabled sx={{ mt: 2 }}>
          Owner cannot leave
        </Button>
      )}

      {myRole !== "owner" && myRole !== "admin" && (
        <Button
          id="btn-leave-team-bottom"
          color="error"
          startIcon={<Logout />}
          onClick={handleLeave}
          disabled={leaveOrg.isPending}
          sx={{ mt: 2 }}
        >
          {leaveOrg.isPending ? <CircularProgress size={20} /> : "Leave team"}
        </Button>
      )}

      <Menu
        anchorEl={memberMenu.anchor}
        open={Boolean(memberMenu.anchor)}
        onClose={() => setMemberMenu({ anchor: null, member: null })}
      >
        {memberMenu.member?.role === "member" && (
          <MenuItem
            id="menu-make-admin"
            onClick={() => handleSetRole(memberMenu.member.user_id, "admin")}
          >
            <AdminPanelSettings fontSize="small" sx={{ mr: 1 }} />
            Make admin
          </MenuItem>
        )}
        {memberMenu.member?.role === "admin" && (
          <MenuItem
            id="menu-make-member"
            onClick={() => handleSetRole(memberMenu.member.user_id, "member")}
          >
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

      <Dialog open={addOpen} onClose={() => !addMember.isPending && setAddOpen(false)} maxWidth="sm" fullWidth>
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
          <Button id="btn-add-member-cancel" onClick={() => setAddOpen(false)} disabled={addMember.isPending}>
            Cancel
          </Button>
          <Button
            id="btn-add-member-submit"
            onClick={handleAddMember}
            variant="contained"
            disabled={!addEmail.trim() || addMember.isPending}
          >
            {addMember.isPending ? <CircularProgress size={24} /> : "Add"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={editOpen} onClose={() => !updateOrg.isPending && setEditOpen(false)} maxWidth="sm" fullWidth>
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
          <Button id="btn-edit-team-cancel" onClick={() => setEditOpen(false)} disabled={updateOrg.isPending}>
            Cancel
          </Button>
          <Button
            id="btn-edit-team-save"
            onClick={handleUpdateName}
            variant="contained"
            disabled={!editName.trim() || updateOrg.isPending}
          >
            {updateOrg.isPending ? <CircularProgress size={24} /> : "Save"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
