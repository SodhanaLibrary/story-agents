import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  TextField,
  InputAdornment,
  CircularProgress,
  Avatar,
  Chip,
} from "@mui/material";
import { Search, MenuBook, Person } from "@mui/icons-material";

function AuthorsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const qParam = searchParams.get("q") || "";

  const [authors, setAuthors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState(qParam);

  const fetchAuthors = useCallback(async (search, replaceUrl = false) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search && search.trim()) params.set("q", search.trim());
      params.set("limit", "48");
      const res = await fetch(`/api/authors?${params.toString()}`);
      const data = await res.json();
      setAuthors(data.authors || []);
      if (replaceUrl) {
        const next = search && search.trim() ? { q: search.trim() } : {};
        setSearchParams(next, { replace: true });
      }
    } catch (err) {
      console.error("Failed to fetch authors:", err);
      setAuthors([]);
    } finally {
      setLoading(false);
    }
  }, [setSearchParams]);

  useEffect(() => {
    fetchAuthors(qParam);
  }, [qParam, fetchAuthors]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchAuthors(searchInput, true);
  };

  return (
    <Box className="fade-in">
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 2,
          mb: 2,
        }}
      >
        <Typography
          variant="h4"
          sx={{ fontFamily: '"Crimson Pro", serif', fontWeight: 700 }}
        >
          Authors
        </Typography>
        <Box component="form" onSubmit={handleSearchSubmit} sx={{ flex: 1, minWidth: 200, maxWidth: 360 }}>
        <TextField
          id="input-authors-search"
          fullWidth
          size="small"
          placeholder="Search by name or username..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearchSubmit(e)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search sx={{ color: "text.secondary" }} />
                </InputAdornment>
              ),
            }}
            sx={{
              "& .MuiOutlinedInput-root": {
                bgcolor: "action.hover",
                borderRadius: 2,
              },
            }}
          />
        </Box>
      </Box>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Discover writers who have published stories on Story Agents.
      </Typography>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress sx={{ color: "primary.main" }} />
        </Box>
      ) : authors.length === 0 ? (
        <Box sx={{ textAlign: "center", py: 8 }}>
          <Person sx={{ fontSize: 64, color: "text.secondary", opacity: 0.5, mb: 2 }} />
          <Typography variant="h6" color="text.secondary">
            No authors found
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {qParam ? "Try a different search." : "No one has published a public story yet."}
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={3}>
          {authors.map((author) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={author.id}>
              <Card
                id={`card-author-${author.id}`}
                sx={{
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  bgcolor: "rgba(30, 30, 50, 0.6)",
                  backdropFilter: "blur(10px)",
                  border: "1px solid rgba(232, 184, 109, 0.15)",
                  transition: "all 0.3s ease",
                  cursor: "pointer",
                  "&:hover": {
                    transform: "translateY(-4px)",
                    boxShadow: "0 8px 32px rgba(232, 184, 109, 0.15)",
                  },
                }}
                onClick={() => navigate(`/profile/${author.id}`)}
              >
                <CardContent sx={{ flexGrow: 1, p: 2, textAlign: "center" }}>
                  <Avatar
                    src={author.picture}
                    alt={author.name}
                    sx={{
                      width: 80,
                      height: 80,
                      mx: "auto",
                      mb: 1.5,
                      border: "2px solid",
                      borderColor: "primary.main",
                    }}
                  >
                    {(author.name || author.username || "?").charAt(0)}
                  </Avatar>
                  <Typography
                    variant="subtitle1"
                    sx={{ fontWeight: 600, mb: 0.5 }}
                    noWrap
                  >
                    {author.name || author.username || "Anonymous"}
                  </Typography>
                  {author.username && author.name && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      @{author.username}
                    </Typography>
                  )}
                  <Chip
                    icon={<MenuBook sx={{ fontSize: 14 }} />}
                    label={`${author.story_count} ${author.story_count === 1 ? "story" : "stories"}`}
                    size="small"
                    sx={{
                      bgcolor: "rgba(232, 184, 109, 0.15)",
                      color: "primary.main",
                      "& .MuiChip-icon": { color: "primary.main" },
                    }}
                  />
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}

export default AuthorsPage;
