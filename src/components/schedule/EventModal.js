import React, { useState, useEffect, useMemo } from "react";
import PropTypes from "prop-types";
import styled from "styled-components";
import {
  collection,
  getDocs,
  query,
  where,
  documentId,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "utils/firebase";
import MDButton from "../MDButton";
import MDTypography from "../MDTypography";
import MDBox from "../MDBox";
import MDInput from "../MDInput";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import OutlinedInput from "@mui/material/OutlinedInput";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import { TimePicker } from "@mui/x-date-pickers/TimePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";
import { Checkbox } from "@mui/material";
import "../../assets/addTaskModal.css";
import ColorPickerModal from "../Modals/Color Picker/ColorPickerModal";

import { Box, Chip } from "@mui/material";

const colorOptions = [
  { name: "Red", hex: "#FF0000" },
  { name: "Green", hex: "#00FF00" },
  { name: "Blue", hex: "#0000FF" },
  { name: "Orange", hex: "#ed7d06" },
  { name: "Purple", hex: "#800080" },
  { name: "DarkBlue", hex: "#0a7b8c" },
  { name: "DarkRed", hex: "#8c0a0c" },
  { name: "DarkPurple", hex: "#8c0a78" },
  { name: "DarkGreen", hex: "#0a8c3a" },
];
// Define custom styles for the TimePicker dropdown items
const CustomMenuItem = styled(MenuItem)`
  min-width: 2rem !important;
`;

const ITEM_HEIGHT = 48;
const ITEM_PADDING_TOP = 8;
const MenuProps = {
  PaperProps: {
    style: {
      maxHeight: ITEM_HEIGHT * 4.5 + ITEM_PADDING_TOP,
      width: 250,
    },
  },
};

const ColorCircle = styled.div`
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background-color: ${(props) => props.color};
  display: inline-block;
  margin-right: 8px;
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
  margin-bottom: 15px;
`;

const TimePickerContainer = styled.div`
  display: flex;
  align-items: center; /* Vertically align items */
  gap: 10px;
`;

const ColorPicker = ({ colorOptions, selectedColor, onSelectColor }) => {
  return <ColorCircle key={selectedColor} color={selectedColor} selected={selectedColor} />;
};

const extractParticipantId = (raw) => {
  if (!raw) return null;
  if (typeof raw === "string") return raw;
  if (typeof raw === "object") {
    const candidates = [raw.id, raw.uid, raw.userId, raw.value];
    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim()) return candidate;
    }
  }
  return null;
};

const EventModal = ({
  event,
  actors,
  scheduleStrand = "actor",
  onClose,
  canEdit = true,
  showParticipants = true,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [userNameMap, setUserNameMap] = useState({});
  const participantIds = Array.isArray(event.resource?.participants)
    ? event.resource.participants
    : [];
  const [taskName, setTaskName] = useState(event.title || "");
  const [location, setLocation] = useState(event.resource?.location || "");
  const [tutor, setTutor] = useState(event.resource?.tutor || "");
  const [date, setDate] = useState(dayjs(event.start).format("YYYY-MM-DD"));
  const [startTime, setStartTime] = useState(dayjs(event.resource?.startTime || "00:00", "HH:mm"));
  const [endTime, setEndTime] = useState(dayjs(event.resource?.endTime || "00:00", "HH:mm"));
  const [participants, setParticipants] = useState(event.resource?.participants || []);
  const [presetTime, setPresetTime] = useState("");
  const [color, setColor] = useState(colorOptions[0].hex); // Default color
  const [isProductionEvent, setIsProductionEvent] = useState(false);
  const [isUpdated, setIsUpdated] = useState(false); // Add this state
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const modalTitle = isEditing ? "Edit Event" : "Event Details";

  const [students, setStudents] = useState([]);

  const participantOptions = useMemo(
    () => (scheduleStrand === "student" ? students : actors || []),
    [actors, scheduleStrand, students]
  );

  const participantsById = useMemo(
    () => Object.fromEntries(participantOptions.map((p) => [p.id, p])),
    [participantOptions]
  );

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

  useEffect(() => {
    if (!canEdit) {
      setIsEditing(false);
    }
  }, [canEdit]);

  useEffect(() => {
    let alive = true;
    if (scheduleStrand !== "student") {
      setStudents([]);
      return () => {};
    }

    (async () => {
      try {
        const snap = await getDocs(
          query(
            collection(db, "users"),
            where("role", "==", "student"),
            where("disabled", "==", false)
          )
        );
        const list = snap.docs.map((d) => ({
          id: d.id,
          name: d.data()?.displayName || d.data()?.name || d.data()?.email || d.id,
          ...d.data(),
        }));
        if (alive) setStudents(list);
      } catch (e) {
        console.error("Failed to load students:", e);
        if (alive) setStudents([]);
      }
    })();

    return () => {
      alive = false;
    };
  }, [scheduleStrand]);

  useEffect(() => {
    if (event) {
      setColor(event.resource?.color || colorOptions[0].hex);
      // Set the checkbox based on the event's production status
      setIsProductionEvent(event.resource?.production || false);

      setStartTime(dayjs(event.resource?.startTime || "00:00", "HH:mm"));
      setEndTime(dayjs(event.resource?.endTime || "00:00", "HH:mm"));
    }
  }, [event]);

  const handleParticipantsChange = (event) => {
    const { value } = event.target;
    setParticipants(typeof value === "string" ? value.split(",") : value);
  };

  const handlePresetTimeChange = (event) => {
    const selectedTime = event.target.value;
    setPresetTime(selectedTime);

    if (selectedTime === "morning") {
      setStartTime(dayjs().hour(10).minute(0));
      setEndTime(dayjs().hour(12).minute(30));
    } else if (selectedTime === "afternoon") {
      setStartTime(dayjs().hour(13).minute(30));
      setEndTime(dayjs().hour(15).minute(0));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (endTime.isBefore(startTime)) {
      alert("End time cannot be before start time.");
      return;
    }

    try {
      const startTimeFormatted = startTime.format("HH:mm");
      const endTimeFormatted = endTime.format("HH:mm");

      const eventRef = doc(db, "tasks", event.id);

      await updateDoc(eventRef, {
        title: taskName,
        date: date,
        location: location,
        tutor: tutor,
        startTime: startTimeFormatted,
        endTime: endTimeFormatted,
        participants: participants,
        color: color, // Update the color in Firestore
        isProductionEvent: isProductionEvent, // Update production status in Firestore
      });

      setIsUpdated(true);
      setIsEditing(false);
    } catch (error) {
      console.error("Error updating task: ", error);
    }
  };

  useEffect(() => {
    if (isUpdated) {
      onClose(); // Close the modal or fetch updated data here
    }
  }, [isUpdated, onClose]);

  const handleDelete = async () => {
    const confirmDelete = window.confirm("Are you sure you want to delete this event?");
    if (confirmDelete) {
      try {
        await deleteDoc(doc(db, "tasks", event.id));
        onClose();
      } catch (error) {
        console.error("Error deleting task: ", error);
      }
    }
  };

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const ids = participantIds.map(extractParticipantId).filter(Boolean);
        const map = await fetchUsersByIds(ids);
        if (isMounted) setUserNameMap(map);
      } catch (e) {
        console.error("Failed to load participant names:", e);
        if (isMounted) setUserNameMap({});
      }
    })();
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.id]); // re-fetch when a different event is opened

  useEffect(() => {
    const normalized = participantIds.map(extractParticipantId).filter(Boolean);
    setParticipants(normalized);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.id]);

  const fetchUsersByIds = async (ids) => {
    if (!ids || ids.length === 0) return {};
    const chunks = [];
    for (let i = 0; i < ids.length; i += 10) chunks.push(ids.slice(i, i + 10));

    const results = {};
    const usersCol = collection(db, "users");

    for (const chunk of chunks) {
      const q = query(usersCol, where(documentId(), "in", chunk));
      const snap = await getDocs(q);
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        // Adjust key if your field is named differently (e.g., data.displayName)
        results[docSnap.id] = data?.name || docSnap.id;
      });
    }
    return results;
  };

  return (
    <ModalOverlay style={{ zIndex: 1200 }}>
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

        <LocalizationProvider dateAdapter={AdapterDayjs}>
          {isEditing ? (
            <form onSubmit={handleSubmit}>
              {/* Form fields */}
              <FormField>
                <MDInput
                  type="text"
                  label="Event Name"
                  value={taskName}
                  onChange={(e) => setTaskName(e.target.value)}
                  placeholder="Event Name"
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
                  placeholder="Location"
                  fullWidth
                />
              </FormField>
              <FormField>
                <MDInput
                  type="text"
                  label="Tutor"
                  value={tutor}
                  onChange={(e) => setTutor(e.target.value)}
                  placeholder="Tutor"
                  fullWidth
                />
              </FormField>
              <FormField>
                <MDInput
                  type="date"
                  label="Date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  fullWidth
                />
              </FormField>
              <FormField>
                <FormControl component="fieldset">
                  <MDTypography variant="h6" style={{ fontSize: "14px" }}>
                    Preset Time Slots
                  </MDTypography>
                  <RadioGroup
                    className="time-radio"
                    row
                    value={presetTime}
                    onChange={handlePresetTimeChange}
                  >
                    <FormControlLabel
                      value="morning"
                      control={<Radio />}
                      label="10:00am - 12:30pm"
                    />
                    <FormControlLabel
                      value="afternoon"
                      control={<Radio />}
                      label="1:30pm - 3:00pm"
                    />
                  </RadioGroup>
                </FormControl>
              </FormField>
              <TimePickerContainer>
                <FormField>
                  <TimePicker
                    label="Start Time"
                    value={startTime}
                    onChange={(newValue) => setStartTime(newValue)}
                    ampm={false}
                    renderInput={(params) => <MDInput {...params} fullWidth required />}
                  />
                </FormField>
                <FormField>
                  <TimePicker
                    label="End Time"
                    value={endTime}
                    ampm={false}
                    onChange={(newValue) => setEndTime(newValue)}
                    renderInput={(params) => <MDInput {...params} fullWidth required />}
                  />
                </FormField>
              </TimePickerContainer>

              <FormField>
                <FormControl fullWidth>
                  <InputLabel id="participants-label">Participants</InputLabel>
                  <Select
                    labelId="participants-label"
                    id="participants-select"
                    multiple
                    value={participants} // array of UIDs
                    onChange={handleParticipantsChange}
                    input={<OutlinedInput label="Participants" />}
                    MenuProps={{
                      ...MenuProps,
                      PaperProps: { sx: { maxHeight: 48 * 6 + 8, width: 300 } },
                    }}
                    renderValue={(selected) => (
                      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                        {selected.map((id) => (
                          <Chip
                            key={id}
                            label={participantsById[id]?.name || userNameMap[id] || id}
                            size="small"
                          />
                        ))}
                      </Box>
                    )}
                    sx={{ padding: "0.75rem", "& .MuiInputBase-root": { padding: "0.75rem" } }}
                  >
                    {participantOptions.map((u) => (
                      <CustomMenuItem key={u.id} value={u.id}>
                        {u.name}
                      </CustomMenuItem>
                    ))}
                  </Select>
                </FormControl>
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

              <ColorPickerModal
                open={isColorPickerOpen}
                onClose={handleCloseColorPicker}
                selectedColor={color}
                onSelectColor={handleColorChange}
              />

              {scheduleStrand === "actor" && (
                <FormField>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={isProductionEvent}
                        onChange={(e) => setIsProductionEvent(e.target.checked)}
                        color="primary"
                      />
                    }
                    label="Production Event"
                  />
                </FormField>
              )}
              <MDBox pt={2} display="flex" justifyContent="space-between" alignItems="center">
                <MDButton type="submit" variant="contained" color="info" size="small">
                  Save
                </MDButton>
                <MDButton
                  type="button"
                  onClick={() => setIsEditing(false)}
                  variant="outlined"
                  color="info"
                  size="small"
                >
                  Cancel
                </MDButton>
              </MDBox>
            </form>
          ) : (
            <MDBox>
              <FormField>
                <MDTypography variant="body2" fontWeight="regular">
                  <strong>Task Name:</strong> {event.resource.title}
                </MDTypography>
              </FormField>
              <FormField>
                <MDTypography variant="body2" fontWeight="regular">
                  <strong>Location:</strong> {event.resource?.location || "No location provided"}
                </MDTypography>
              </FormField>
              <FormField>
                <MDTypography variant="body2" fontWeight="regular">
                  <strong>Tutor:</strong> {event.resource?.tutor || "No tutor provided"}
                </MDTypography>
              </FormField>
              <FormField>
                <MDTypography variant="body2" fontWeight="regular">
                  <strong>Date:</strong> {new Date(event.start).toLocaleDateString()}
                </MDTypography>
              </FormField>
              <FormField>
                <MDTypography variant="body2" fontWeight="regular">
                  <strong>Start Time:</strong>{" "}
                  {event.resource?.startTime || "No start time provided"}
                </MDTypography>
              </FormField>
              <FormField>
                <MDTypography variant="body2" fontWeight="regular">
                  <strong>End Time:</strong> {event.resource?.endTime || "No end time provided"}
                </MDTypography>
              </FormField>
              {showParticipants && (
                <FormField>
                  <MDTypography variant="body2" fontWeight="regular">
                    <strong>Participants:</strong>{" "}
                    {participantIds.length
                      ? participantIds.map((id) => userNameMap[id] || id).join(", ")
                      : "No participants"}
                  </MDTypography>
                </FormField>
              )}
              {canEdit && (
                <MDBox pt={2} display="flex" justifyContent="space-between" alignItems="center">
                  <MDButton
                    variant="outlined"
                    color="info"
                    size="small"
                    onClick={() => setIsEditing(true)}
                  >
                    Edit
                  </MDButton>
                  <MDButton variant="outlined" color="error" size="small" onClick={handleDelete}>
                    Delete
                  </MDButton>
                </MDBox>
              )}
            </MDBox>
          )}
        </LocalizationProvider>
      </ModalContainer>
    </ModalOverlay>
  );
};

EventModal.propTypes = {
  event: PropTypes.object.isRequired,
  actors: PropTypes.array.isRequired,
  scheduleStrand: PropTypes.oneOf(["actor", "student"]),
  onClose: PropTypes.func.isRequired,
  canEdit: PropTypes.bool,
  showParticipants: PropTypes.bool,
};

export default EventModal;
