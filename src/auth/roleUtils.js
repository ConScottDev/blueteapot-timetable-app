const STAFF_ROLES = [
  "theatre_staff",
  "actor_support_staff",
  "pas_staff",
  "pas_support",
  "admin",
  "staff",
];

export const resolveDefaultRouteForRoles = (roles = []) => {
  const normalized = Array.isArray(roles) ? roles.filter(Boolean) : [];
  const roleSet = new Set(normalized);
  const hasStaffRole = STAFF_ROLES.some((role) => roleSet.has(role));
  if (hasStaffRole) return "/schedule/actors";
  if (roleSet.has("actor")) return "/timetable/actors";
  if (roleSet.has("student")) return "/timetable/students";
  return "/not-authorized";
};

export const STAFF_REDIRECT_ROLES = STAFF_ROLES;

const canReadStrandFromPermissions = (permissions, strand) => !!permissions?.[strand]?.read;
const canWriteStrandFromPermissions = (permissions, strand) => !!permissions?.[strand]?.write;

export const resolveDefaultRouteForAccess = (roles = [], permissions = null) => {
  const canReadActors = canReadStrandFromPermissions(permissions, "actors");
  const canWriteActors = canWriteStrandFromPermissions(permissions, "actors");
  const canReadStudents = canReadStrandFromPermissions(permissions, "students");
  const canWriteStudents = canWriteStrandFromPermissions(permissions, "students");

  // Prefer legacy role-based routing if present AND accessible
  const roleTarget = resolveDefaultRouteForRoles(roles);
  const roleTargetAllowed =
    (roleTarget === "/schedule/actors" && (canWriteActors || canReadActors)) ||
    (roleTarget === "/schedule/students" && (canWriteStudents || canReadStudents)) ||
    (roleTarget === "/timetable/actors" && canReadActors) ||
    (roleTarget === "/timetable/students" && canReadStudents);
  if (roleTarget !== "/not-authorized" && roleTargetAllowed) return roleTarget;

  // Fallback to permissions-based routing
  if (canWriteActors) return "/schedule/actors";
  if (canWriteStudents) return "/schedule/students";
  if (canReadActors) return "/timetable/actors";
  if (canReadStudents) return "/timetable/students";

  return "/not-authorized";
};
