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
