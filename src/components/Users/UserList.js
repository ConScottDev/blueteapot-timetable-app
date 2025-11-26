// src/layouts/Users/UserList.js
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { collection, deleteDoc, doc, getDocs } from "firebase/firestore";
import { db } from "utils/firebase";

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
    const staticRoles = [
      "theatre_staff",
      "actor_support_staff",
      "actor",
      "pas_staff",
      "pas_support",
      "student",
    ];
    const staticOptions = [
      { value: "all", label: "All" },
      ...staticRoles.map((r) => ({ value: r, label: getRoleLabel(r) })),
    ];

    const excluded = new Set(["all", ...staticRoles]);
    const dynamicRoleMap = new Map();
    users.forEach((user) => {
      const value = getRoleValue(user.role);
      if (value && !excluded.has(value) && !dynamicRoleMap.has(value)) {
        dynamicRoleMap.set(value, getRoleLabel(value));
      }
    });

    const dynamicOptions = Array.from(dynamicRoleMap, ([value, label]) => ({ value, label })).sort(
      (a, b) => a.label.localeCompare(b.label)
    );

    return [...staticOptions, ...dynamicOptions];
  }, [getRoleLabel, getRoleValue, users]);

  const selectedRoleOption = useMemo(
    () => roleOptions.find((option) => option.value === roleFilter) ?? roleOptions[0] ?? null,
    [roleFilter, roleOptions]
  );

  const filteredUsers = useMemo(() => {
    if (roleFilter === "all") return users;
    return users.filter((user) => getRoleValue(user.role) === roleFilter);
  }, [getRoleValue, roleFilter, users]);

  useEffect(() => {
    if (roleOptions.length === 0) return;
    const hasCurrent = roleOptions.some((option) => option.value === roleFilter);
    if (!hasCurrent) {
      setRoleFilter("all");
    }
  }, [roleFilter, roleOptions]);

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
          <IconButton onClick={() => handleEdit(u)}>
            <EditIcon fontSize="small" sx={{ color: "#318aec" }} />
          </IconButton>
          <IconButton onClick={() => handleDelete(u.id)}>
            <DeleteIcon fontSize="small" sx={{ color: " #C70000" }} />
          </IconButton>
        </MDBox>
      ),
    }));

    return { columns, rows };
  }, [filteredUsers, getRoleLabel, getRoleValue, handleDelete, handleEdit]);

  const selectStyles = useMemo(
    () => ({
      control: (provided) => ({
        ...provided,
        minWidth: "220px",
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
                justifyContent="space-between"
                alignItems="center"
              >
                <MDButton variant="gradient" color="dark" onClick={handleAdd}>
                  <AddIcon sx={{ fontWeight: "bold" }} />
                  &nbsp; Add User
                </MDButton>
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
