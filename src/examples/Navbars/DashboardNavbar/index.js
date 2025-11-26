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
import { useNavigate } from "react-router-dom";
import { useAuth } from "auth/AuthProvider";

import { useState, useEffect } from "react";

// react-router components
import { useLocation, Link } from "react-router-dom";

// prop-types is a library for typechecking of props.
import PropTypes from "prop-types";

// @material-ui core components
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import Icon from "@mui/material/Icon";
// Material Dashboard 2 React components
import MDBox from "components/MDBox";
import MDInput from "components/MDInput";

import AccountCircleIcon from "@mui/icons-material/AccountCircle";

// Material Dashboard 2 React example components
import Breadcrumbs from "examples/Breadcrumbs";
import NotificationItem from "examples/Items/NotificationItem";

// Custom styles for DashboardNavbar
import {
  navbar,
  navbarContainer,
  navbarRow,
  navbarIconButton,
  navbarMobileMenu,
} from "examples/Navbars/DashboardNavbar/styles";

// Material Dashboard 2 React context
import {
  useMaterialUIController,
  setTransparentNavbar,
  setMiniSidenav,
  setOpenConfigurator,
} from "context";
import MenuOpenIcon from "@mui/icons-material/MenuOpen";
import MenuIcon from "@mui/icons-material/Menu";
import LogoutIcon from "@mui/icons-material/Logout";

function DashboardNavbar({ absolute, light, isMini }) {
  const [navbarType, setNavbarType] = useState();
  const [controller, dispatch] = useMaterialUIController();
  const { miniSidenav, transparentNavbar, fixedNavbar, openConfigurator, darkMode } = controller;
  const [openMenu, setOpenMenu] = useState(false);
  const route = useLocation().pathname.split("/").slice(1);

  useEffect(() => {
    setNavbarType("static");
    // if (fixedNavbar) {
    //   setNavbarType("sticky");
    // } else {
    //   setNavbarType("static");
    // }

    // // A function that sets the transparent state of the navbar.
    // function handleTransparentNavbar() {
    //   setTransparentNavbar(dispatch, (fixedNavbar && window.scrollY === 0) || !fixedNavbar);
    // }

    // /**
    //  The event listener that's calling the handleTransparentNavbar function when
    //  scrolling the window.
    // */
    // window.addEventListener("scroll", handleTransparentNavbar);

    // // Call the handleTransparentNavbar function to set the state with the initial value.
    // handleTransparentNavbar();

    // // Remove event listener on cleanup
    // return () => window.removeEventListener("scroll", handleTransparentNavbar);
  }, [dispatch, fixedNavbar]);

  const { signOutNow } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      // close the menu if you keep anchor state
      setOpenMenu(null); // or whatever your state setter is
      await signOutNow(); // calls Firebase auth.signOut()
      navigate("/authentication/sign-in", { replace: true });
    } catch (e) {
      console.error("Sign-out failed", e);
    }
  };

  const handleMiniSidenav = () => setMiniSidenav(dispatch, !miniSidenav);
  const handleConfiguratorOpen = () => setOpenConfigurator(dispatch, !openConfigurator);
  const handleOpenMenu = (event) => setOpenMenu(event.currentTarget);
  const handleCloseMenu = () => setOpenMenu(false);

  // Render the notifications menu
  const renderMenu = () => (
    <Menu
      anchorEl={openMenu}
      anchorReference={null}
      anchorOrigin={{
        vertical: "bottom",
        horizontal: "left",
      }}
      open={Boolean(openMenu)}
      onClose={handleCloseMenu}
      sx={{ mt: 2 }}
    >
      <NotificationItem
        icon={
          <Icon>
            <LogoutIcon></LogoutIcon>
          </Icon>
        }
        title="Logout"
        onClick={handleLogout}
      />
    </Menu>
  );

  // Styles for the navbar icons
  const iconsStyle = ({ palette: { dark, white, text }, functions: { rgba } }) => ({
    color: () => {
      let colorValue = light || darkMode ? white.main : dark.main;

      if (transparentNavbar && !light) {
        colorValue = darkMode ? rgba(text.main, 0.6) : text.main;
      }

      return colorValue;
    },
  });

  return (
    <AppBar
      position={absolute ? "absolute" : navbarType}
      color="inherit"
      sx={(theme) => navbar(theme, { transparentNavbar, absolute, light, darkMode })}
    >
      <Toolbar sx={(theme) => navbarContainer(theme)}>
        <MDBox
          color="inherit"
          sx={(theme) => ({
            ...navbarRow(theme, { isMini }),
            flexWrap: "nowrap",
            gap: theme.spacing(1),
            alignItems: "flex-end",
            justifyContent: "space-between",
            width: "100% !important",
            [theme.breakpoints.up("xl")]: {
              justifyContent: "space-between !important",
              width: "100% !important",
            },
          })}
        >
          <MDBox flexGrow={1} minWidth={0}>
            <Breadcrumbs icon="home" title={route[route.length - 1]} route={route} light={light} />
          </MDBox>
          {isMini ? null : (
            <MDBox
              color={light ? "white" : "inherit"}
              display="flex"
              alignItems="center"
              justifyContent="flex-end"
              sx={{ ml: { xs: 0, md: "auto" } }}
            >
              {/* <Link to="/authentication/sign-in/basic">
                <IconButton sx={navbarIconButton} size="small" disableRipple>
                  <AccountCircleIcon>account_circle</AccountCircleIcon>
                </IconButton>
              </Link> */}
              <IconButton
                size="small"
                disableRipple
                color="inherit"
                sx={navbarMobileMenu}
                onClick={handleMiniSidenav}
              >
                <Icon sx={iconsStyle} fontSize="medium">
                  {miniSidenav ? <MenuOpenIcon></MenuOpenIcon> : <MenuIcon></MenuIcon>}
                </Icon>
              </IconButton>
              {/* <IconButton
                size="small"
                disableRipple
                color="inherit"
                sx={navbarIconButton}
                onClick={handleConfiguratorOpen}
              >
                <Icon sx={iconsStyle}>settings</Icon>

              </IconButton> */}
              <IconButton
                size="small"
                disableRipple
                color="inherit"
                sx={navbarIconButton}
                aria-controls="notification-menu"
                aria-haspopup="true"
                variant="contained"
                onClick={handleOpenMenu}
              >
                <Icon sx={iconsStyle}>
                  <AccountCircleIcon></AccountCircleIcon>
                </Icon>
              </IconButton>
              {renderMenu()}
            </MDBox>
          )}
        </MDBox>
      </Toolbar>
    </AppBar>
  );
}

// Setting default values for the props of DashboardNavbar
DashboardNavbar.defaultProps = {
  absolute: false,
  light: false,
  isMini: false,
};

// Typechecking props for the DashboardNavbar
DashboardNavbar.propTypes = {
  absolute: PropTypes.bool,
  light: PropTypes.bool,
  isMini: PropTypes.bool,
};

export default DashboardNavbar;
