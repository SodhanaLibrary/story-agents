import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Box,
  List,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Typography,
  TextField,
  InputAdornment,
  Button,
  CircularProgress,
  Paper,
  Divider,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { Send, Message as MessageIcon, ArrowBack, Search } from "@mui/icons-material";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";

const SEARCH_DEBOUNCE_MS = 300;

function MessagesPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const withUserId = searchParams.get("with");
  const { isAuthenticated, userId } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selectedOther, setSelectedOther] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const messagesEndRef = useRef(null);

  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [userSearchResults, setUserSearchResults] = useState([]);
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const searchDebounceRef = useRef(null);

  const fetchConversations = useCallback(async () => {
    if (!userId) return;
    setLoadingConversations(true);
    try {
      const res = await api.get("/api/v1/messages/conversations");
      const data = await res.json();
      setConversations(data.conversations || []);
    } catch (err) {
      console.error("Failed to fetch conversations:", err);
    } finally {
      setLoadingConversations(false);
    }
  }, [userId]);

  const fetchMessages = useCallback(
    async (otherId) => {
      if (!userId || !otherId) return;
      setLoadingMessages(true);
      try {
        const res = await api.get(`/api/v1/messages/with/${otherId}`);
        const data = await res.json();
        setMessages(data.messages || []);
        await api.patch(`/api/v1/messages/with/${otherId}/read`);
        setConversations((prev) =>
          prev.map((c) =>
            c.other_id === otherId ? { ...c, unread_count: 0 } : c,
          ),
        );
      } catch (err) {
        console.error("Failed to fetch messages:", err);
      } finally {
        setLoadingMessages(false);
      }
    },
    [userId],
  );

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const runUserSearch = useCallback(async (query) => {
    if (!userId) return;
    setUserSearchLoading(true);
    try {
      const res = await api.get(
        `/api/v1/users/search?q=${encodeURIComponent(query || "")}&limit=20`,
      );
      const data = await res.json();
      setUserSearchResults(data.users || []);
    } catch (err) {
      console.error("Failed to search users:", err);
      setUserSearchResults([]);
    } finally {
      setUserSearchLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (!userId) return;
    const q = userSearchQuery.trim();
    const timer = setTimeout(() => {
      if (q.length === 0) {
        setUserSearchResults([]);
        return;
      }
      runUserSearch(q);
    }, q.length === 0 ? 0 : SEARCH_DEBOUNCE_MS);
    searchDebounceRef.current = timer;
    return () => clearTimeout(timer);
  }, [userSearchQuery, userId, runUserSearch]);

  useEffect(() => {
    const id = withUserId ? parseInt(withUserId, 10) : null;
    if (!id) return;
    const conv = conversations.find((c) => c.other_id === id);
    if (conv) {
      setSelectedOther(conv);
      return;
    }
    if (conversations.length >= 0 && id !== userId) {
      fetch(`/api/v1/users/${id}/profile`)
        .then((r) => r.json())
        .then((data) => {
          if (data.profile)
            setSelectedOther({
              other_id: data.profile.id,
              other_name: data.profile.name,
              other_username: data.profile.username,
              other_picture: data.profile.picture,
              last_body: null,
              unread_count: 0,
            });
        })
        .catch(() => {});
    }
  }, [withUserId, conversations, userId]);

  useEffect(() => {
    if (selectedOther) fetchMessages(selectedOther.other_id);
  }, [selectedOther?.other_id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSelectConversation = (conv) => {
    setSelectedOther(conv);
    navigate(`/messages?with=${conv.other_id}`, { replace: true });
  };

  const handleSelectSearchUser = (user) => {
    const other = {
      other_id: user.id,
      other_name: user.name,
      other_username: user.username,
      other_picture: user.picture,
      last_body: null,
      unread_count: 0,
    };
    setSelectedOther(other);
    setUserSearchQuery("");
    setUserSearchResults([]);
    navigate(`/messages?with=${user.id}`, { replace: true });
  };

  const handleSend = async () => {
    if (!replyText.trim() || !selectedOther || sending) return;
    setSending(true);
    try {
      const res = await api.post("/api/v1/messages", {
        recipientId: selectedOther.other_id,
        body: replyText.trim(),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, data]);
      setReplyText("");
      fetchConversations();
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      });
    }
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  if (!isAuthenticated) {
    return (
      <Box sx={{ textAlign: "center", py: 8 }}>
        <Typography variant="h6" color="text.secondary">
          Sign in to view messages
        </Typography>
        <Button id="btn-messages-go-home" variant="contained" onClick={() => navigate("/")} sx={{ mt: 2 }}>
          Go home
        </Button>
      </Box>
    );
  }

  return (
    <Box className="fade-in" sx={{ display: "flex", flexDirection: "column", height: "calc(100vh - 120px)", minHeight: 400 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
        <Button
          id="btn-messages-back"
          startIcon={<ArrowBack />}
          onClick={() => navigate("/")}
          sx={{ color: "text.secondary" }}
        >
          Back
        </Button>
        <Typography variant="h5" sx={{ fontFamily: '"Crimson Pro", serif', fontWeight: 700 }}>
          Messages
        </Typography>
      </Box>

      <Box sx={{ display: "flex", flex: 1, minHeight: 0, gap: 2 }}>
        {/* Conversation list */}
        <Paper
          elevation={0}
          sx={{
            width: isMobile && selectedOther ? 0 : 280,
            minWidth: isMobile && selectedOther ? 0 : 280,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 2,
          }}
        >
          <Box sx={{ p: 1.5, borderBottom: "1px solid", borderColor: "divider" }}>
            <TextField
              id="input-messages-search-users"
              fullWidth
              size="small"
              placeholder="Search all users..."
              value={userSearchQuery}
              onChange={(e) => setUserSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search sx={{ fontSize: 20, color: "text.secondary" }} />
                  </InputAdornment>
                ),
                endAdornment: userSearchLoading ? (
                  <InputAdornment position="end">
                    <CircularProgress size={18} />
                  </InputAdornment>
                ) : null,
              }}
              sx={{
                "& .MuiOutlinedInput-root": {
                  bgcolor: "action.hover",
                  borderRadius: 2,
                },
              }}
            />
          </Box>
          {userSearchResults.length > 0 ? (
            <List disablePadding sx={{ overflow: "auto", flex: 1 }}>
              {userSearchResults.map((user) => (
                <ListItemButton
                  id={`btn-select-user-${user.id}`}
                  key={user.id}
                  onClick={() => handleSelectSearchUser(user)}
                >
                  <ListItemAvatar>
                    <Avatar
                      src={user.picture}
                      alt={user.name}
                      sx={{ width: 44, height: 44 }}
                    />
                  </ListItemAvatar>
                  <ListItemText
                    primary={user.name || user.username || "User"}
                    secondary={user.username && user.name ? `@${user.username}` : null}
                  />
                </ListItemButton>
              ))}
            </List>
          ) : loadingConversations ? (
            <Box sx={{ p: 3, textAlign: "center" }}>
              <CircularProgress size={24} />
            </Box>
          ) : conversations.length === 0 ? (
            <Box sx={{ p: 3, textAlign: "center" }}>
              <MessageIcon sx={{ fontSize: 48, color: "text.secondary", opacity: 0.5, mb: 1 }} />
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                No conversations yet. Search users above or browse all.
              </Typography>
              <Button
                id="btn-messages-browse-all-users"
                size="small"
                variant="outlined"
                onClick={() => runUserSearch("")}
                disabled={userSearchLoading}
              >
                {userSearchLoading ? "Loading..." : "Browse all users"}
              </Button>
            </Box>
          ) : (
            <List disablePadding sx={{ overflow: "auto", flex: 1 }}>
              {conversations.map((conv) => (
                <ListItemButton
                  id={`btn-conversation-${conv.other_id}`}
                  key={conv.other_id}
                  selected={selectedOther?.other_id === conv.other_id}
                  onClick={() => handleSelectConversation(conv)}
                >
                  <ListItemAvatar>
                    <Avatar
                      src={conv.other_picture}
                      alt={conv.other_name}
                      sx={{ width: 44, height: 44 }}
                    />
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Typography variant="body1" noWrap>
                          {conv.other_name || conv.other_username || "User"}
                        </Typography>
                        {conv.unread_count > 0 && (
                          <Typography
                            variant="caption"
                            sx={{
                              bgcolor: "primary.main",
                              color: "primary.contrastText",
                              px: 1,
                              borderRadius: 1,
                            }}
                          >
                            {conv.unread_count}
                          </Typography>
                        )}
                      </Box>
                    }
                    secondary={
                      <Typography variant="body2" color="text.secondary" noWrap>
                        {conv.last_sender_id === userId ? "You: " : ""}
                        {conv.last_body || "No messages yet"}
                      </Typography>
                    }
                  />
                </ListItemButton>
              ))}
            </List>
          )}
        </Paper>

        {/* Thread */}
        <Paper
          elevation={0}
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 2,
            overflow: "hidden",
            minWidth: 0,
          }}
        >
          {!selectedOther ? (
            <Box
              sx={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "column",
                color: "text.secondary",
              }}
            >
              <MessageIcon sx={{ fontSize: 64, opacity: 0.3, mb: 1 }} />
              <Typography variant="body1">Select a conversation or message someone from their profile.</Typography>
            </Box>
          ) : (
            <>
              <Box
                sx={{
                  p: 2,
                  borderBottom: "1px solid",
                  borderColor: "divider",
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                }}
              >
                {isMobile && (
                  <Button
                    id="btn-messages-thread-back"
                    size="small"
                    startIcon={<ArrowBack />}
                    onClick={() => {
                      setSelectedOther(null);
                      navigate("/messages", { replace: true });
                    }}
                  >
                    Back
                  </Button>
                )}
                <Avatar
                  src={selectedOther.other_picture}
                  alt={selectedOther.other_name}
                  sx={{ width: 36, height: 36 }}
                />
                <Typography variant="subtitle1">
                  {selectedOther.other_name || selectedOther.other_username || "User"}
                </Typography>
              </Box>

              <List sx={{ flex: 1, overflow: "auto", p: 2 }}>
                {loadingMessages ? (
                  <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                    <CircularProgress size={24} />
                  </Box>
                ) : (
                  messages.map((m) => (
                    <Box
                      key={m.id}
                      sx={{
                        display: "flex",
                        justifyContent: m.sender_id === userId ? "flex-end" : "flex-start",
                        mb: 1.5,
                      }}
                    >
                      <Paper
                        elevation={0}
                        sx={{
                          maxWidth: "75%",
                          px: 2,
                          py: 1,
                          bgcolor: m.sender_id === userId ? "primary.main" : "action.hover",
                          color: m.sender_id === userId ? "primary.contrastText" : "text.primary",
                          borderRadius: 2,
                        }}
                      >
                        <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                          {m.body}
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{
                            opacity: 0.8,
                            display: "block",
                            mt: 0.5,
                          }}
                        >
                          {formatTime(m.created_at)}
                        </Typography>
                      </Paper>
                    </Box>
                  ))
                )}
                <div ref={messagesEndRef} />
              </List>

              <Divider />
              <Box sx={{ p: 2, display: "flex", gap: 1 }}>
                <TextField
                  id="input-message-reply"
                  fullWidth
                  size="small"
                  placeholder="Type a message..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  disabled={sending}
                />
                <Button
                  id="btn-send-message"
                  variant="contained"
                  endIcon={sending ? <CircularProgress size={18} /> : <Send />}
                  onClick={handleSend}
                  disabled={!replyText.trim() || sending}
                >
                  Send
                </Button>
              </Box>
            </>
          )}
        </Paper>
      </Box>
    </Box>
  );
}

export default MessagesPage;
