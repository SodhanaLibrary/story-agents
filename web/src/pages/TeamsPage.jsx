import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  CardActionArea,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Alert,
  Chip,
} from "@mui/material";
import { Add, Groups } from "@mui/icons-material";
import { useAuth } from "../context/AuthContext";
import { useOrgs, useCreateOrg } from "../hooks/useOrgs";

export default function TeamsPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");

  const { data: orgs = [], isLoading, isError, error } = useOrgs({
    enabled: isAuthenticated,
  });
  const createOrg = useCreateOrg();

  const creating = createOrg.isPending;

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      const data = await createOrg.mutateAsync({ name: newName.trim() });
      setCreateOpen(false);
      setNewName("");
      if (data?.id) navigate(`/teams/${data.id}`);
    } catch (e) {
      // Error is available on createOrg.error
    }
  };

  if (!isAuthenticated) {
    return (
      <Box sx={{ py: 4, textAlign: "center" }}>
        <Typography color="text.secondary">Sign in to manage teams.</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography variant="h4" sx={{ fontFamily: '"Crimson Pro", serif' }}>
          Teams
        </Typography>
        <Button
          id="btn-teams-create"
          variant="contained"
          startIcon={<Add />}
          onClick={() => setCreateOpen(true)}
        >
          Create team
        </Button>
      </Box>

      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error?.message || "Failed to load teams"}
        </Alert>
      )}
      {createOrg.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {createOrg.error?.message || "Failed to create team"}
        </Alert>
      )}

      {isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress />
        </Box>
      ) : orgs.length === 0 ? (
        <Card sx={{ bgcolor: "rgba(255,255,255,0.03)", border: "1px solid", borderColor: "divider" }}>
          <CardContent sx={{ textAlign: "center", py: 6 }}>
            <Groups sx={{ fontSize: 48, color: "text.secondary", mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              No teams yet
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              Create an organization and invite members to collaborate. Team members get shared usage.
            </Typography>
            <Button
              id="btn-teams-create-empty"
              variant="contained"
              startIcon={<Add />}
              onClick={() => setCreateOpen(true)}
            >
              Create team
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
          {orgs.map((org) => (
            <Card
              id={`card-team-${org.id}`}
              key={org.id}
              sx={{
                width: 280,
                bgcolor: "rgba(255,255,255,0.04)",
                border: "1px solid",
                borderColor: "divider",
              }}
            >
              <CardActionArea
                id={`link-team-${org.id}`}
                onClick={() => navigate(`/teams/${org.id}`)}
              >
                <CardContent>
                  <Typography variant="h6" noWrap>
                    {org.name}
                  </Typography>
                  <Chip
                    label={org.my_role}
                    size="small"
                    sx={{ mt: 1, textTransform: "capitalize" }}
                    color={org.my_role === "owner" ? "primary" : "default"}
                  />
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {org.member_count ?? 0} member{(org.member_count ?? 0) !== 1 ? "s" : ""}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          ))}
        </Box>
      )}

      <Dialog open={createOpen} onClose={() => !creating && setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create team</DialogTitle>
        <DialogContent>
          <TextField
            id="input-create-team-name"
            autoFocus
            margin="dense"
            label="Organization name"
            fullWidth
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
        </DialogContent>
        <DialogActions>
          <Button id="btn-create-team-cancel" onClick={() => setCreateOpen(false)} disabled={creating}>
            Cancel
          </Button>
          <Button
            id="btn-create-team-submit"
            onClick={handleCreate}
            variant="contained"
            disabled={!newName.trim() || creating}
          >
            {creating ? <CircularProgress size={24} /> : "Create"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
