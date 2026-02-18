// src/layouts/Users/UserModal.jsx
import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { collection, addDoc, updateDoc, doc, setDoc } from "firebase/firestore";
import { db, functions } from "utils/firebase"; // make sure you export functions instance
import { httpsCallable } from "firebase/functions";
import styled from "styled-components";
import { callAdminUpsert } from "utils/firebase";
import { useAuth } from "auth/AuthProvider";

import MDButton from "components/MDButton";
import MDTypography from "components/MDTypography";
import MDBox from "components/MDBox";
import MDInput from "components/MDInput";
import Switch from "@mui/material/Switch";
// Using MDInput with select for consistent sizing
import MenuItem from "@mui/material/MenuItem";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";

const USERNAME_ROLES = new Set(["actor", "student"]);

const requiresUsernameForRole = (role = "") => USERNAME_ROLES.has(role);
const requiresAdditionalEmailsForRole = requiresUsernameForRole;

const generateRoleUsername = (fullName = "", role = "") => {
  if (!requiresUsernameForRole(role)) return "";

  const initials = fullName
    .replace(/['’\-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase())
    .join("");

  if (!initials) return "";
  return `${initials}${role}`;
};

const normalizeAdditionalEmails = (value = "") =>
  value
    .split(/[\s,;]+/)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

const ModalOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
`;
const ModalContainer = styled.div`
  background: #fff;
  padding: 20px;
  border-radius: 8px;
  width: 520px;
  max-height: 100vh;
  overflow-y: auto;
  position: relative;
`;
const CloseButton = styled.button`
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
`;
const Row = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  @media (max-width: 560px) {
    grid-template-columns: 1fr;
  }
`;
const Field = styled.div`
  margin-bottom: 12px;
`;

const ToggleRow = ({ label, checked, onChange, disabled }) => (
  <MDBox display="flex" alignItems="center" justifyContent="space-between" py={0.5}>
    <MDTypography variant="button">{label}</MDTypography>
    <Switch checked={checked} onChange={(e) => onChange(e.target.checked)} disabled={disabled} />
  </MDBox>
);

const UserModal = ({ onClose, user, isEditing, onUserSaved }) => {
  const initialRole = user?.role || "theatre_staff";
  const initialGeneratedUsername = generateRoleUsername(user?.name || "", initialRole);
  const initialAdditionalEmails = Array.isArray(user?.additionalEmails)
    ? user.additionalEmails
    : [];
  // base
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [role, setRole] = useState(initialRole);
  const [uid, setUid] = useState(user?.uid || "");
  const [username, setUsername] = useState(user?.username || initialGeneratedUsername || "");
  const [additionalEmailsInput, setAdditionalEmailsInput] = useState(
    initialAdditionalEmails.join(", ")
  );
  const [usernameManuallyEdited, setUsernameManuallyEdited] = useState(() => {
    if (!requiresUsernameForRole(initialRole)) return false;
    if (!user?.username) return false;
    return user.username.trim() !== (initialGeneratedUsername || "");
  });

  // password fields (admin-specified)
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formError, setFormError] = useState("");
  const modalTitle = isEditing ? "Edit User" : "Add New User";

  // permissions
  // Default to no access unless specified by existing profile; admins can enable per strand
  const [actorsRead, setActorsRead] = useState(user?.permissions?.actors?.read ?? false);
  const [actorsWrite, setActorsWrite] = useState(user?.permissions?.actors?.write ?? false);
  const [studentsRead, setStudentsRead] = useState(user?.permissions?.students?.read ?? false);
  const [studentsWrite, setStudentsWrite] = useState(user?.permissions?.students?.write ?? false);
  const [userActorsRead, setUserActorsRead] = useState(
    user?.permissions?.userActors?.read ?? user?.permissions?.users?.read ?? false
  );
  const [userActorsWrite, setUserActorsWrite] = useState(
    user?.permissions?.userActors?.write ?? user?.permissions?.users?.write ?? false
  );
  const [userStudentsRead, setUserStudentsRead] = useState(
    user?.permissions?.userStudents?.read ?? user?.permissions?.users?.read ?? false
  );
  const [userStudentsWrite, setUserStudentsWrite] = useState(
    user?.permissions?.userStudents?.write ?? user?.permissions?.users?.write ?? false
  );

  // notifications
  const [notifyEmail, setNotifyEmail] = useState(user?.notifications?.email ?? true);
  const [notifyPush, setNotifyPush] = useState(user?.notifications?.push ?? true);

  // student-only
  const initialYear = user?.studentMeta?.year ?? 1;
  const [studentYear, setStudentYear] = useState(initialYear);
  const computedQqiLevel = useMemo(() => (studentYear === 1 ? 2 : 3), [studentYear]);
  const [studentStatus, setStudentStatus] = useState(user?.studentMeta?.status || "active");
  const [graduationDate, setGraduationDate] = useState(user?.studentMeta?.graduationDate || "");
  const roleRequiresUsername = requiresUsernameForRole(role);
  const roleSupportsAdditionalEmails = requiresAdditionalEmailsForRole(role);

  // All roles configurable via toggles (no admin special-case)
  const { user: currentUser } = useAuth();
  const canGrantUserPerms =
    (currentUser?.email || "").toLowerCase() === "ensemble@blueteapot.ie".toLowerCase();
  const canManageAllUsers =
    !!currentUser?.isSuperUser ||
    (!!currentUser?.permissions?.users?.write &&
      (currentUser?.permissions?.userActors?.write ?? true) &&
      (currentUser?.permissions?.userStudents?.write ?? true));
  const canCreateActors = canManageAllUsers || !!currentUser?.permissions?.userActors?.write;
  const canCreateStudents = canManageAllUsers || !!currentUser?.permissions?.userStudents?.write;

  const allowedRoleOptions = useMemo(() => {
    if (canManageAllUsers) {
      return [
        { value: "theatre_staff", label: "Theatre Staff" },
        { value: "actor_support_staff", label: "Actor Support Staff" },
        { value: "actor", label: "Actor" },
        { value: "pas_staff", label: "PAS Staff" },
        { value: "pas_support", label: "PAS Support" },
        { value: "student", label: "Student" },
      ];
    }
    const opts = [];
    if (canCreateActors) opts.push({ value: "actor", label: "Actor" });
    if (canCreateStudents) opts.push({ value: "student", label: "Student" });
    return opts;
  }, [canCreateActors, canCreateStudents, canManageAllUsers]);

  const permsDisabled = false;

  useEffect(() => {
    if (allowedRoleOptions.length === 0) return;
    const allowedValues = new Set(allowedRoleOptions.map((o) => o.value));
    if (!allowedValues.has(role)) {
      setRole(allowedRoleOptions[0].value);
    }
  }, [allowedRoleOptions, role]);

  useEffect(() => {
    if (role === "actor") {
      setActorsRead(true);
      setActorsWrite(false);
      setStudentsRead(false);
      setStudentsWrite(false);
    } else if (role === "student") {
      setActorsRead(false);
      setActorsWrite(false);
      setStudentsRead(true);
      setStudentsWrite(false);
    }
    // staff remains configurable
  }, [role]);

  useEffect(() => {
    if (!roleRequiresUsername) {
      if (username) setUsername("");
      if (usernameManuallyEdited) setUsernameManuallyEdited(false);
      return;
    }

    const generated = generateRoleUsername(name, role);
    if ((!usernameManuallyEdited || !username) && generated !== username) {
      setUsername(generated);
      setUsernameManuallyEdited(false);
    }
  }, [name, role, roleRequiresUsername, username, usernameManuallyEdited]);

  // Enforce: write only when read is enabled for each strand
  useEffect(() => {
    if (!actorsRead && actorsWrite) setActorsWrite(false);
  }, [actorsRead, actorsWrite]);
  useEffect(() => {
    if (!studentsRead && studentsWrite) setStudentsWrite(false);
  }, [studentsRead, studentsWrite]);
  useEffect(() => {
    if (!userActorsRead && userActorsWrite) setUserActorsWrite(false);
  }, [userActorsRead, userActorsWrite]);
  useEffect(() => {
    if (!userStudentsRead && userStudentsWrite) setUserStudentsWrite(false);
  }, [userStudentsRead, userStudentsWrite]);

  const [passwordError, setPasswordError] = useState("");
  useEffect(() => {
    // Password always required for both create and edit
    if (!password && !confirm) {
      setPasswordError("");
      return;
    }
    if (!password || !confirm) {
      setPasswordError("Password and Confirm Password are required.");
      return;
    }
    if (password !== confirm) {
      setPasswordError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setPasswordError("Password must be at least 6 characters.");
      return;
    }

    setPasswordError("");
  }, [password, confirm]);

  const handleUsernameInputChange = (value) => {
    setUsername(value);

    if (!roleRequiresUsername) {
      setUsernameManuallyEdited(false);
      return;
    }

    if (!value) {
      setUsernameManuallyEdited(false);
      return;
    }

    const generated = generateRoleUsername(name, role);
    setUsernameManuallyEdited(value !== generated);
  };
  const passwordInvalidOnCreate = !isEditing && (!!passwordError || !password || !confirm);
  const passwordInvalidOnEdit = isEditing && (!!passwordError || !password || !confirm);
  const displayError = formError || passwordError;
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setPasswordError("");

    const isCreating = !isEditing;
    const trimmedEmail = (email || "").trim().toLowerCase();
    const trimmedUid = (uid || "").trim();
    const trimmedUsername = (username || "").trim();
    const normalizedAdditionalEmails = roleSupportsAdditionalEmails
      ? normalizeAdditionalEmails(additionalEmailsInput)
      : [];

    // ---- VALIDATION RULES ----
    const allowedValues = new Set(allowedRoleOptions.map((o) => o.value));
    if (!allowedValues.has(role)) {
      return setFormError("You do not have permission to assign this role.");
    }
    if (!trimmedEmail) return setFormError("Email is required.");
    if (roleRequiresUsername && !trimmedUsername) {
      return setFormError("Username is required for actors and students.");
    }

    // Password + confirm required for both create and edit
    if (!password || !confirm) {
      setPasswordError("Password and Confirm Password are required.");
      return setFormError("Password and Confirm Password are required.");
    }
    if (password !== confirm) {
      setPasswordError("Passwords do not match.");
      return setFormError("Passwords do not match.");
    }
    if (password.length < 6) {
      setPasswordError("Password must be at least 6 characters.");
      return setFormError("Password must be at least 6 characters.");
    }
    // --------------------------

    // Build profile for Firestore
    const profile = {
      name: name.trim(),
      displayName: name.trim(),
      email: trimmedEmail,
      role,
      ...(roleRequiresUsername && trimmedUsername ? { username: trimmedUsername } : {}),
      additionalEmails: roleSupportsAdditionalEmails ? normalizedAdditionalEmails : [],
      // uid will be set after callable returns (for creates or when creating uid on edit)
      permissions: {
        actors: { read: !!actorsRead, write: !!actorsWrite },
        students: { read: !!studentsRead, write: !!studentsWrite },
        userActors: { read: !!userActorsRead, write: !!userActorsWrite },
        userStudents: { read: !!userStudentsRead, write: !!userStudentsWrite },
        // legacy combined flag retained for compatibility when both strands are enabled
        users: {
          read: !!(userActorsRead && userStudentsRead),
          write: !!(userActorsWrite && userStudentsWrite),
        },
      },
      notifications: { email: !!notifyEmail, push: !!notifyPush },
      ...(role === "student"
        ? {
            studentMeta: {
              year: Number(studentYear),
              qqiLevel: computedQqiLevel,
              status: studentStatus,
              ...(graduationDate ? { graduationDate } : {}),
            },
          }
        : {}),
    };

    try {
      let finalUid = trimmedUid || user?.uid || undefined;

      // Always call the admin upsert so edits without password changes still persist role/permissions.
      const res = await callAdminUpsert({
        uid: finalUid, // may be undefined for new
        email: profile.email,
        password: password || undefined, // required when creating
        role,
        displayName: profile.name,
        group: null,
        disabled: false,
        profile: {
          name: profile.name,
          ...(profile.username ? { username: profile.username } : {}),
          additionalEmails: profile.additionalEmails || [],
          notifications: profile.notifications,
          permissions: profile.permissions,
          ...(profile.studentMeta ? { studentMeta: profile.studentMeta } : {}),
          updatedFromUI: true,
        },
      });
      finalUid = res?.data?.uid || finalUid;

      if (!finalUid) {
        throw new Error("No UID returned from function.");
      }

      // Admin callable already writes the profile; avoid a second client write that may be blocked by rules.

      onUserSaved();
      onClose();
    } catch (err) {
      console.error(err);
      alert("There was a problem saving the user. Check console for details.");
    }
  };

  return (
    <ModalOverlay>
      <ModalContainer>
        <MDBox
          mb={3}
          py={2}
          px={2}
          variant="gradient"
          bgColor="#01a5ae"
          borderRadius="lg"
          coloredShadow="info"
          display="flex"
          alignItems="center"
          justifyContent="space-between"
        >
          <MDTypography variant="h6" color="white">
            {modalTitle}
          </MDTypography>
          <CloseButton onClick={onClose} aria-label="Close">
            ×
          </CloseButton>
        </MDBox>

        <form onSubmit={handleSubmit}>
          <Field>
            <MDInput
              label="Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              fullWidth
              size="small"
              variant="outlined"
            />
          </Field>

          <Row>
            <Field>
              <MDInput
                type="email"
                label="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                fullWidth
                size="small"
                variant="outlined"
              />
            </Field>
            <Field>
              <MDInput
                select
                fullWidth
                size="small"
                label="Role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                variant="outlined"
                InputLabelProps={{ shrink: true }}
                sx={{
                  "& .MuiInputBase-root": {
                    height: 40,
                  },
                }}
              >
                {allowedRoleOptions.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </MDInput>
            </Field>
          </Row>

          {roleRequiresUsername && (
            <Field>
              <MDInput
                label="Username"
                value={username}
                onChange={(e) => handleUsernameInputChange(e.target.value)}
                required
                fullWidth
                size="small"
                variant="outlined"
                helperText="Auto-generated from initials and role"
              />
            </Field>
          )}

          {roleSupportsAdditionalEmails && (
            <Field>
              <MDInput
                label="Additional Email Addresses"
                value={additionalEmailsInput}
                onChange={(e) => setAdditionalEmailsInput(e.target.value)}
                fullWidth
                size="small"
                variant="outlined"
                multiline
                minRows={2}
                placeholder="example1@email.com, example2@email.com"
                helperText="Separate multiple emails with commas or spaces"
              />
            </Field>
          )}

          <Row>
            <Field>
              <MDInput
                type={showPassword ? "text" : "password"}
                label="Password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={!!passwordError}
                placeholder="Minimum 6 characters"
                fullWidth
                size="small"
                variant="outlined"
                sx={{ backgroundImage: "none" }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="Toggle password visibility"
                        onClick={() => setShowPassword((prev) => !prev)}
                        edge="end"
                        size="small"
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Field>
            <Field>
              <MDInput
                type={showConfirmPassword ? "text" : "password"}
                label="Confirm Password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                error={!!passwordError}
                fullWidth
                size="small"
                variant="outlined"
                sx={{ backgroundImage: "none" }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="Toggle confirm password visibility"
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                        edge="end"
                        size="small"
                      >
                        {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Field>
          </Row>
          {displayError && (
            <MDBox mt={0.5} mb={2}>
              <MDTypography variant="button" color="error">
                {displayError}
              </MDTypography>
            </MDBox>
          )}

          <MDTypography
            variant="button"
            sx={{ mt: 2, mb: 1, display: "block", fontWeight: "bold" }}
          >
            Permissions — Actors Strand
          </MDTypography>
          <ToggleRow
            label="Read"
            checked={actorsRead}
            onChange={setActorsRead}
            disabled={permsDisabled}
          />
          <ToggleRow
            label="Write"
            checked={actorsWrite}
            onChange={setActorsWrite}
            disabled={permsDisabled || !actorsRead}
          />

          <MDTypography
            variant="button"
            sx={{ mt: 2, mb: 1, display: "block", fontWeight: "bold" }}
          >
            Permissions — Students Strand
          </MDTypography>
          <ToggleRow
            label="Read"
            checked={studentsRead}
            onChange={setStudentsRead}
            disabled={permsDisabled}
          />
          <ToggleRow
            label="Write"
            checked={studentsWrite}
            onChange={setStudentsWrite}
            disabled={permsDisabled || !studentsRead}
          />

          {canGrantUserPerms && (
            <>
              <MDTypography
                variant="button"
                sx={{ mt: 2, mb: 1, display: "block", fontWeight: "bold" }}
              >
                User Management — Actors
              </MDTypography>
              <ToggleRow
                label="Read"
                checked={userActorsRead}
                onChange={setUserActorsRead}
                disabled={permsDisabled}
              />
              <ToggleRow
                label="Write"
                checked={userActorsWrite}
                onChange={setUserActorsWrite}
                disabled={permsDisabled || !userActorsRead}
              />

              <MDTypography
                variant="button"
                sx={{ mt: 2, mb: 1, display: "block", fontWeight: "bold" }}
              >
                User Management — Students
              </MDTypography>
              <ToggleRow
                label="Read"
                checked={userStudentsRead}
                onChange={setUserStudentsRead}
                disabled={permsDisabled}
              />
              <ToggleRow
                label="Write"
                checked={userStudentsWrite}
                onChange={setUserStudentsWrite}
                disabled={permsDisabled || !userStudentsRead}
              />
            </>
          )}

          {/* Notifications (temporarily hidden; restore when ready)
          <MDTypography
            variant="button"
            sx={{ mt: 2, mb: 1, display: "block", fontWeight: "bold" }}
          >
            Notifications
          </MDTypography>
          <ToggleRow label="Email alerts" checked={notifyEmail} onChange={setNotifyEmail} />
          <ToggleRow label="Push notifications" checked={notifyPush} onChange={setNotifyPush} />
          */}

          {role === "student" && (
            <>
              <MDTypography variant="button" sx={{ mt: 2, mb: 1, display: "block" }}>
                Student Details
              </MDTypography>
              <Row>
                <Field>
                  <MDInput
                    select
                    fullWidth
                    size="small"
                    label="Year"
                    value={studentYear}
                    onChange={(e) => setStudentYear(Number(e.target.value))}
                    variant="outlined"
                    InputLabelProps={{ shrink: true }}
                    sx={{
                      "& .MuiInputBase-root": {
                        height: 40,
                      },
                    }}
                  >
                    <MenuItem value={1}>1</MenuItem>
                    <MenuItem value={2}>2</MenuItem>
                    <MenuItem value={3}>3</MenuItem>
                  </MDInput>
                </Field>
                <Field>
                  <MDInput
                    label="QQI Level"
                    value={computedQqiLevel}
                    disabled
                    fullWidth
                    size="small"
                    variant="outlined"
                  />
                </Field>
              </Row>
              <Row>
                <Field>
                  <MDInput
                    select
                    fullWidth
                    size="small"
                    label="Status"
                    value={studentStatus}
                    onChange={(e) => setStudentStatus(e.target.value)}
                    variant="outlined"
                    InputLabelProps={{ shrink: true }}
                    sx={{
                      "& .MuiInputBase-root": {
                        height: 40,
                      },
                    }}
                  >
                    <MenuItem value="active">Active</MenuItem>
                    <MenuItem value="graduated">Graduated</MenuItem>
                  </MDInput>
                </Field>
                <Field>
                  <MDInput
                    type="date"
                    label="Graduation Date (optional)"
                    value={graduationDate}
                    onChange={(e) => setGraduationDate(e.target.value)}
                    fullWidth
                    size="small"
                    InputLabelProps={{ shrink: true }}
                    inputProps={{ placeholder: "" }}
                    variant="outlined"
                  />
                </Field>
              </Row>
            </>
          )}

          <MDBox display="flex" justifyContent="space-between" alignItems="center" mt={2}>
            <MDButton
              type="submit"
              variant="contained"
              color="info"
              size="small"
              disabled={passwordInvalidOnCreate || passwordInvalidOnEdit}
            >
              {isEditing ? "Save Changes" : "Add User"}
            </MDButton>
            <MDButton type="button" onClick={onClose} variant="outlined" color="info" size="small">
              Close
            </MDButton>
          </MDBox>
        </form>
      </ModalContainer>
    </ModalOverlay>
  );
};

UserModal.propTypes = {
  onClose: PropTypes.func.isRequired,
  user: PropTypes.object,
  isEditing: PropTypes.bool,
  onUserSaved: PropTypes.func.isRequired,
};

export default UserModal;
