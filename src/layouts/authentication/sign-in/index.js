/**
 * Sign In (Firebase Email/Password)
 * File: layouts/authentication/sign-in/index.js
 */

import { useEffect, useState } from "react";
import { Link, useLocation, Navigate, useNavigate } from "react-router-dom";
import {
  signInWithEmailAndPassword,
  setPersistence,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  inMemoryPersistence,
  sendPasswordResetEmail,
} from "firebase/auth";

import { auth, callLookupEmailByUsername } from "utils/firebase"; // <-- adjust if your path differs
import { useAuth } from "auth/AuthProvider"; // <-- from the provider we added

// @mui
import Card from "@mui/material/Card";
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import Grid from "@mui/material/Grid";
import MuiLink from "@mui/material/Link";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";

// Material Dashboard components
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDInput from "components/MDInput";
import MDButton from "components/MDButton";

// Layout
import BasicLayout from "layouts/authentication/components/BasicLayout";

// Assets
import bgImage from "assets/images/bg-sign-in-basic.jpeg";
import brandWhite from "assets/images/blue-teapot-white.png";

const REMEMBER_PREF_KEY = "bt_remember_me";
const REMEMBER_IDENTIFIER_KEY = "bt_remember_identifier";

function readRememberPreference() {
  try {
    const stored = localStorage.getItem(REMEMBER_PREF_KEY);
    return stored === "false" ? false : true;
  } catch (_err) {
    return true;
  }
}

function persistRememberPreference(remember) {
  try {
    localStorage.setItem(REMEMBER_PREF_KEY, remember ? "true" : "false");
  } catch (_err) {
    // Ignore storage errors in restricted webview contexts.
  }
}

function readRememberedIdentifier() {
  try {
    return localStorage.getItem(REMEMBER_IDENTIFIER_KEY) || "";
  } catch (_err) {
    return "";
  }
}

function persistRememberedIdentifier(identifierToRemember) {
  try {
    const trimmed = identifierToRemember.trim();
    if (trimmed) {
      localStorage.setItem(REMEMBER_IDENTIFIER_KEY, trimmed);
    }
  } catch (_err) {
    // Ignore storage errors in restricted webview contexts.
  }
}

function clearRememberedIdentifier() {
  try {
    localStorage.removeItem(REMEMBER_IDENTIFIER_KEY);
  } catch (_err) {
    // Ignore storage errors in restricted webview contexts.
  }
}

async function applyPersistenceForRemember(remember) {
  const candidates = remember
    ? [
        indexedDBLocalPersistence,
        browserLocalPersistence,
        browserSessionPersistence,
        inMemoryPersistence,
      ]
    : [browserSessionPersistence, inMemoryPersistence];

  let lastError = null;
  for (const persistence of candidates) {
    try {
      await setPersistence(auth, persistence);
      return;
    } catch (err) {
      lastError = err;
    }
  }

  if (lastError) throw lastError;
}

function SignIn() {
  const [identifier, setIdentifier] = useState(() =>
    readRememberPreference() ? readRememberedIdentifier() : ""
  ); // email or username
  const [pw, setPw] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(readRememberPreference);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState(""); // success/info messages
  const [err, setErr] = useState(""); // error messages

  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const rawFrom = location.state?.from;
  const from =
    typeof rawFrom === "string"
      ? rawFrom
      : rawFrom && typeof rawFrom === "object"
      ? rawFrom.pathname || "/"
      : "/";
  const handleSetRememberMe = (event) => setRememberMe(event.target.checked);
  // Save preference whenever it changes
  useEffect(() => {
    persistRememberPreference(rememberMe);
    if (!rememberMe) clearRememberedIdentifier();
  }, [rememberMe]);

  // Resolve a login identifier (email or username) to an email Firebase Auth accepts.
  async function resolveEmailFromIdentifier(rawInput) {
    const trimmed = rawInput.trim();
    if (trimmed.includes("@")) return trimmed;

    // Call backend to resolve without relaxing Firestore rules.
    const { data } = await callLookupEmailByUsername({ username: trimmed });
    if (data?.email) return data.email;

    throw new Error("username-not-found");
  }

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setMsg("");
    setSubmitting(true);
    try {
      // Apply persistence using a fallback chain for mobile webviews and Electron.
      await applyPersistenceForRemember(rememberMe);
      const emailToUse = await resolveEmailFromIdentifier(identifier);
      await signInWithEmailAndPassword(auth, emailToUse, pw);
      if (rememberMe) {
        persistRememberedIdentifier(identifier);
      } else {
        clearRememberedIdentifier();
      }
      // navigation now handled by redirect once user state updates
    } catch (e) {
      const code = e?.code || "";
      let friendly = "Sign-in failed.";
      if (code === "auth/invalid-email") friendly = "That email address looks invalid.";
      else if (code === "auth/user-not-found" || code === "auth/wrong-password")
        friendly = "Email or password is incorrect.";
      else if (code === "auth/too-many-requests")
        friendly = "Too many attempts. Please try again later.";
      else if (code === "functions/not-found" || e?.message === "username-not-found")
        friendly = "Username not found.";
      else if (code === "functions/invalid-argument")
        friendly = "Please enter your email or username.";
      setErr(friendly);
    } finally {
      setSubmitting(false);
    }
  }

  async function onForgotPassword() {
    navigate("/forgot-password");
  }

  if (!loading && user) {
    const destination = !from || from.startsWith("/authentication") ? "/" : from;
    return <Navigate to={destination} replace />;
  }

  return (
    <BasicLayout image={bgImage}>
      <Card>
        <MDBox
          variant="gradient"
          bgColor="primary"
          borderRadius="lg"
          coloredShadow="primary"
          mx={2}
          mt={-3}
          p={4}
          mb={1}
          textAlign="center"
        >
          <MDBox display="flex" justifyContent="center" width="100%">
            <MDBox component="img" src={brandWhite} alt="Blue Teapot" width="10rem" />
          </MDBox>
        </MDBox>

        <MDBox pt={4} pb={3} px={3}>
          <MDBox component="form" role="form" className="ios-no-zoom" onSubmit={onSubmit}>
            <MDBox mb={2}>
              <MDInput
                type="text"
                label="Email or Username"
                fullWidth
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="username"
              />
            </MDBox>

            <MDBox mb={1}>
              <MDInput
                type={showPassword ? "text" : "password"}
                label="Password"
                fullWidth
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                autoComplete="current-password"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        onClick={() => setShowPassword((prev) => !prev)}
                        onMouseDown={(e) => e.preventDefault()}
                        edge="end"
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </MDBox>

            <MDBox display="flex" alignItems="center" ml={-1} mt={1} mb={1}>
              <FormControlLabel
                control={
                  <Switch
                    checked={rememberMe}
                    onChange={handleSetRememberMe}
                    inputProps={{ "aria-label": "Remember me" }}
                  />
                }
                label={
                  <MDTypography variant="button" fontWeight="regular" color="text">
                    Remember me
                  </MDTypography>
                }
                sx={{
                  ml: 0,
                  userSelect: "none",
                  WebkitTapHighlightColor: "transparent",
                  "& .MuiFormControlLabel-label": {
                    lineHeight: 1,
                  },
                }}
              />
            </MDBox>

            <MDBox mt={1} mb={2}>
              <MuiLink component="button" type="button" onClick={onForgotPassword}>
                <MDTypography variant="button" color="info">
                  Forgot password?
                </MDTypography>
              </MuiLink>
            </MDBox>

            {err && (
              <MDBox mt={1} mb={1}>
                <MDTypography variant="caption" color="error">
                  {err}
                </MDTypography>
              </MDBox>
            )}
            {msg && (
              <MDBox mt={1} mb={1}>
                <MDTypography variant="caption" color="success">
                  {msg}
                </MDTypography>
              </MDBox>
            )}

            <MDBox mt={3} mb={1}>
              <MDButton
                type="submit"
                variant="gradient"
                color="primary"
                fullWidth
                disabled={submitting}
              >
                {submitting ? "Signing in…" : "Sign in"}
              </MDButton>
            </MDBox>
          </MDBox>
        </MDBox>
      </Card>
    </BasicLayout>
  );
}

export default SignIn;
