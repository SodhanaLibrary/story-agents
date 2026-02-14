import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  AppBar,
  Toolbar,
  Typography,
  Tabs,
  Tab,
  TextField,
  InputAdornment,
  Box,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Divider,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import {
  AutoStories,
  MenuBook,
  Favorite,
  Edit,
  Add,
  Search,
  Close,
} from "@mui/icons-material";
import GoogleLoginButton from "./GoogleLoginButton";
import { useAuth } from "../context/AuthContext";

function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [mobileMenuAnchor, setMobileMenuAnchor] = useState(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const mobileMenuOpen = Boolean(mobileMenuAnchor);

  const handleMobileMenuOpen = (event) => {
    setMobileMenuAnchor(event.currentTarget);
  };

  const handleMobileMenuClose = () => {
    setMobileMenuAnchor(null);
  };

  const handleMobileNavigation = (path) => {
    navigate(path);
    handleMobileMenuClose();
  };

  // Determine current tab based on route
  const getTabValue = () => {
    const path = location.pathname;
    if (path === "/" || path.startsWith("/stories")) return 0;
    if (path === "/favorites") return 1;
    if (path === "/drafts") return 2;
    if (path === "/create") return 3;
    return false; // No tab selected for profile, etc.
  };

  const tabValue = getTabValue();

  const handleTabChange = (event, newValue) => {
    switch (newValue) {
      case 0:
        navigate("/");
        break;
      case 1:
        navigate("/favorites");
        break;
      case 2:
        navigate("/drafts");
        break;
      case 3:
        navigate("/create");
        break;
      default:
        navigate("/");
    }
  };

  const handleSearch = (e) => {
    if (e.key === "Enter" && searchQuery.trim()) {
      navigate(`/stories?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleSearchSubmit = () => {
    if (searchQuery.trim()) {
      navigate(`/stories?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  // Check if we're in create/edit mode
  const isCreateMode = location.pathname === "/create" || location.pathname.includes("/edit");
  const isProfileMode = location.pathname.startsWith("/profile");
  const isStoryViewMode = location.pathname.startsWith("/story/");

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        background: "rgba(15, 15, 26, 0.95)",
        backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(232, 184, 109, 0.15)",
      }}
    >
      <Toolbar sx={{ gap: 2 }}>
        {/* Logo - opens menu on mobile, navigates home on desktop */}
        <Box
          id="header-logo"
          sx={{ display: "flex", alignItems: "center", cursor: "pointer" }}
          onClick={isMobile && !isCreateMode && !isProfileMode && !isStoryViewMode ? handleMobileMenuOpen : () => navigate("/")}
        >
          <AutoStories sx={{ mr: 1, color: "primary.main" }} />
          <Typography
            variant="h6"
            sx={{
              fontFamily: '"Crimson Pro", serif',
              fontWeight: 700,
              display: { xs: "none", sm: "block" },
            }}
          >
            Story Agents
          </Typography>
        </Box>

        {/* Mobile Navigation Menu */}
        <Menu
          id="mobile-nav-menu"
          anchorEl={mobileMenuAnchor}
          open={mobileMenuOpen}
          onClose={handleMobileMenuClose}
          anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
          transformOrigin={{ vertical: "top", horizontal: "left" }}
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
          <MenuItem
            id="mobile-menu-stories"
            onClick={() => handleMobileNavigation("/")}
            selected={location.pathname === "/" || location.pathname.startsWith("/stories")}
            sx={{ gap: 1.5 }}
          >
            <MenuBook fontSize="small" />
            All Stories
          </MenuItem>
          {isAuthenticated && (
            <MenuItem
              id="mobile-menu-favorites"
              onClick={() => handleMobileNavigation("/favorites")}
              selected={location.pathname === "/favorites"}
              sx={{ gap: 1.5 }}
            >
              <Favorite fontSize="small" />
              Favorites
            </MenuItem>
          )}
          {isAuthenticated && (
            <MenuItem
              id="mobile-menu-drafts"
              onClick={() => handleMobileNavigation("/drafts")}
              selected={location.pathname === "/drafts"}
              sx={{ gap: 1.5 }}
            >
              <Edit fontSize="small" />
              My Drafts
            </MenuItem>
          )}
          {isAuthenticated && <Divider />}
          {isAuthenticated && (
            <MenuItem
              id="mobile-menu-create"
              onClick={() => handleMobileNavigation("/create")}
              selected={location.pathname === "/create"}
              sx={{ gap: 1.5, color: "primary.main" }}
            >
              <Add fontSize="small" />
              Create Story
            </MenuItem>
          )}
        </Menu>

        {/* Search Box */}
        <TextField
          id="header-search"
          size="small"
          placeholder="Search stories..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleSearch}
          sx={{
            width: { xs: 150, sm: 250, md: 300 },
            "& .MuiOutlinedInput-root": {
              bgcolor: "rgba(255, 255, 255, 0.05)",
              borderRadius: 3,
              "& fieldset": { borderColor: "rgba(232, 184, 109, 0.2)" },
              "&:hover fieldset": { borderColor: "rgba(232, 184, 109, 0.4)" },
              "&.Mui-focused fieldset": { borderColor: "primary.main" },
            },
            "& .MuiInputBase-input": {
              py: 0.75,
              fontSize: "0.875rem",
            },
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search sx={{ fontSize: 18, color: "text.secondary" }} />
              </InputAdornment>
            ),
            endAdornment: searchQuery && (
              <InputAdornment position="end">
                <IconButton
                  id="btn-clear-search"
                  size="small"
                  onClick={() => setSearchQuery("")}
                  sx={{ p: 0.25 }}
                >
                  <Close sx={{ fontSize: 16 }} />
                </IconButton>
              </InputAdornment>
            ),
          }}
        />

        {/* Navigation Tabs - hidden on mobile */}
        {!isMobile && !isCreateMode && !isProfileMode && !isStoryViewMode && (
          <Tabs
            id="header-tabs"
            value={tabValue}
            onChange={handleTabChange}
            sx={{
              minHeight: 48,
              flex: 1,
              "& .MuiTab-root": {
                color: "text.secondary",
                minHeight: 48,
                minWidth: 100,
                px: 2,
                fontSize: "0.875rem",
              },
              "& .Mui-selected": { color: "primary.main" },
              "& .MuiTabs-indicator": { backgroundColor: "primary.main" },
            }}
          >
            <Tab
              id="tab-all-stories"
              icon={<MenuBook sx={{ fontSize: 18 }} />}
              iconPosition="start"
              label={<Box sx={{ display: { xs: "none", md: "block" } }}>All Stories</Box>}
            />
            {isAuthenticated && (
              <Tab
                id="tab-favorites"
                icon={<Favorite sx={{ fontSize: 18 }} />}
                iconPosition="start"
                label={<Box sx={{ display: { xs: "none", md: "block" } }}>Favorites</Box>}
              />
            )}
            {isAuthenticated && (
              <Tab
                id="tab-drafts"
                icon={<Edit sx={{ fontSize: 18 }} />}
                iconPosition="start"
                label={<Box sx={{ display: { xs: "none", md: "block" } }}>My Drafts</Box>}
              />
            )}
            {isAuthenticated && (
              <Tab
                id="tab-create"
                icon={<Add sx={{ fontSize: 18 }} />}
                iconPosition="start"
                label={<Box sx={{ display: { xs: "none", md: "block" } }}>Create</Box>}
              />
            )}
          </Tabs>
        )}

        {/* Spacer for mobile when showing nav menu */}
        {isMobile && !isCreateMode && !isProfileMode && !isStoryViewMode && <Box sx={{ flex: 1 }} />}

        {/* Spacer when in special modes */}
        {(isCreateMode || isProfileMode || isStoryViewMode) && <Box sx={{ flex: 1 }} />}

        {/* Create mode indicator */}
        {isCreateMode && (
          <Chip
            icon={<Edit sx={{ fontSize: 16 }} />}
            label="Creating Story"
            size="small"
            sx={{
              bgcolor: "rgba(232, 184, 109, 0.2)",
              color: "primary.main",
              "& .MuiChip-icon": { color: "primary.main" },
            }}
          />
        )}

        {/* Google Login */}
        <GoogleLoginButton />
      </Toolbar>
    </AppBar>
  );
}

export default Header;

