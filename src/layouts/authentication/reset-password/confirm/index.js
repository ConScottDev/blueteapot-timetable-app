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
            <MDBox mt={2}>
              <MDButton
                variant="gradient"
                color="primary"
                fullWidth
                onClick={() => navigate("/authentication/sign-in")}
              >
                Back to sign in
              </MDButton>
            </MDBox>
          </MDBox>
        </Card>
      </BasicLayout>
    );
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
          p={3}
          mb={1}
          textAlign="center"
        >
          <MDTypography variant="h4" fontWeight="medium" color="white">
            Reset password
          </MDTypography>
        </MDBox>

        <MDBox pt={4} pb={3} px={3} component="form" onSubmit={onSubmit}>
          <MDTypography variant="button" color="text" mb={2} display="block">
            Set a new password for <strong>{email}</strong>
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
            <MDButton
              type="submit"
              variant="gradient"
              color="primary"
              fullWidth
              disabled={submitting}
            >
              {submitting ? "Updating…" : "Set new password"}
            </MDButton>
          </MDBox>
          <MDBox mt={2}>
            <MDButton
              variant="text"
              color="primary"
              fullWidth
              type="button"
              onClick={() => navigate("/authentication/sign-in")}
            >
              Back to sign in
            </MDButton>
          </MDBox>
        </MDBox>
      </Card>
    </BasicLayout>
  );
}
