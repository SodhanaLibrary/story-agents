import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#E8B86D",
      light: "#F0C989",
      dark: "#C99A4E",
      contrastText: "#1A1A2E",
    },
    secondary: {
      main: "#7B68EE",
      light: "#9B8DF2",
      dark: "#5B48CE",
    },
    background: {
      default: "#0F0F1A",
      paper: "#1A1A2E",
    },
    text: {
      primary: "#F5F5F5",
      secondary: "#A0A0B0",
    },
    success: {
      main: "#4CAF50",
    },
    warning: {
      main: "#FF9800",
    },
    error: {
      main: "#F44336",
    },
  },
  typography: {
    fontFamily: '"DM Sans", "Segoe UI", Roboto, sans-serif',
    h1: {
      fontFamily: '"Crimson Pro", Georgia, serif',
      fontWeight: 700,
      fontSize: "3.5rem",
    },
    h2: {
      fontFamily: '"Crimson Pro", Georgia, serif',
      fontWeight: 600,
      fontSize: "2.5rem",
    },
    h3: {
      fontFamily: '"Crimson Pro", Georgia, serif',
      fontWeight: 600,
      fontSize: "2rem",
    },
    h4: {
      fontWeight: 600,
      fontSize: "1.5rem",
    },
    h5: {
      fontWeight: 600,
      fontSize: "1.25rem",
    },
    h6: {
      fontWeight: 600,
      fontSize: "1rem",
    },
    button: {
      textTransform: "none",
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: "10px 24px",
        },
        containedPrimary: {
          background: "linear-gradient(135deg, #E8B86D 0%, #C99A4E 100%)",
          "&:hover": {
            background: "linear-gradient(135deg, #F0C989 0%, #E8B86D 100%)",
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          backgroundColor: "#1A1A2E",
          border: "1px solid rgba(232, 184, 109, 0.15)",
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            "& fieldset": {
              borderColor: "rgba(232, 184, 109, 0.3)",
            },
            "&:hover fieldset": {
              borderColor: "rgba(232, 184, 109, 0.5)",
            },
            "&.Mui-focused fieldset": {
              borderColor: "#E8B86D",
            },
          },
        },
      },
    },
  },
});

export default theme;

