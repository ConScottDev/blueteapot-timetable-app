// src/auth/guards.jsx
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import NotAuthorized from "layouts/NotAuthorized";

const STAFF_ROLES = [
  "theatre_staff",
  "actor_support_staff",
  "pas_staff",
  "pas_support",
  // legacy
  "admin",
  "staff",
];

export function RequireAuth({ children }) {
  const { user, loading, hasRole } = useAuth();
  const loc = useLocation();
  const requestedPath = `${loc.pathname}${loc.search}${loc.hash}`;
  if (loading) return null; // don't navigate while loading
  if (!user) {
    if (loc.pathname.startsWith("/authentication/sign-in")) return null;
    const fromPath = loc.pathname.startsWith("/authentication") ? "/" : requestedPath || "/";
    return <Navigate to="/authentication/sign-in" state={{ from: fromPath }} replace />;
  }
  const isActorOnly = hasRole("actor") && !hasRole(...STAFF_ROLES);
  const isStudentOnly = hasRole("student") && !hasRole(...STAFF_ROLES);
  if (isActorOnly && !loc.pathname.startsWith("/timetable/actors")) {
    return <Navigate to="/timetable/actors" replace />;
  }
  if (isStudentOnly && !loc.pathname.startsWith("/timetable/students")) {
    return <Navigate to="/timetable/students" replace />;
  }
  return children;
}

export function RequireRole({ roles, children }) {
  const { loading, hasRole } = useAuth();
  if (loading) return <div>Loading…</div>;
  return hasRole(...roles) ? children : <NotAuthorized />;
}

export function RequireStrandPermission({ strand, action = "read", children }) {
  const { loading, canReadStrand, canWriteStrand } = useAuth();
  const loc = useLocation();
  if (loading) return null;

  const allowed = action === "write" ? canWriteStrand(strand || "") : canReadStrand(strand || "");

  if (!allowed) {
    if (loc.pathname === "/not-authorized") return <NotAuthorized />;
    return <Navigate to="/not-authorized" state={{ from: loc.pathname }} replace />;
  }

  return children;
}

export function RequireAnyStrandWrite({ children }) {
  const { loading, canWriteStrand } = useAuth();
  const loc = useLocation();
  if (loading) return null;
  const allowed = canWriteStrand("actors") || canWriteStrand("students");
  if (!allowed) {
    if (loc.pathname === "/not-authorized") return <NotAuthorized />;
    return <Navigate to="/not-authorized" state={{ from: loc.pathname }} replace />;
  }
  return children;
}

export function RequireUsersPermission({ action = "read", children }) {
  const { loading, canReadUsers, canWriteUsers } = useAuth();
  const loc = useLocation();
  if (loading) return null;
  const allowed = action === "write" ? canWriteUsers() : canReadUsers();
  if (!allowed) {
    if (loc.pathname === "/not-authorized") return <NotAuthorized />;
    return <Navigate to="/not-authorized" state={{ from: loc.pathname }} replace />;
  }
  return children;
}
