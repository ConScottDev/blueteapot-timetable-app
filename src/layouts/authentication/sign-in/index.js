/**
 * Sign In (Firebase Email/Password)
 * File: layouts/authentication/sign-in/index.js
 */

import { useEffect, useState } from "react";
import { Link, useLocation, Navigate, useNavigate } from "react-router-dom";
import {
  signInWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  sendPasswordResetEmail,
} from "firebase/auth";

import { auth, callLookupEmailByUsername } from "utils/firebase"; // <-- adjust if your path differs
import { useAuth } from "auth/AuthProvider"; // <-- from the provider we added

// @mui
import Card from "@mui/material/Card";
import Switch from "@mui/material/Switch";
import Grid from "@mui/material/Grid";
import MuiLink from "@mui/material/Link";

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

function SignIn() {
  const [identifier, setIdentifier] = useState(""); // email or username
  const [pw, setPw] = useState("");
  const [rememberMe, setRememberMe] = useState(() => {
    // Persist remember choice so desktop/native wrappers keep it across reloads
    const stored = localStorage.getItem("bt_remember_me");
    return stored === "false" ? false : true;
  });
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
  const handleSetRememberMe = () => setRememberMe((v) => !v);
  // Save preference whenever it changes
  useEffect(() => {
    localStorage.setItem("bt_remember_me", rememberMe ? "true" : "false");
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
      // Remember me = persist in local storage; otherwise session only.
      // If not supported (e.g., some native/webview contexts), fall back to default persistence.
      try {
        await setPersistence(
          auth,
          rememberMe ? browserLocalPersistence : browserSessionPersistence
        );
      } catch (pErr) {
        console.warn("Persistence selection failed, continuing with default:", pErr);
      }
      const emailToUse = await resolveEmailFromIdentifier(identifier);
      await signInWithEmailAndPassword(auth, emailToUse, pw);
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
          <MDBox component="form" role="form" onSubmit={onSubmit}>
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
                type="password"
                label="Password"
                fullWidth
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                autoComplete="current-password"
              />
            </MDBox>

            <MDBox display="flex" alignItems="center" ml={-1} mt={1} mb={1}>
              <Switch checked={rememberMe} onChange={handleSetRememberMe} />
              <MDTypography
                variant="button"
                fontWeight="regular"
                color="text"
                onClick={handleSetRememberMe}
                sx={{ cursor: "pointer", userSelect: "none", ml: -1 }}
              >
                &nbsp;&nbsp;Remember me
              </MDTypography>
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
