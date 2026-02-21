import {
  Box,
  Typography,
  Avatar,
  Button,
  Menu,
  MenuItem,
  Divider,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Logout,
  Timeline,
  BatchPrediction,
  Storage,
  CloudQueue,
  Group,
  Assessment,
  Star,
  Groups,
  Message as MessageIcon,
} from "@mui/icons-material";
import { Person } from "@mui/icons-material";
import { useAuth } from "../context/AuthContext";

export default function GoogleLoginButton() {
  const { user, isAuthenticated, logout, isAdmin, isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    handleMenuClose();
  };

  const handlePromptLogs = () => {
    navigate("/prompt-logs");
    handleMenuClose();
  };

  const handleUsageDashboard = () => {
    navigate("/usage-dashboard");
    handleMenuClose();
  };

  const handlePricing = () => {
    navigate("/pricing");
    handleMenuClose();
  };

  const handleTeams = () => {
    navigate("/teams");
    handleMenuClose();
  };

  const handleBatchRequests = () => {
    navigate("/batch-requests");
    handleMenuClose();
  };

  const handleServerLogs = () => {
    navigate("/server-logs");
    handleMenuClose();
  };

  const handleS3Resources = () => {
    navigate("/s3-resources");
    handleMenuClose();
  };

  const handleUserManagement = () => {
    navigate("/user-management");
    handleMenuClose();
  };

  const handleMessages = () => {
    navigate("/messages");
    handleMenuClose();
  };

  if (isAuthenticated && user) {
    return (
      <>
        <Button
          id="user-menu-button"
          onClick={handleMenuOpen}
          sx={{
            textTransform: "none",
            color: "text.primary",
            gap: 1,
            "&:hover": {
              bgcolor: "rgba(232, 184, 109, 0.1)",
            },
          }}
        >
          <Avatar
            src={user.picture}
            alt={user.name}
            sx={{ width: 32, height: 32 }}
          >
            {user.name?.charAt(0)}
          </Avatar>
          <Typography
            variant="body2"
            sx={{
              display: { xs: "none", sm: "block" },
              maxWidth: 120,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {user.name}
          </Typography>
        </Button>

        <Menu
          id="user-menu"
          anchorEl={anchorEl}
          open={open}
          onClose={handleMenuClose}
          anchorOrigin={{
            vertical: "bottom",
            horizontal: "right",
          }}
          transformOrigin={{
            vertical: "top",
            horizontal: "right",
          }}
          PaperProps={{
            sx: {
              mt: 1,
              minWidth: 200,
              bgcolor: "background.paper",
              border: "1px solid",
              borderColor: "divider",
            },
          }}
        >
          <Box sx={{ px: 2, py: 1.5 }}>
            <Typography variant="body2" fontWeight={600}>
              {user.name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {user.email}
            </Typography>
          </Box>
          <Divider />
          <MenuItem
            id="menu-account"
            onClick={() => {
              navigate("/account");
              handleMenuClose();
            }}
            sx={{ gap: 1.5 }}
          >
            <Person fontSize="small" />
            Account
          </MenuItem>
          <MenuItem
            id="menu-messages"
            onClick={handleMessages}
            sx={{ gap: 1.5 }}
          >
            <MessageIcon fontSize="small" />
            Messages
          </MenuItem>
          <MenuItem
            id="menu-batch-requests"
            onClick={handleBatchRequests}
            sx={{ gap: 1.5 }}
          >
            <BatchPrediction fontSize="small" />
            Batch Requests
          </MenuItem>
          <MenuItem
            id="menu-prompt-logs"
            onClick={handlePromptLogs}
            sx={{ gap: 1.5 }}
          >
            <Timeline fontSize="small" />
            AI Prompt Logs
          </MenuItem>
          <MenuItem
            id="menu-usage-dashboard"
            onClick={handleUsageDashboard}
            sx={{ gap: 1.5 }}
          >
            <Assessment fontSize="small" />
            Usage Dashboard
          </MenuItem>
          <MenuItem
            id="menu-pricing"
            onClick={handlePricing}
            sx={{ gap: 1.5, color: "primary.main" }}
          >
            <Star fontSize="small" />
            Plans & Upgrade
          </MenuItem>
          <MenuItem id="menu-teams" onClick={handleTeams} sx={{ gap: 1.5 }}>
            <Groups fontSize="small" />
            Teams
          </MenuItem>
          {/* Admin-only menu items */}
          {isAdmin && (
            <>
              <MenuItem
                id="menu-server-logs"
                onClick={handleServerLogs}
                sx={{ gap: 1.5 }}
              >
                <Storage fontSize="small" />
                Server Logs
              </MenuItem>
              <MenuItem
                id="menu-s3-resources"
                onClick={handleS3Resources}
                sx={{ gap: 1.5 }}
              >
                <CloudQueue fontSize="small" />
                S3 Resources
              </MenuItem>
              <MenuItem
                id="menu-user-management"
                onClick={handleUserManagement}
                sx={{ gap: 1.5 }}
              >
                <Group fontSize="small" />
                User Management
              </MenuItem>
            </>
          )}
          <Divider />
          <MenuItem
            id="menu-logout"
            onClick={handleLogout}
            sx={{ gap: 1.5, color: "error.main" }}
          >
            <Logout fontSize="small" />
            Sign out
          </MenuItem>
        </Menu>
      </>
    );
  }

  return (
    <Button
      id="header-login"
      component={Link}
      to="/login"
      variant="text"
      size={isMobile ? "small" : "medium"}
      sx={{ textTransform: "none" }}
    >
      Log in
    </Button>
  );
}
