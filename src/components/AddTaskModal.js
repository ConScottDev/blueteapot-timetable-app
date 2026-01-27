import React, { useState, useEffect, useCallback } from "react";
import { debounce } from "lodash";
import { db } from "utils/firebase";
import { collection, addDoc, getDocs, query, where } from "firebase/firestore";
import styled from "styled-components";
import PropTypes from "prop-types";
import MDButton from "./MDButton";
import MDTypography from "./MDTypography";
import MDBox from "./MDBox";
import MDInput from "./MDInput";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import OutlinedInput from "@mui/material/OutlinedInput";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import { useTheme } from "@mui/material/styles";
import { TimePicker } from "@mui/x-date-pickers/TimePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";
import { Autocomplete, Checkbox, TextareaAutosize, TextField } from "@mui/material";
import DatePicker from "react-multi-date-picker";
import "../assets/addTaskModal.css";
import { ChromePicker } from "react-color";
import ColorPickerModal from "./Modals/Color Picker/ColorPickerModal";
import { orderBy, startAt, endAt, limit } from "firebase/firestore";
import { useMemo } from "react";
import { Popover, Box, IconButton, Tooltip, Chip, Stack, Button } from "@mui/material";
import { useRef } from "react";

// Define color options
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
  max-height: 100vh; /* Set maximum height to 80% of viewport height */
  overflow-y: auto; /* Add vertical scrollbar if content overflows */
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
  flex: 1;
`;

const TimePickerContainer = styled.div`
  display: flex;
  align-items: center; /* Vertically align items */
  gap: 10px;
`;

const AddTaskModal = ({ onClose, scheduleStrand }) => {
  const [titleSuggestions, setTitleSuggestions] = useState([]);
  const [taskName, setTaskName] = useState("");
  const [location, setLocation] = useState("");
  const [tutor, setTutor] = useState("");
  const [dates, setDates] = useState([]);
  const [startTime, setStartTime] = useState(dayjs());
  const [endTime, setEndTime] = useState(dayjs());
  const [participants, setParticipants] = useState([]);
  const [actors, setActors] = useState([]);
  const [students, setStudents] = useState([]);
  const [actorSupport, setActorSupport] = useState([]);
  const [pasSupport, setPasSupport] = useState([]);
  const [presetTime, setPresetTime] = useState("");
  const [isProductionEvent, setIsProductionEvent] = useState(false);
  const [color, setColor] = useState(colorOptions[0].hex); // Default color
  const modalTitle = "Add Task";
  const [searchTerm, setSearchTerm] = useState("");
  const [matchingTasks, setMatchingTasks] = useState([]);
  const [taskTitles, setTaskTitles] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [strands, setStrands] = useState(() => [scheduleStrand]); // auto-assign
  const [studentYears, setStudentYears] = useState([]);
  useEffect(() => {
    setStrands([scheduleStrand]); // keep in sync if user switches tabs/views
  }, [scheduleStrand]);
  const theme = useTheme();

  const yearOptions = useMemo(() => [1, 2, 3], []);

  const handleOpenColorPicker = () => {
    setIsColorPickerOpen(true);
  };

  const swatchSize = 24;

  function ColorSwatch({ hex, onClick, title }) {
    return (
      <Tooltip title={title || hex}>
        <Box
          onClick={onClick}
          sx={{
            width: swatchSize,
            height: swatchSize,
            borderRadius: "50%",
            bgcolor: hex,
            border: "1px solid rgba(0,0,0,0.15)",
            cursor: "pointer",
          }}
        />
      </Tooltip>
    );
  }

  ColorSwatch.propTypes = {
    hex: PropTypes.string.isRequired,
    onClick: PropTypes.func,
    title: PropTypes.string,
  };
  ColorSwatch.defaultProps = {
    onClick: () => {},
    title: undefined,
  };

  const RC_KEY = "bt_recent_colors";
  const [recentColors, setRecentColors] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(RC_KEY)) || [];
    } catch {
      return [];
    }
  });
  const pushRecentColor = (hex) => {
    if (!hex) return;
    const next = [hex, ...recentColors.filter((c) => c !== hex)].slice(0, 6);
    setRecentColors(next);
    localStorage.setItem(RC_KEY, JSON.stringify(next));
  };

  const handleCloseColorPicker = () => {
    setIsColorPickerOpen(false);
  };

  const participantOptions = useMemo(() => {
    const base = scheduleStrand === "actor" ? actors : students;
    const support = scheduleStrand === "actor" ? actorSupport : pasSupport;

    // de-dupe by id while preserving order (actors/students first, then support)
    const seen = new Set();
    const merged = [];
    [...base, ...support].forEach((user) => {
      if (!user?.id || seen.has(user.id)) return;
      seen.add(user.id);
      merged.push(user);
    });
    return merged;
  }, [actors, actorSupport, pasSupport, scheduleStrand, students]);

  const participantsById = useMemo(
    () => Object.fromEntries(participantOptions.map((p) => [p.id, p])),
    [participantOptions]
  );

  const handleColorChange = (newColor) => {
    setColor(newColor);
    pushRecentColor(newColor);
  };

  // helper to normalize for de-dupe
  const norm = (s) => (s || "").trim().toLowerCase();

  // NEW: one debounced function that queries both collections and merges results
  const runTitleQuery = useMemo(
    () =>
      debounce(async (q) => {
        const needle = norm(q);
        if (!needle || needle.length < 2) {
          setTitleSuggestions([]);
          return;
        }

        // prefix query helper for a collection
        const fetchPrefix = async (colName) => {
          try {
            const ref = collection(db, colName);
            const snap = await getDocs(
              query(ref, orderBy("title_lc"), startAt(needle), endAt(needle + "\uf8ff"), limit(10))
            );
            return snap.docs.map((d) => ({
              source: colName, // "taskList" or "tasks"
              id: d.id,
              ...d.data(),
            }));
          } catch (err) {
            // If the index / field is missing, just return empty for this source.
            // (Optional) console.warn('Prefix query failed for', colName, err);
            return [];
          }
        };

        const [fromTaskList, fromTasks] = await Promise.all([
          fetchPrefix("taskList"),
          fetchPrefix("tasks"),
        ]);

        // Merge + de-dupe by (title, location, tutor). Prefer taskList when duplicate.
        const merged = [...fromTaskList, ...fromTasks];
        const dedup = new Map();
        for (const it of merged) {
          const key = `${norm(it.title)}|${norm(it.location)}|${norm(it.tutor)}`;
          // if key not present, set; if present and current is taskList, overwrite
          if (!dedup.has(key) || it.source === "taskList") dedup.set(key, it);
        }

        const options = Array.from(dedup.values()).slice(0, 10);

        // If nothing came back (e.g., missing index), do a local fallback using any cached lists
        if (options.length === 0) {
          const local = (tasks || []).filter((t) => norm(t.title).includes(needle)).slice(0, 10);
          setTitleSuggestions(local);
        } else {
          setTitleSuggestions(options);
        }
      }, 250),
    [tasks] // keep a light local fallback
  );

  useEffect(() => {
    runTitleQuery(taskName);
    return () => runTitleQuery.cancel();
  }, [taskName, runTitleQuery]);

  useEffect(() => {
    const fetchParticipantsByRole = async (role) => {
      const usersRef = collection(db, "users");
      const snap = await getDocs(
        query(usersRef, where("role", "==", role), where("disabled", "==", false))
      );

      return snap.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id, // uid
          name: data.displayName || data.name || data.email || "Unnamed",
          email: data.email || "",
          ...data,
        };
      });
    };

    const loadParticipants = async () => {
      try {
        const [actorList, studentList, actorSupportList, pasSupportList] = await Promise.all([
          fetchParticipantsByRole("actor"),
          fetchParticipantsByRole("student"),
          fetchParticipantsByRole("actor_support_staff"),
          fetchParticipantsByRole("pas_support"),
        ]);
        setActors(actorList);
        setStudents(studentList);
        setActorSupport(actorSupportList);
        setPasSupport(pasSupportList);
      } catch (err) {
        console.error("Error fetching users for participants:", err);
        setActors([]);
        setStudents([]);
        setActorSupport([]);
        setPasSupport([]);
      }
    };

    loadParticipants();
  }, []);

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const taskRef = collection(db, "taskList");
        const querySnapshot = await getDocs(taskRef);
        const tasksData = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setTasks(tasksData);
        setTaskTitles(tasksData.map((task) => task.title));
      } catch (error) {
        console.error("Error fetching tasks: ", error);
      }
    };

    fetchTasks();
  }, []);

  const deriveParticipantsFromYears = useCallback(() => {
    if (scheduleStrand !== "student" || studentYears.length === 0) return [];
    const selectedYears = new Set(
      studentYears.map((year) => Number(year)).filter((year) => Number.isFinite(year))
    );

    const seen = new Set();
    const yearMatches = [];

    students.forEach((student) => {
      const year = Number(student?.studentMeta?.year ?? student?.studentYear ?? student?.year);
      if (!Number.isFinite(year)) return;
      if (!selectedYears.has(year)) return;
      if (seen.has(student.id)) return;
      seen.add(student.id);
      yearMatches.push(student.id);
    });

    return yearMatches;
  }, [scheduleStrand, studentYears, students]);

  useEffect(() => {
    if (scheduleStrand !== "student") return;
    setParticipants(deriveParticipantsFromYears());
  }, [deriveParticipantsFromYears, scheduleStrand]);

  const handleParticipantsChange = (event) => {
    const {
      target: { value },
    } = event;
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
    } else if (selectedTime === "allDay") {
      setStartTime(dayjs().hour(10).minute(0));
      setEndTime(dayjs().hour(15).minute(0));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (scheduleStrand === "student" && studentYears.length === 0) {
      alert("Please select at least one student year.");
      return;
    }

    const yearDerivedParticipants =
      scheduleStrand === "student" && studentYears.length > 0
        ? deriveParticipantsFromYears()
        : participants;

    if (
      scheduleStrand === "student" &&
      studentYears.length > 0 &&
      yearDerivedParticipants.length === 0
    ) {
      alert("Please add at least one participant for the selected year(s).");
      return;
    }

    try {
      for (const date of dates) {
        // Convert the custom date object to a string in YYYY-MM-DD format
        const formattedDate = dayjs(date).format("YYYY-MM-DD");

        const startTimeFormatted = dayjs(startTime).format("HH:mm");
        const endTimeFormatted = dayjs(endTime).format("HH:mm");

        const taskData = {
          title: taskName,
          title_lc: taskName.toLowerCase(), // lowercase for indexing/search
          strands,
          location,
          tutor,
          date: formattedDate,
          startTime: presetTime === "allDay" ? "10:00" : startTimeFormatted,
          endTime: presetTime === "allDay" ? "15:00" : endTimeFormatted,
          participants: yearDerivedParticipants,
          color,
          ...(isProductionEvent && { production: true }),
          ...(scheduleStrand === "student" ? { studentYears } : {}),
        };

        await addDoc(collection(db, "tasks"), taskData);
        console.log("Task added for date: ", formattedDate);
      }
      rememberLightweight("loc", location);
      rememberLightweight("tutor", tutor);

      onClose(); // Close modal after successful submission
    } catch (error) {
      console.error("Error adding task: ", error);
    }
  };
  function uniq(arr) {
    return [...new Set(arr.filter(Boolean).map((s) => s.trim()))];
  }

  const LS_KEYS = {
    loc: "bt_loc_suggestions",
    tutor: "bt_tutor_suggestions",
  };

  const loadLocal = (k) => {
    try {
      return JSON.parse(localStorage.getItem(k)) || [];
    } catch {
      return [];
    }
  };
  const saveLocal = (k, arr) => localStorage.setItem(k, JSON.stringify(arr.slice(0, 20))); // cap length

  const [locationOptions, setLocationOptions] = useState(() => loadLocal(LS_KEYS.loc));
  const [tutorOptions, setTutorOptions] = useState(() => loadLocal(LS_KEYS.tutor));

  // After a successful submit, remember values:
  const rememberLightweight = (kind, value) => {
    if (!value) return;
    if (kind === "loc") {
      const next = uniq([value, ...locationOptions]);
      setLocationOptions(next);
      saveLocal(LS_KEYS.loc, next);
    } else {
      const next = uniq([value, ...tutorOptions]);
      setTutorOptions(next);
      saveLocal(LS_KEYS.tutor, next);
    }
  };

  function CustomMultipleInput({ onFocus, value }) {
    // Check if value is an array and join it into a string

    return (
      <TextField
        onFocus={onFocus}
        value={value} // Use the formatted value
        readOnly
        multiline
        label="Select Dates"
        style={{ width: "100%" }}
        required
      />
    );
  }

  return (
    <ModalOverlay style={{ zIndex: 1200 }}>
      <ModalContainer>
        <LocalizationProvider dateAdapter={AdapterDayjs}>
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
              <Autocomplete
                sx={{ padding: "0px !important" }}
                freeSolo
                options={titleSuggestions}
                // handle objects AND plain strings (freeSolo can pass strings)
                getOptionLabel={(opt) => (typeof opt === "string" ? opt : opt?.title ?? "")}
                isOptionEqualToValue={(opt, val) =>
                  opt?.id && val?.id
                    ? opt.id === val.id
                    : opt?.title && val?.title
                    ? opt.title === val.title
                    : String(opt) === String(val)
                }
                inputValue={taskName}
                onInputChange={(e, v) => setTaskName(v)}
                onChange={(e, newValue) => {
                  // newValue can be: object (picked option) OR string (typed & enter)
                  if (!newValue) {
                    setTaskName("");
                    setLocation("");
                    setTutor("");
                    return;
                  }
                  if (typeof newValue === "string") {
                    setTaskName(newValue);
                    return;
                  }
                  setTaskName(newValue.title || "");
                  setLocation(newValue.location || "");
                  setTutor(newValue.tutor || "");
                  setColor(newValue.color || color);
                  // ensure the created task will include the current schedule strand
                  const merged = Array.from(new Set([...(newValue.strands || []), scheduleStrand]));
                  setStrands(merged);
                }}
                // Let Firestore results be the source of truth
                filterOptions={(x) => x}
                renderInput={(params) => (
                  <MDInput {...params} label="Event Name" fullWidth required />
                )}
              />
            </FormField>
            <FormField>
              <Autocomplete
                freeSolo
                options={locationOptions}
                inputValue={location}
                onInputChange={(e, v) => setLocation(v)}
                renderInput={(params) => <MDInput {...params} label="Location" fullWidth />}
              />
            </FormField>
            <FormField>
              <Autocomplete
                freeSolo
                options={tutorOptions}
                inputValue={tutor}
                onInputChange={(e, v) => setTutor(v)}
                renderInput={(params) => <MDInput {...params} label="Tutor" fullWidth />}
              />
            </FormField>
            <FormField>
              <DatePicker
                multiple
                value={dates}
                onChange={setDates}
                format="DD/MM/YYYY" // Desired date format
                placeholder="Select Dates"
                fullWidth
                render={<CustomMultipleInput />}
                required
              />
            </FormField>

            {scheduleStrand === "student" && (
              <FormField>
                <FormControl fullWidth>
                  <InputLabel id="student-years-label">Student Year(s)</InputLabel>
                  <Select
                    labelId="student-years-label"
                    id="student-years-select"
                    multiple
                    value={studentYears}
                    onChange={(event) => {
                      const {
                        target: { value },
                      } = event;
                      const next = typeof value === "string" ? value.split(",") : value;
                      setStudentYears(next.map((v) => Number(v)));
                    }}
                    input={<OutlinedInput label="Student Year(s)" />}
                    renderValue={(selected) => (
                      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                        {selected.map((year) => (
                          <Chip key={year} label={`Year ${year}`} size="small" />
                        ))}
                      </Box>
                    )}
                    MenuProps={MenuProps}
                    sx={{
                      padding: "0.75rem",
                      "& .MuiInputBase-root": { padding: "0.75rem" },
                    }}
                  >
                    {yearOptions.map((year) => (
                      <CustomMenuItem key={year} value={year}>
                        Year {year}
                      </CustomMenuItem>
                    ))}
                  </Select>
                </FormControl>
              </FormField>
            )}

            <FormField>
              <FormControl component="fieldset" style={{ width: "100%" }}>
                <MDTypography variant="h6" style={{ fontSize: "14px", marginBottom: "8px" }}>
                  Preset Time Slots
                </MDTypography>
                <RadioGroup
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
                  className="time-radio"
                  row
                  value={presetTime}
                  onChange={handlePresetTimeChange}
                >
                  <FormControlLabel
                    value="morning"
                    control={<Radio />}
                    label={
                      <MDTypography variant="body2" style={{ fontSize: "14px" }}>
                        10:00am
                        <br /> 12:30pm
                      </MDTypography>
                    }
                  />
                  <FormControlLabel
                    value="afternoon"
                    control={<Radio />}
                    label={
                      <MDTypography variant="body2" style={{ fontSize: "14px" }}>
                        1:30pm
                        <br /> 3:00pm
                      </MDTypography>
                    }
                  />
                  <FormControlLabel
                    value="allDay"
                    control={<Radio />}
                    label={
                      <MDTypography variant="body2" style={{ fontSize: "14px" }}>
                        All Day
                      </MDTypography>
                    }
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
                  required
                  value={participants} // array of user IDs (uids)
                  onChange={handleParticipantsChange}
                  input={<OutlinedInput label="Participants" />}
                  MenuProps={MenuProps}
                  renderValue={(selected) => (
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                      {selected.map((id) => (
                        <Chip key={id} label={participantsById[id]?.name || id} size="small" />
                      ))}
                    </Box>
                  )}
                  sx={{
                    padding: "0.75rem",
                    "& .MuiInputBase-root": { padding: "0.75rem" },
                  }}
                >
                  {participantOptions.map((user) => (
                    <CustomMenuItem
                      key={user.id}
                      value={user.id}
                      style={{
                        fontWeight:
                          participants.indexOf(user.id) !== -1
                            ? theme.typography.fontWeightMedium
                            : theme.typography.fontWeightRegular,
                      }}
                    >
                      {user.name}
                    </CustomMenuItem>
                  ))}
                </Select>
              </FormControl>
            </FormField>
            <FormField>
              <FormControl fullWidth>
                <MDTypography variant="caption" sx={{ mb: 0.5, display: "block" }}>
                  Event Colour
                </MDTypography>

                <Chip
                  label="Color"
                  onClick={(e) => setAnchorEl(e.currentTarget)}
                  sx={{
                    width: "fit-content",
                    pl: 1,
                    "& .MuiChip-avatar": {
                      width: 14,
                      height: 14,
                      bgcolor: color,
                      borderRadius: "50%",
                    },
                  }}
                  avatar={<Box />}
                  variant="outlined"
                />

                <Popover
                  open={Boolean(anchorEl)}
                  anchorEl={anchorEl}
                  onClose={() => setAnchorEl(null)}
                  anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
                  transformOrigin={{ vertical: "top", horizontal: "left" }}
                  PaperProps={{ sx: { p: 2, bgcolor: "#fff" } }}
                >
                  <Stack spacing={1.5} sx={{ minWidth: 220 }}>
                    {recentColors.length > 0 && (
                      <>
                        <MDTypography variant="caption" sx={{ color: "text.secondary" }}>
                          Recent
                        </MDTypography>
                        <Box
                          sx={{ display: "grid", gridTemplateColumns: "repeat(6, 24px)", gap: 1 }}
                        >
                          {recentColors.map((c) => (
                            <ColorSwatch
                              key={c}
                              hex={c}
                              onClick={() => {
                                handleColorChange(c);
                                setAnchorEl(null);
                              }}
                            />
                          ))}
                        </Box>
                      </>
                    )}

                    <MDTypography
                      variant="caption"
                      sx={{ color: "text.secondary", mt: recentColors.length ? 1 : 0 }}
                    >
                      Palette
                    </MDTypography>
                    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(6, 24px)", gap: 1 }}>
                      {colorOptions.map((o) => (
                        <ColorSwatch
                          key={o.hex}
                          hex={o.hex}
                          title={o.name}
                          onClick={() => {
                            handleColorChange(o.hex);
                            setAnchorEl(null);
                          }}
                        />
                      ))}
                    </Box>

                    <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 1 }}>
                      <Button
                        size="small"
                        onClick={() => {
                          setAnchorEl(null);
                          handleOpenColorPicker(); // opens your existing modal
                        }}
                      >
                        Custom…
                      </Button>
                    </Box>
                  </Stack>
                </Popover>
              </FormControl>

              <ColorPickerModal
                open={isColorPickerOpen}
                onClose={handleCloseColorPicker}
                selectedColor={color}
                onSelectColor={handleColorChange}
              />
            </FormField>

            {scheduleStrand === "actor" && (
              <FormField>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={isProductionEvent}
                      onChange={(e) => setIsProductionEvent(e.target.checked)}
                    />
                  }
                  label="Production Event"
                />
              </FormField>
            )}
            <MDBox display="flex" justifyContent="space-between" alignItems="center">
              <MDButton type="submit" variant="contained" color="info" size="small">
                Add Task
              </MDButton>
              <MDButton
                type="button"
                onClick={onClose}
                variant="outlined"
                color="info"
                size="small"
              >
                Close
              </MDButton>
            </MDBox>
          </form>
        </LocalizationProvider>
      </ModalContainer>
    </ModalOverlay>
  );
};

AddTaskModal.propTypes = {
  onClose: PropTypes.func.isRequired,
  scheduleStrand: PropTypes.oneOf(["actor", "student"]).isRequired,
};

export default AddTaskModal;
