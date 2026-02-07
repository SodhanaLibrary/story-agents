import { GoogleLogin } from "@react-oauth/google";
import {
  Box,
  Typography,
  Avatar,
  Button,
  Menu,
  MenuItem,
  Divider,
} from "@mui/material";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Logout, Timeline, BatchPrediction } from "@mui/icons-material";
import { useAuth } from "../context/AuthContext";

export default function GoogleLoginButton() {
  const { user, isAuthenticated, login, logout } = useAuth();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  const handleSuccess = async (credentialResponse) => {
    try {
      // Pass the raw credential to AuthContext - it will decode and call backend
      await login(credentialResponse.credential);
    } catch (error) {
      console.error("Failed to login with Google:", error);
    }
  };

  const handleError = () => {
    console.error("Google Login Failed");
  };

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

  const handleBatchRequests = () => {
    navigate("/batch-requests");
    handleMenuClose();
  };

  if (isAuthenticated && user) {
    return (
      <>
        <Button
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
          <MenuItem onClick={handleBatchRequests} sx={{ gap: 1.5 }}>
            <BatchPrediction fontSize="small" />
            Batch Requests
          </MenuItem>
          <MenuItem onClick={handlePromptLogs} sx={{ gap: 1.5 }}>
            <Timeline fontSize="small" />
            AI Prompt Logs
          </MenuItem>
          <Divider />
          <MenuItem
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
    <Box sx={{ display: "flex", alignItems: "center" }}>
      <GoogleLogin
        onSuccess={handleSuccess}
        onError={handleError}
        useOneTap
        theme="filled_black"
        shape="pill"
        size="medium"
        text="signin_with"
        locale="en"
      />
    </Box>
  );
}
