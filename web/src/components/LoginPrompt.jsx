import { Box, Typography, Paper, Divider } from "@mui/material";
import { AutoStories, Brush, Person, MenuBook } from "@mui/icons-material";
import { GoogleLogin } from "@react-oauth/google";
import { jwtDecode } from "jwt-decode";
import { useAuth } from "../context/AuthContext";

export default function LoginPrompt() {
  const { login } = useAuth();

  const handleSuccess = (credentialResponse) => {
    try {
      const decoded = jwtDecode(credentialResponse.credential);
      const userData = {
        email: decoded.email,
        name: decoded.name,
        picture: decoded.picture,
        sub: decoded.sub,
        exp: decoded.exp,
      };
      login(userData);
    } catch (error) {
      console.error("Failed to decode Google credential:", error);
    }
  };

  const handleError = () => {
    console.error("Google Login Failed");
  };

  const features = [
    {
      icon: <AutoStories sx={{ fontSize: 40, color: "primary.main" }} />,
      title: "AI Story Generation",
      description: "Transform your ideas into beautifully illustrated storybooks",
    },
    {
      icon: <Brush sx={{ fontSize: 40, color: "secondary.main" }} />,
      title: "11+ Art Styles",
      description: "Choose from Manga, Anime, Comic, Illustration and more",
    },
    {
      icon: <Person sx={{ fontSize: 40, color: "success.main" }} />,
      title: "Character Avatars",
      description: "AI generates unique avatars for each character",
    },
    {
      icon: <MenuBook sx={{ fontSize: 40, color: "info.main" }} />,
      title: "Story Library",
      description: "Save, edit, and revisit your illustrated stories",
    },
  ];

  return (
    <Box
      sx={{
        minHeight: "70vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        py: 4,
      }}
    >
      {/* Hero Section */}
      <Box sx={{ textAlign: "center", mb: 6 }}>
        <Typography
          variant="h2"
          sx={{
            fontFamily: '"Crimson Pro", serif',
            fontWeight: 700,
            mb: 2,
            background: "linear-gradient(135deg, #E8B86D 0%, #F5D49A 50%, #E8B86D 100%)",
            backgroundClip: "text",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          Story Agents
        </Typography>
        <Typography
          variant="h5"
          sx={{ color: "text.secondary", mb: 4, maxWidth: 500 }}
        >
          Create AI-powered illustrated storybooks with a few clicks
        </Typography>
      </Box>

      {/* Login Card */}
      <Paper
        elevation={0}
        sx={{
          p: 4,
          borderRadius: 3,
          bgcolor: "rgba(26, 26, 46, 0.8)",
          border: "1px solid",
          borderColor: "divider",
          textAlign: "center",
          minWidth: 320,
        }}
      >
        <Typography variant="h6" sx={{ mb: 1 }}>
          Get Started
        </Typography>
        <Typography variant="body2" sx={{ color: "text.secondary", mb: 3 }}>
          Sign in to create and save your stories
        </Typography>

        <Box sx={{ display: "flex", justifyContent: "center" }}>
          <GoogleLogin
            onSuccess={handleSuccess}
            onError={handleError}
            useOneTap
            theme="filled_black"
            shape="pill"
            size="large"
            text="continue_with"
            locale="en"
          />
        </Box>
      </Paper>

      {/* Features Grid */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(4, 1fr)" },
          gap: 3,
          mt: 8,
          maxWidth: 900,
        }}
      >
        {features.map((feature) => (
          <Box
            key={feature.title}
            sx={{
              textAlign: "center",
              p: 2,
            }}
          >
            {feature.icon}
            <Typography variant="subtitle1" sx={{ mt: 1, fontWeight: 600 }}>
              {feature.title}
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
              {feature.description}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

