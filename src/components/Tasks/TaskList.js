import React, { useEffect, useState } from "react";
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import { db } from "utils/firebase";
import styled from "styled-components";

// @mui material components
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import IconButton from "@mui/material/IconButton";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";

// Material Dashboard 2 React components

// Material Dashboard 2 React example components
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import DataTable from "examples/Tables/DataTable";

import AddIcon from "@mui/icons-material/Add";

// Custom components
import TaskListModal from "./TaskListModal"; // Update the path as needed
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";

const ColorCircle = styled.div`
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background-color: ${(props) => props.color};
`;

function TaskList() {
  const [taskData, setTaskData] = useState({ columns: [], rows: [] });
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  const fetchTasks = async () => {
    const taskCollection = collection(db, "taskList");
    const taskSnapshot = await getDocs(taskCollection);
    const taskList = taskSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    const rows = taskList.map((task) => ({
      title: task.title,
      location: task.location,
      tutor: task.tutor,
      color: <ColorCircle key={task.color} color={task.color} selected={task.color} />,
      actions: (
        <MDBox sx={{ display: "flex", gap: "12px" }}>
          <IconButton onClick={() => handleEdit(task)}>
            <EditIcon fontSize="small" sx={{ color: "#318aec" }} />
          </IconButton>
          <IconButton onClick={() => handleDelete(task.id)}>
            <DeleteIcon fontSize="small" sx={{ color: "#C70000" }} />
          </IconButton>
        </MDBox>
      ),
    }));

    setTaskData({
      columns: [
        { Header: "Title", accessor: "title", align: "left" },
        { Header: "Location", accessor: "location", align: "left" },
        { Header: "Tutor", accessor: "tutor", align: "left" },
        { Header: "Colour", accessor: "color", align: "left" },
        { Header: "Actions", accessor: "actions", align: "center" },
      ],
      rows,
    });
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleAdd = () => {
    setSelectedTask(null);
    setIsEditing(false);
    setModalOpen(true);
  };

  const handleEdit = (task) => {
    setSelectedTask(task);
    setIsEditing(true);
    setModalOpen(true);
  };

  const handleDelete = async (id) => {
    const isConfirmed = window.confirm("Are you sure you want to delete this task?");
    if (isConfirmed) {
      try {
        await deleteDoc(doc(db, "taskList", id));
        fetchTasks(); // Refresh the task list after deletion
      } catch (error) {
        console.error("Error deleting task: ", error);
      }
    }
  };

  const handleModalClose = () => {
    setModalOpen(false);
  };

  const handleTaskSaved = () => {
    fetchTasks();
  };

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
                  Task List
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
                  <AddIcon sx={{ fontWeight: "bold" }}>add</AddIcon>
                  &nbsp; Add Task
                </MDButton>
              </MDBox>
              <MDBox pt={3}>
                <DataTable
                  table={taskData}
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
        <TaskListModal
          task={selectedTask}
          isEditing={isEditing}
          onClose={handleModalClose}
          onTaskSaved={handleTaskSaved}
        />
      )}
    </DashboardLayout>
  );
}

export default TaskList;
