import React, { useState, useEffect } from "react";
import { db } from "utils/firebase";
import { collection, addDoc, getDocs, updateDoc, doc } from "firebase/firestore";
import styled from "styled-components";
import PropTypes from "prop-types";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import OutlinedInput from "@mui/material/OutlinedInput";
import { useTheme } from "@mui/material/styles";
import { Checkbox, TextField } from "@mui/material";
import DatePicker from "react-multi-date-picker";
import "../../assets/addTaskModal.css";
import MDTypography from "components/MDTypography";
import MDInput from "components/MDInput";
import MDButton from "components/MDButton";
import MDBox from "components/MDBox";
import ColorPickerModal from "components/Modals/Color Picker/ColorPickerModal";

// Color options for the tasks
const colorOptions = [
  { name: "Red", hex: "#FF0000" },
  { name: "Green", hex: "#00FF00" },
  { name: "Blue", hex: "#0000FF" },
  { name: "Orange", hex: "#ed7d06" },
  { name: "Purple", hex: "#800080" },
  { name: "DarkBlue", hex: "#0a7b8c" },
  { name: "DarkRed", hex: "#8c0a0c" },
];

// Custom styled components
const ColorCircle = styled.div`
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background-color: ${(props) => props.color};
  cursor: pointer;
`;

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
`;

const ModalContainer = styled.div`
  background: white;
  padding: 20px;
  border-radius: 8px;
  width: 400px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  position: relative;
  max-height: 100vh;
  overflow-y: auto;
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

const FormField = styled.div`
  margin-bottom: 12px;
`;

// Color picker component
const ColorPicker = ({ colorOptions, selectedColor, onSelectColor }) => {
  return <ColorCircle key={selectedColor} color={selectedColor} selected={selectedColor} />;
};

const TaskListModal = ({ task, isEditing, onClose, onTaskSaved }) => {
  const [taskName, setTaskName] = useState(task ? task.title : "");
  const [location, setLocation] = useState(task ? task.location : "");
  const [tutor, setTutor] = useState(task ? task.tutor : "");
  const [color, setColor] = useState(task ? task.color : colorOptions[0].hex);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const modalTitle = isEditing ? "Edit Task" : "Add New Task";

  const theme = useTheme();

  const handleOpenColorPicker = () => {
    setIsColorPickerOpen(true);
  };

  const handleCloseColorPicker = () => {
    setIsColorPickerOpen(false);
  };

  const handleColorChange = (newColor) => {
    setColor(newColor);
    // handleCloseColorPicker(); // Close the modal after selecting a color
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const taskData = {
      title: taskName,
      title_lc: (taskName || "").toLowerCase(), // <— add this
      location,
      tutor,
      color,
    };

    try {
      if (isEditing && task.id) {
        console.log("Task ID ", task.id);
        // Update existing task
        const taskDocRef = doc(db, "taskList", task.id);
        await updateDoc(taskDocRef, taskData);
      } else {
        // Add new task
        await addDoc(collection(db, "taskList"), taskData);
      }

      onTaskSaved(); // Trigger a refresh of the task list
      onClose(); // Close the modal
    } catch (error) {
      console.error("Error handling task: ", error);
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
          <FormField>
            <MDInput
              type="text"
              label="Task Name"
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
              required
              fullWidth
            />
          </FormField>
          <FormField>
            <MDInput
              type="text"
              label="Location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              fullWidth
            />
          </FormField>
          <FormField>
            <MDInput
              type="text"
              label="Tutor"
              value={tutor}
              onChange={(e) => setTutor(e.target.value)}
              fullWidth
            />
          </FormField>
          <FormField>
            <FormControl
              fullWidth
              sx={{
                display: "flex", // Use flex to arrange elements side by side
                alignItems: "center", // Align them vertically in the center (optional)
                gap: 2, // Optional: Add space between the button and the color picker
                flexDirection: "row", //
              }}
            >
              <MDButton variant="outlined" color="info" onClick={handleOpenColorPicker}>
                Select Event Color
              </MDButton>
              <ColorPicker selectedColor={color} onSelectColor={setColor} />
            </FormControl>
          </FormField>

          {/* Color Picker Modal */}

          <ColorPickerModal
            open={isColorPickerOpen}
            onClose={handleCloseColorPicker}
            selectedColor={color}
            onSelectColor={handleColorChange}
          />
          <MDButton variant="gradient" color="info" type="submit" fullWidth>
            {isEditing ? "Edit Task" : "Add Task"}
          </MDButton>
        </form>
      </ModalContainer>
    </ModalOverlay>
  );
};

TaskListModal.propTypes = {
  onClose: PropTypes.func.isRequired,
  onTaskSaved: PropTypes.func.isRequired,
};

export default TaskListModal;
