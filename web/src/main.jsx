import React from "react";
import ReactDOM from "react-dom/client";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { GoogleOAuthProvider } from "@react-oauth/google";
import App from "./App";
import theme from "./theme";
import { AuthProvider } from "./context/AuthContext";
import "./index.css";

// Get configuration from environment variables
// Can be accessed via import.meta.env or window.STORY_AGENTS_CONFIG
const config = window.STORY_AGENTS_CONFIG || {};
const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID || config.googleClientId || "";

if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID.includes("%VITE_")) {
  console.warn(
    "VITE_GOOGLE_CLIENT_ID is not set. Google Login will not work.\n" +
      "Create a .env file in the web/ directory with:\n" +
      "VITE_GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com"
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID || ""}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthProvider>
          <App />
        </AuthProvider>
      </ThemeProvider>
    </GoogleOAuthProvider>
  </React.StrictMode>
);
