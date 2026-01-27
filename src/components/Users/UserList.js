// src/layouts/Users/UserList.js
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { collection, deleteDoc, doc, getDocs } from "firebase/firestore";
import { db } from "utils/firebase";
import { useAuth } from "auth/AuthProvider";

import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import IconButton from "@mui/material/IconButton";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import Select from "react-select";

import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import DataTable from "examples/Tables/DataTable";
import MDButton from "components/MDButton";
import AddIcon from "@mui/icons-material/Add";

import UserModal from "../Users/UserModal";
import { callAdminDeleteUser } from "utils/firebase";

function UserList() {
  const [users, setUsers] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [roleFilter, setRoleFilter] = useState("all");
  const { user: currentUser } = useAuth();

  const canReadAll =
    !!currentUser?.isSuperUser ||
    (!!currentUser?.permissions?.users?.read &&
      (currentUser?.permissions?.userActors?.read ?? true) &&
      (currentUser?.permissions?.userStudents?.read ?? true));
  const canWriteAll =
    !!currentUser?.isSuperUser ||
    (!!currentUser?.permissions?.users?.write &&
      (currentUser?.permissions?.userActors?.write ?? true) &&
      (currentUser?.permissions?.userStudents?.write ?? true));
  const canReadActors = canReadAll || !!currentUser?.permissions?.userActors?.read;
  const canWriteActors = canWriteAll || !!currentUser?.permissions?.userActors?.write;
  const canReadStudents = canReadAll || !!currentUser?.permissions?.userStudents?.read;
  const canWriteStudents = canWriteAll || !!currentUser?.permissions?.userStudents?.write;

  const allowedReadRoles = useMemo(() => {
    if (canReadAll) return "all";
    const set = new Set();
    if (canReadActors) set.add("actor");
    if (canReadStudents) set.add("student");
    return set;
  }, [canReadAll, canReadActors, canReadStudents]);

  const allowedWriteRoles = useMemo(() => {
    if (canWriteAll) return "all";
    const set = new Set();
    if (canWriteActors) set.add("actor");
    if (canWriteStudents) set.add("student");
    return set;
  }, [canWriteAll, canWriteActors, canWriteStudents]);

  const fetchUsers = useCallback(async () => {
    const userCollection = collection(db, "users");
    const userSnapshot = await getDocs(userCollection);
    const userList = userSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    setUsers(userList);
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleAdd = () => {
    setSelectedUser(null);
    setIsEditing(false);
    setModalOpen(true);
  };

  const handleEdit = useCallback((user) => {
    setSelectedUser(user);
    setIsEditing(true);
    setModalOpen(true);
  }, []);

  const handleDelete = useCallback(
    async (id) => {
      const isConfirmed = window.confirm("Are you sure you want to delete this user?");
      if (!isConfirmed) return;

      try {
        await deleteDoc(doc(db, "users", id));
        await callAdminDeleteUser({ uid: id });
        fetchUsers();
      } catch (error) {
        console.error("Error deleting user: ", error);
        alert("There was a problem deleting the user. Check console for details.");
      }
    },
    [fetchUsers]
  );

  const handleModalClose = () => setModalOpen(false);
  const handleUserSaved = () => fetchUsers();

  const getRoleValue = useCallback((role) => {
    const trimmed = (role ?? "").trim();
    return trimmed ? trimmed.toLowerCase() : "no-role";
  }, []);

  const getRoleLabel = useCallback((roleValue) => {
    if (roleValue === "all") return "All";
    if (roleValue === "no-role") return "No Role";
    return roleValue
      .split(/[_\s-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }, []);

  const roleOptions = useMemo(() => {
    // Restrict to roles the viewer can read
    const baseRoles =
      allowedReadRoles === "all"
        ? ["theatre_staff", "actor_support_staff", "actor", "pas_staff", "pas_support", "student"]
        : [];
    const options = [];
    if (allowedReadRoles === "all") {
      options.push({ value: "all", label: "All" });
      baseRoles.forEach((r) => options.push({ value: r, label: getRoleLabel(r) }));
      return options;
    }
    if (allowedReadRoles instanceof Set) {
      if (allowedReadRoles.has("actor"))
        options.push({ value: "actor", label: getRoleLabel("actor") });
      if (allowedReadRoles.has("student"))
        options.push({ value: "student", label: getRoleLabel("student") });
    }
    return options.length ? options : [{ value: "none", label: "No access" }];
  }, [allowedReadRoles, getRoleLabel]);

  const selectedRoleOption = useMemo(
    () => roleOptions.find((option) => option.value === roleFilter) ?? roleOptions[0] ?? null,
    [roleFilter, roleOptions]
  );

  const filteredUsers = useMemo(() => {
    const withinPermission = users.filter((u) => {
      const value = getRoleValue(u.role);
      if (allowedReadRoles === "all") return true;
      return allowedReadRoles instanceof Set && allowedReadRoles.has(value);
    });
    if (roleFilter === "all") return withinPermission;
    return withinPermission.filter((user) => getRoleValue(user.role) === roleFilter);
  }, [allowedReadRoles, getRoleValue, roleFilter, users]);

  useEffect(() => {
    if (roleOptions.length === 0) return;
    const hasCurrent = roleOptions.some((option) => option.value === roleFilter);
    if (!hasCurrent) {
      setRoleFilter(roleOptions[0].value);
    }
  }, [roleFilter, roleOptions]);

  const canWriteRole = useCallback(
    (roleValue) => {
      if (canWriteAll) return true;
      if (roleValue === "actor") return canWriteActors;
      if (roleValue === "student") return canWriteStudents;
      return false;
    },
    [canWriteActors, canWriteAll, canWriteStudents]
  );

  const tableData = useMemo(() => {
    const columns = [
      { Header: "Name", accessor: "name", align: "left" },
      { Header: "Email", accessor: "email", align: "left" },
      { Header: "Role", accessor: "role", align: "left" },
      { Header: "Actions", accessor: "actions", align: "center" },
    ];

    const rows = filteredUsers.map((u) => ({
      name: u.name ?? u.displayName ?? "",
      email: u.email ?? "",
      role: getRoleLabel(getRoleValue(u.role)),
      actions: (
        <MDBox sx={{ display: "flex", gap: "12px" }}>
          {canWriteRole(getRoleValue(u.role)) && (
            <>
              <IconButton onClick={() => handleEdit(u)}>
                <EditIcon fontSize="small" sx={{ color: "#318aec" }} />
              </IconButton>
              <IconButton onClick={() => handleDelete(u.id)}>
                <DeleteIcon fontSize="small" sx={{ color: " #C70000" }} />
              </IconButton>
            </>
          )}
        </MDBox>
      ),
    }));

    return { columns, rows };
  }, [filteredUsers, getRoleLabel, getRoleValue, handleDelete, handleEdit, canWriteRole]);

  const selectStyles = useMemo(
    () => ({
      control: (provided) => ({
        ...provided,
        width: "100%",
        minHeight: "40px",
        fontSize: "0.95rem",
      }),
      valueContainer: (provided) => ({
        ...provided,
        padding: "0 8px",
      }),
      singleValue: (provided) => ({
        ...provided,
        fontWeight: 500,
      }),
      option: (provided, state) => ({
        ...provided,
        fontSize: "0.95rem",
        backgroundColor: state.isSelected ? "#01a5ae" : state.isFocused ? "#ecf7f8" : undefined,
        color: state.isSelected ? "#fff" : undefined,
      }),
      menu: (provided) => ({
        ...provided,
        zIndex: 1300,
      }),
      indicatorsContainer: (provided) => ({
        ...provided,
        height: "40px",
      }),
    }),
    []
  );

  const handleRoleFilterChange = useCallback((option) => {
    setRoleFilter(option?.value ?? "all");
  }, []);

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox pt={6} pb={3}>
        <Grid container spacing={6}>
          <Grid item xs={12}>
            <Card>
              <MDBox
                mx={2}
                mt={-3}
                py={3}
                px={2}
                variant="gradient"
                bgColor="#01a5ae"
                borderRadius="lg"
                coloredShadow="info"
              >
                <MDTypography variant="h6" color="white">
                  Users List
                </MDTypography>
              </MDBox>

              <MDBox
                pt={3}
                px={2}
                display="flex"
                alignItems="center"
                sx={{
                  gap: 1.5,
                  flexWrap: { xs: "wrap", sm: "nowrap" },
                }}
              >
                <MDButton
                  variant="gradient"
                  color="dark"
                  onClick={handleAdd}
                  disabled={
                    allowedWriteRoles !== "all" &&
                    allowedWriteRoles instanceof Set &&
                    allowedWriteRoles.size === 0
                  }
                  sx={{ width: { xs: "100%", sm: "auto" }, flexShrink: 0 }}
                >
                  <AddIcon sx={{ fontWeight: "bold" }} />
                  &nbsp; Add User
                </MDButton>
                <MDBox
                  sx={{
                    width: { xs: "100%", sm: 220, md: 260 },
                    flexShrink: 0,
                    ml: { xs: 0, sm: "auto" },
                  }}
                >
                  <Select
                    options={roleOptions}
                    value={selectedRoleOption}
                    onChange={handleRoleFilterChange}
                    isSearchable={false}
                    styles={selectStyles}
                    components={{ IndicatorSeparator: () => null }}
                    placeholder="Filter by role"
                  />
                </MDBox>
              </MDBox>

              <MDBox pt={3}>
                <DataTable
                  table={tableData}
                  isSorted={false}
                  entriesPerPage={false}
                  showTotalEntries={false}
                  pagination={false}
                  noEndBorder
                />
              </MDBox>
            </Card>
          </Grid>
        </Grid>
      </MDBox>

      {modalOpen && (
        <UserModal
          user={selectedUser}
          isEditing={isEditing}
          onClose={handleModalClose}
          onUserSaved={handleUserSaved}
        />
      )}
    </DashboardLayout>
  );
}

export default UserList;
