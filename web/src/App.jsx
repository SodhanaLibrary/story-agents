import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Box, Container, CircularProgress, Typography } from "@mui/material";
import Header from "./components/Header";
import StoriesPage from "./pages/StoriesPage";
import FavoritesPage from "./pages/FavoritesPage";
import DraftsPage from "./pages/DraftsPage";
import CreateStoryPage from "./pages/CreateStoryPage";
import StoryViewPage from "./pages/StoryViewPage";
import UserProfilePage from "./pages/UserProfilePage";
import PromptLogsPage from "./pages/PromptLogsPage";
import BatchRequestsPage from "./pages/BatchRequestsPage";
import { useAuth } from "./context/AuthContext";

function AppContent() {
  const { loading: authLoading, isAuthenticated } = useAuth();

  if (authLoading) {
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
        }}
      >
        <CircularProgress sx={{ color: "primary.main", mb: 2 }} />
        <Typography>Loading...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Header />

      <Container maxWidth="lg" sx={{ py: 4, flex: 1 }}>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<StoriesPage />} />
          <Route path="/stories" element={<StoriesPage />} />
          <Route path="/story/:storyId" element={<StoryViewPage />} />
          <Route path="/profile/:userId" element={<UserProfilePage />} />

          {/* Protected routes */}
          <Route
            path="/favorites"
            element={
              isAuthenticated ? <FavoritesPage /> : <Navigate to="/" replace />
            }
          />
          <Route
            path="/drafts"
            element={
              isAuthenticated ? <DraftsPage /> : <Navigate to="/" replace />
            }
          />
          <Route
            path="/create"
            element={
              isAuthenticated ? (
                <CreateStoryPage />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          <Route
            path="/story/:storyId/edit"
            element={
              isAuthenticated ? (
                <CreateStoryPage isEditing />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          <Route
            path="/prompt-logs"
            element={
              isAuthenticated ? <PromptLogsPage /> : <Navigate to="/" replace />
            }
          />
          <Route
            path="/batch-requests"
            element={
              isAuthenticated ? <BatchRequestsPage /> : <Navigate to="/" replace />
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Container>

      {/* Footer */}
      <Box
        component="footer"
        sx={{
          py: 3,
          borderTop: "1px solid rgba(232, 184, 109, 0.1)",
          textAlign: "center",
        }}
      >
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          Powered by OpenAI GPT-4 &amp; DALL-E 3 • Story Agents v1.0
        </Typography>
      </Box>
    </Box>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
