// layouts/authentication/reset-password/confirm/index.js
import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  verifyPasswordResetCode,
  confirmPasswordReset,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { auth } from "utils/firebase";

import Card from "@mui/material/Card";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDInput from "components/MDInput";
import MDButton from "components/MDButton";
import BasicLayout from "layouts/authentication/components/BasicLayout";
import bgImage from "assets/images/bg-reset-cover.jpeg";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const mode = params.get("mode");
  const oobCode = params.get("oobCode");

  useEffect(() => {
    (async () => {
      try {
        if (mode !== "resetPassword" || !oobCode) throw new Error();
        const emailFromCode = await verifyPasswordResetCode(auth, oobCode);
        setEmail(emailFromCode);
      } catch {
        setErr("This password reset link is invalid or has expired.");
      } finally {
        setLoading(false);
      }
    })();
  }, [mode, oobCode]);

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setMsg("");
    if (pw.length < 6) return setErr("Password must be at least 6 characters.");
    if (pw !== pw2) return setErr("Passwords do not match.");
    setSubmitting(true);
    try {
      await confirmPasswordReset(auth, oobCode, pw);
      setMsg("Password updated. Signing you in…");
      // Optional convenience login:
      await signInWithEmailAndPassword(auth, email, pw);
      navigate("/", { replace: true });
    } catch {
      setErr("Could not reset your password. Request a new link and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <BasicLayout image={bgImage}>
        <Card>
          <MDBox p={4}>
            <MDTypography variant="h6">Checking your reset link…</MDTypography>
          </MDBox>
        </Card>
      </BasicLayout>
    );
  }

  if (err) {
    return (
      <BasicLayout image={bgImage}>
        <Card>
          <MDBox p={4}>
            <MDTypography variant="h6" color="error">
              {err}
            </MDTypography>
          </MDBox>
        </Card>
      </BasicLayout>
    );
  }

  return (
    <BasicLayout image={bgImage}>
      <Card>
        <MDBox p={4} component="form" onSubmit={onSubmit}>
          <MDTypography variant="h5" mb={1}>
            Set a new password
          </MDTypography>
          <MDTypography variant="button" color="text" mb={2} display="block">
            for <strong>{email}</strong>
          </MDTypography>

          <MDBox mb={2}>
            <MDInput
              type="password"
              label="New password"
              fullWidth
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              autoComplete="new-password"
            />
          </MDBox>
          <MDBox mb={2}>
            <MDInput
              type="password"
              label="Confirm new password"
              fullWidth
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              autoComplete="new-password"
            />
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

          <MDBox mt={3}>
            <MDButton type="submit" variant="gradient" color="info" fullWidth disabled={submitting}>
              {submitting ? "Updating…" : "Set new password"}
            </MDButton>
          </MDBox>
        </MDBox>
      </Card>
    </BasicLayout>
  );
}
