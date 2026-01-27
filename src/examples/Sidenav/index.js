import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import PropTypes from "prop-types";
import List from "@mui/material/List";
import Divider from "@mui/material/Divider";
import Link from "@mui/material/Link";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import Icon from "@mui/material/Icon";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import CloseIcon from "@mui/icons-material/Close";
import SidenavCollapse from "examples/Sidenav/SidenavCollapse";
import SidenavRoot from "examples/Sidenav/SidenavRoot";
import sidenavLogoLabel from "examples/Sidenav/styles/sidenav";
import {
  useMaterialUIController,
  setMiniSidenav,
  setTransparentSidenav,
  setWhiteSidenav,
} from "context";
import { useAuth } from "auth/AuthProvider";

function Sidenav({ color, brand, brandName, routes, ...rest }) {
  const [controller, dispatch] = useMaterialUIController();
  const { miniSidenav, transparentSidenav, whiteSidenav, darkMode, sidenavColor } = controller;
  const location = useLocation();
  const pathname = location.pathname;
  const navigate = useNavigate();
  const { user, hasRole, canReadStrand, canWriteStrand, canReadUsers } = useAuth();
  const sidenavRef = useRef(null);

  let textColor = "white";

  if (transparentSidenav || (whiteSidenav && !darkMode)) {
    textColor = "dark";
  } else if (whiteSidenav && darkMode) {
    textColor = "inherit";
  }

  const closeSidenav = useCallback(() => setMiniSidenav(dispatch, true), [dispatch]);

  useEffect(() => {
    function handleMiniSidenav() {
      const isMini = window.innerWidth < 1200;
      setMiniSidenav(dispatch, isMini);
    }

    window.addEventListener("resize", handleMiniSidenav);
    handleMiniSidenav();

    return () => window.removeEventListener("resize", handleMiniSidenav);
  }, [dispatch]);

  // Track which parent menus are open
  const [openKeys, setOpenKeys] = useState(new Set());

  const isRouteActive = useCallback(
    (route) => {
      // A route is active if its route matches pathname exactly,
      // or if any of its children are active.
      if (route.route && pathname.startsWith(route.route)) return true;
      if (Array.isArray(route.collapse)) {
        return route.collapse.some(isRouteActive);
      }
      return false;
    },
    [pathname]
  );

  // // Ensure the parent of the active route is open
  // useEffect(() => {
  //   const newlyOpen = new Set(openKeys);
  //   routes.forEach((r) => {
  //     if (Array.isArray(r.collapse) && isRouteActive(r)) newlyOpen.add(r.key);
  //   });
  //   setOpenKeys(newlyOpen);
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [pathname]); // recalc when URL changes
  const effectiveRoutes = useMemo(() => {
    if (!user) return routes;
    const canActors = canReadStrand("actors");
    const canStudents = canReadStrand("students");
    const canUsers = canReadUsers();

    const filterRoute = (route) => {
      // Drop specific routes if not permitted
      if (route.route === "/schedule/actors" || route.route === "/timetable/actors") {
        return canActors ? route : null;
      }
      if (route.route === "/schedule/students" || route.route === "/timetable/students") {
        return canStudents ? route : null;
      }
      if (route.route === "/tasks") {
        return canWriteStrand("actors") || canWriteStrand("students") ? route : null;
      }
      if (route.route === "/user-list") {
        return canUsers ? route : null;
      }

      if (Array.isArray(route.collapse)) {
        const filteredChildren = route.collapse
          .map(filterRoute)
          .filter(Boolean)
          .map((child) => ({ ...child }));
        if (filteredChildren.length === 0) return null;
        return { ...route, collapse: filteredChildren };
      }

      return route;
    };

    return routes.map(filterRoute).filter(Boolean);
  }, [routes, user, canReadStrand, canWriteStrand, canReadUsers]);

  const computedOpen = useMemo(() => {
    const s = new Set();
    const mark = (r) => {
      if (Array.isArray(r.collapse) && r.collapse.length) {
        const active = r.collapse.some((c) => isRouteActive(c));
        if (active) s.add(r.key);
        r.collapse.forEach(mark);
      }
    };
    effectiveRoutes.forEach(mark);
    return s;
  }, [pathname, effectiveRoutes, isRouteActive]);

  useEffect(() => {
    const changed =
      computedOpen.size !== openKeys.size || [...computedOpen].some((k) => !openKeys.has(k));
    if (changed) setOpenKeys(computedOpen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [computedOpen]);

  const toggleOpen = (key) => {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  useEffect(() => {
    // Close the drawer on mobile after a route change
    if (window.innerWidth < 1200) {
      closeSidenav();
    }
  }, [pathname, closeSidenav]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      const isMobile = window.innerWidth < 1200;
      if (!isMobile || miniSidenav) return;
      if (sidenavRef.current && !sidenavRef.current.contains(event.target)) {
        closeSidenav();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [miniSidenav, closeSidenav]);

  const RenderItem = ({ route, depth = 0 }) => {
    const { type, name, icon, title, noCollapse, key, href, route: to, collapse } = route;

    if (type === "title") {
      return (
        <MDTypography
          key={key}
          color={textColor}
          display="block"
          variant="caption"
          fontWeight="bold"
          textTransform="uppercase"
          pl={3}
          mt={2}
          mb={1}
          ml={1}
        >
          {title}
        </MDTypography>
      );
    }

    if (type === "divider") {
      return (
        <Divider
          key={key}
          light={
            (!darkMode && !whiteSidenav && !transparentSidenav) ||
            (darkMode && !transparentSidenav && whiteSidenav)
          }
        />
      );
    }

    if (type === "collapse" && Array.isArray(collapse) && collapse.length) {
      const open = openKeys.has(key);
      const active = isRouteActive(route);
      return (
        <MDBox key={key} pl={depth ? 2 : 0}>
          {/* Parent clickable row (no NavLink) */}
          <MDBox onClick={() => toggleOpen(key)} sx={{ cursor: "pointer" }}>
            <SidenavCollapse name={name} icon={icon} active={active} />
          </MDBox>
          {open && (
            <List sx={{ pl: 2 }}>
              {collapse.map((child) => (
                <RenderItem key={child.key} route={child} depth={depth + 1} />
              ))}
            </List>
          )}
        </MDBox>
      );
    }

    if (type === "collapse") {
      const active = to ? pathname.startsWith(to) : false;
      if (href) {
        return (
          <SidenavCollapse
            key={key}
            name={name}
            icon={icon}
            active={active}
            onClick={() => window.open(href, "_blank", "noopener,noreferrer")}
          />
        );
      }
      return (
        <SidenavCollapse
          key={key}
          name={name}
          icon={icon}
          active={active}
          onClick={() => {
            if (to && pathname !== to) navigate(to, { replace: true });
          }}
        />
      );
    }

    return null;
  };

  const renderRoutes = effectiveRoutes.map((r) => <RenderItem key={r.key} route={r} />);

  return (
    <SidenavRoot
      ref={sidenavRef}
      {...rest}
      variant="permanent"
      ownerState={{ transparentSidenav, whiteSidenav, miniSidenav, darkMode }}
    >
      <MDBox pt={3} pb={1} px={3.5} textAlign="center">
        <MDBox
          display={{ xs: "block", xl: "none" }}
          position="absolute"
          top={0}
          right={0}
          p={1.625}
          onClick={closeSidenav}
          sx={{ cursor: "pointer" }}
        >
          <MDTypography variant="h6" color="secondary">
            <Icon sx={{ fontWeight: "bold" }}>
              <CloseIcon sx={{ color: "#fff" }} />
            </Icon>
          </MDTypography>
        </MDBox>
        <MDBox
          role="button"
          tabIndex={0}
          onClick={() => pathname !== "/" && navigate("/", { replace: true })}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              if (pathname !== "/") navigate("/", { replace: true });
            }
          }}
          display="flex"
          alignItems="center"
          sx={{ cursor: "pointer" }}
        >
          {brand && (
            <MDBox
              component="img"
              src={brand}
              alt="Brand"
              width="2.5rem"
              sx={{ marginRight: "0.5rem" }}
            />
          )}
          <MDBox
            width={!brandName && "100%"}
            sx={(theme) => sidenavLogoLabel(theme, { miniSidenav })}
          >
            <MDBox display="flex">
              {brandName && (
                <MDBox component="img" src={brandName} alt="Brand Title" width="4rem" />
              )}
            </MDBox>
          </MDBox>
        </MDBox>
      </MDBox>
      <Divider
        light={
          (!darkMode && !whiteSidenav && !transparentSidenav) ||
          (darkMode && !transparentSidenav && whiteSidenav)
        }
      />
      <List>{renderRoutes}</List>
    </SidenavRoot>
  );
}

Sidenav.defaultProps = {
  color: "info",
  brand: "",
};

Sidenav.propTypes = {
  color: PropTypes.oneOf(["primary", "secondary", "info", "success", "warning", "error", "dark"]),
  brand: PropTypes.string,
  brandName: PropTypes.string.isRequired,
  routes: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default Sidenav;
