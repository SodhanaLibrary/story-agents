import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Box, Container, CircularProgress, Typography } from "@mui/material";
import Header from "./components/Header";
import StoriesPage from "./pages/StoriesPage";
import OpenStoriesPage from "./pages/OpenStoriesPage";
import OpenStoryDetailPage from "./pages/OpenStoryDetailPage";
import AuthorsPage from "./pages/AuthorsPage";
import MessagesPage from "./pages/MessagesPage";
import FavoritesPage from "./pages/FavoritesPage";
import DraftsPage from "./pages/DraftsPage";
import CreateStoryPage from "./pages/CreateStoryPage";
import StoryViewPage from "./pages/StoryViewPage";
import UserProfilePage from "./pages/UserProfilePage";
import AccountPage from "./pages/AccountPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import VerifyEmailPage from "./pages/VerifyEmailPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import VolumeDetailPage from "./pages/VolumeDetailPage";
import PromptLogsPage from "./pages/PromptLogsPage";
import UsageDashboardPage from "./pages/UsageDashboardPage";
import PricingPage from "./pages/PricingPage";
import TeamsPage from "./pages/TeamsPage";
import TeamDetailPage from "./pages/TeamDetailPage";
import AppLogsPage from "./pages/AppLogsPage";
import S3ResourcesPage from "./pages/S3ResourcesPage";
import UserManagementPage from "./pages/UserManagementPage";
import BatchRequestsPage from "./pages/BatchRequestsPage";
import { useAuth } from "./context/AuthContext";

function AppContent() {
  const { loading: authLoading, isAuthenticated, isAdmin } = useAuth();

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
          <Route path="/open-stories" element={<OpenStoriesPage />} />
          <Route path="/open-stories/:id" element={<OpenStoryDetailPage />} />
          <Route path="/authors" element={<AuthorsPage />} />
          <Route path="/story/:storyId" element={<StoryViewPage />} />
          <Route path="/profile/:userId" element={<UserProfilePage />} />
          <Route path="/volume/:volumeId" element={<VolumeDetailPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          {/* Protected routes */}
          <Route
            path="/messages"
            element={
              isAuthenticated ? <MessagesPage /> : <Navigate to="/" replace />
            }
          />
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
            path="/usage-dashboard"
            element={
              isAuthenticated ? <UsageDashboardPage /> : <Navigate to="/" replace />
            }
          />
          <Route path="/pricing" element={<PricingPage />} />
          <Route
            path="/teams"
            element={
              isAuthenticated ? <TeamsPage /> : <Navigate to="/" replace />
            }
          />
          <Route
            path="/teams/:orgId"
            element={
              isAuthenticated ? <TeamDetailPage /> : <Navigate to="/" replace />
            }
          />
          {/* Admin-only routes */}
          <Route
            path="/server-logs"
            element={
              isAuthenticated && isAdmin ? <AppLogsPage /> : <Navigate to="/" replace />
            }
          />
          <Route
            path="/s3-resources"
            element={
              isAuthenticated && isAdmin ? <S3ResourcesPage /> : <Navigate to="/" replace />
            }
          />
          <Route
            path="/user-management"
            element={
              isAuthenticated && isAdmin ? <UserManagementPage /> : <Navigate to="/" replace />
            }
          />
          <Route
            path="/batch-requests"
            element={
              isAuthenticated ? <BatchRequestsPage /> : <Navigate to="/" replace />
            }
          />
          <Route
            path="/account"
            element={
              isAuthenticated ? <AccountPage /> : <Navigate to="/login" replace />
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
