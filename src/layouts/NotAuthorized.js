// src/layouts/NotAuthorized.jsx
import { useNavigate } from "react-router-dom";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import { useAuth } from "auth/AuthProvider";

export default function NotAuthorized() {
  const { signOutNow } = useAuth();
  const navigate = useNavigate();

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox
        py={8}
        px={3}
        display="flex"
        flexDirection="column"
        alignItems="center"
        textAlign="center"
        sx={{ gap: 2 }}
      >
        <MDTypography variant="h4" color="text">
          You don&apos;t have access to this area.
        </MDTypography>
        <MDTypography variant="body1" color="text">
          If you believe this is a mistake, please contact an administrator to have the correct role
          assigned to your account.
        </MDTypography>
        <MDBox display="flex" gap={2} flexWrap="wrap" justifyContent="center">
          <MDButton
            color="primary"
            variant="contained"
            onClick={() => navigate("/", { replace: true })}
          >
            Go to home
          </MDButton>
          <MDButton color="error" variant="outlined" onClick={signOutNow}>
            Sign out
          </MDButton>
        </MDBox>
      </MDBox>
    </DashboardLayout>
  );
}
