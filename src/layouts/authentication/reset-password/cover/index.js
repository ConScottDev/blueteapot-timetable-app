/**
=========================================================
* Material Dashboard 2 React - v2.2.0
=========================================================

* Product Page: https://www.creative-tim.com/product/material-dashboard-react
* Copyright 2023 Creative Tim (https://www.creative-tim.com)

Coded by www.creative-tim.com

 =========================================================

* The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
*/
import { useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "utils/firebase";
// @mui material components
import Card from "@mui/material/Card";

// Material Dashboard 2 React components
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDInput from "components/MDInput";
import MDButton from "components/MDButton";

// Authentication layout components
import BasicLayout from "layouts/authentication/components/BasicLayout";

// Images
import bgImage from "assets/images/bg-sign-in-basic.jpeg";

const actionCodeSettings = {
  url: `${window.location.origin}/reset-password`, // you’ll handle the link here
  handleCodeInApp: true,
};

function Cover() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setMsg("");
    setErr("");
    if (!email) {
      setErr("Please enter your email address.");
      return;
    }
    setSubmitting(true);
    try {
      await sendPasswordResetEmail(auth, email.trim(), actionCodeSettings);
      // Generic message → prevents account enumeration
      setMsg("If an account exists for that email, we’ve sent a reset link.");
    } catch (e) {
      // Keep response generic
      setMsg("If an account exists for that email, we’ve sent a reset link.");
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <BasicLayout image={bgImage}>
      <Card>
        <MDBox
          variant="gradient"
          bgColor="info"
          borderRadius="lg"
          coloredShadow="success"
          mx={2}
          mt={-3}
          py={2}
          mb={1}
          textAlign="center"
        >
          <MDTypography variant="h3" fontWeight="medium" color="white" mt={1}>
            Reset Password
          </MDTypography>
          <MDTypography display="block" variant="button" color="white" my={1}>
            Enter your email to receive a reset link
          </MDTypography>
        </MDBox>

        <MDBox pt={4} pb={3} px={3}>
          <MDBox component="form" role="form" onSubmit={onSubmit}>
            <MDBox mb={4}>
              <MDInput
                type="email"
                label="Email"
                variant="standard"
                fullWidth
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
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

            <MDBox mt={6} mb={1}>
              <MDButton
                variant="gradient"
                color="info"
                fullWidth
                type="submit"
                disabled={submitting}
              >
                {submitting ? "Sending…" : "Send reset link"}
              </MDButton>
            </MDBox>
          </MDBox>
        </MDBox>
      </Card>
    </BasicLayout>
  );
}

export default Cover;
