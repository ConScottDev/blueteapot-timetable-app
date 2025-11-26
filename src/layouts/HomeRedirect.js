// src/layouts/HomeRedirect.jsx
import { Navigate, useLocation } from "react-router-dom";

export default function HomeRedirect() {
  const { pathname } = useLocation();
  // Only redirect when we are exactly on "/"
  if (pathname !== "/") return null;
  return <Navigate to="/schedule/actors" replace />;
}
