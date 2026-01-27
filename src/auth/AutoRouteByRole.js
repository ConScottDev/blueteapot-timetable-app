// src/auth/AutoRouteByRole.jsx
import { useRef } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import { resolveDefaultRouteForAccess } from "./roleUtils";

export default function AutoRouteByRole() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const initialPathRef = useRef(null);

  if (!initialPathRef.current) {
    initialPathRef.current = `${location.pathname}${location.search}${location.hash}`;
  }

  if (loading) return null;

  const requestedPath = initialPathRef.current || "/";

  if (!user) {
    const fromPath =
      requestedPath.startsWith("/authentication") && requestedPath !== "/" ? "/" : requestedPath;

    if (location.pathname === "/authentication/sign-in") return null;

    return (
      <Navigate
        to="/authentication/sign-in"
        replace
        state={{
          from: fromPath || "/",
        }}
      />
    );
  }

  const roles = Array.isArray(user?.roles) ? user.roles : [];
  const target = resolveDefaultRouteForAccess(roles, user?.permissions);

  if (!target || requestedPath === target || location.pathname === target) {
    return null;
  }

  return <Navigate to={target} replace />;
}
