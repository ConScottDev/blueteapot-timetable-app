// components/schedule/ScheduleCore.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { collection, getDocs, onSnapshot, query, where } from "firebase/firestore";
import { db } from "utils/firebase";
import { Calendar, momentLocalizer, Views } from "react-big-calendar";
import moment from "moment";
import "react-big-calendar/lib/css/react-big-calendar.css";

import useMediaQuery from "@mui/material/useMediaQuery";

import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import MDBox from "components/MDBox";
import { Card } from "@mui/material";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import MDButton from "components/MDButton";

import AddTaskModal from "components/AddTaskModal";
import EventModal from "components/schedule/EventModal";
import GroupToggle from "components/GroupToggle";
import CustomPrintView from "components/CustomPrintView";
import ProductionCalendar from "components/ProductionCalendar";
import CustomEvent from "components/CustomEvent";
import AddIcon from "@mui/icons-material/Add";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFnsV3";
import { useActor } from "context/ActorProvider";
import { useAuth } from "auth/AuthProvider";
import { resolveDefaultRouteForRoles } from "auth/roleUtils";
import { PrintNotesProvider } from "context/PrintNotesContext";

import "../../assets/MasterSchedule.css";

import { useNavigate } from "react-router-dom";

const localizer = momentLocalizer(moment);

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

const normalizeParticipantIds = (list) => {
  if (!Array.isArray(list)) return [];
  const result = [];
  for (const item of list) {
    const id = extractParticipantId(item);
    if (id && !result.includes(id)) result.push(id);
  }
  return result;
};

const participantIdentifierKeys = (participant) => {
  if (!participant) return [];
  if (typeof participant === "string") return [participant];
  const keys = [];
  const candidates = [participant.id, participant.uid, participant.userId, participant.value];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim() && !keys.includes(candidate)) {
      keys.push(candidate);
    }
  }
  return keys;
};

const normalizeKeyValue = (value) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.toLowerCase() : null;
};

const deriveYearFromUser = (user) => {
  if (!user) return null;
  const numericStudentYear = Number(user?.studentYear);
  if (Number.isFinite(numericStudentYear)) return numericStudentYear;
  if (typeof user?.group === "string") {
    const match = user.group.match(/([0-9]+)/);
    if (match) {
      const parsed = Number(match[1]);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
};

const buildUserParticipantCandidates = (user, userYear) => {
  if (!user) return [];
  const values = new Set();
  const add = (value) => {
    if (value === undefined || value === null) return;
    const str = String(value).trim();
    if (str) values.add(str);
  };

  add(user.uid);
  add(user.email);
  add(user.group);
  if (Array.isArray(user?.groups)) {
    user.groups.forEach(add);
  }
  if (Number.isFinite(userYear)) {
    add(`year${userYear}`);
    add(`year ${userYear}`);
    add(String(userYear));
  }
  return Array.from(values);
};

const CalendarToolbar = ({
  label,
  localizer,
  onNavigate,
  onView,
  view,
  views,
  canSelectStudentYear = false,
  selectedYear,
  onStudentYearChange,
}) => {
  const isMobileToolbar = useMediaQuery("(max-width:600px)");
  const availableViews = useMemo(() => {
    if (!views) return [];
    if (Array.isArray(views)) return views;
    if (typeof views === "object") {
      return Object.keys(views).filter((name) => views[name]);
    }
    return [views];
  }, [views]);

  const options = useMemo(
    () =>
      availableViews.map((name) => {
        const friendly = localizer?.messages?.[name];
        const fallback = name ? name.charAt(0).toUpperCase() + name.slice(1) : "";
        return { value: name, label: friendly || fallback };
      }),
    [availableViews, localizer]
  );

  const [anchorEl, setAnchorEl] = useState(null);
  const [yearAnchorEl, setYearAnchorEl] = useState(null);
  const currentOption = options.find((option) => option.value === view) || options[0];
  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };
  const handleMenuClose = () => setAnchorEl(null);
  const handleYearMenuOpen = (event) => {
    setYearAnchorEl(event.currentTarget);
  };
  const handleYearMenuClose = () => setYearAnchorEl(null);

  const hideNavigation = view === "print";
  const isMonthOnlyView = availableViews.length === 1 && availableViews.includes("month");
  const showInlineMobileMonthLabel = isMobileToolbar && view === "month" && isMonthOnlyView;
  const showMobileNavigationSpacing = isMobileToolbar && view === "month";
  const showYearSelect =
    canSelectStudentYear &&
    typeof onStudentYearChange === "function" &&
    Number.isFinite(selectedYear);
  const showSeparatedMobileSelectors = isMobileToolbar && showYearSelect && options.length > 1;

  const selectorButtonSx = {
    minWidth: { xs: 108, sm: 120 },
    justifyContent: "space-between",
    px: { xs: 1.25, sm: 2 },
    height: { xs: 36, sm: "auto" },
  };
  const selectedYearLabel = showYearSelect ? `Year ${selectedYear}` : "Select year";

  return (
    <MDBox
      display="flex"
      flexWrap="wrap"
      alignItems={isMobileToolbar ? "flex-start" : "center"}
      justifyContent="space-between"
      px={{ xs: 0, md: 0 }}
      pb={1.5}
      gap={1.5}
    >
      <MDBox
        display="flex"
        alignItems="center"
        flexWrap="wrap"
        gap={1}
        sx={{
          flex: showInlineMobileMonthLabel ? "1 1 100%" : undefined,
          minWidth: showInlineMobileMonthLabel ? 0 : undefined,
          width: showMobileNavigationSpacing ? "100%" : undefined,
          justifyContent: showMobileNavigationSpacing ? "space-between" : undefined,
        }}
      >
        {!hideNavigation && (
          <MDButton
            size="small"
            variant="outlined"
            color="dark"
            onClick={() => onNavigate("TODAY")}
            sx={{
              px: { xs: 1.25, sm: 2 },
              height: { xs: 36, sm: "auto" },
            }}
          >
            Today
          </MDButton>
        )}
        {!hideNavigation && (
          <MDBox display="flex" alignItems="center" gap={0.5} sx={{ ml: "auto" }}>
            <IconButton
              size="small"
              aria-label="Previous period"
              onClick={() => onNavigate("PREV")}
            >
              <ChevronLeftIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" aria-label="Next period" onClick={() => onNavigate("NEXT")}>
              <ChevronRightIcon fontSize="small" />
            </IconButton>
          </MDBox>
        )}
        {(!isMobileToolbar || showInlineMobileMonthLabel) && (
          <MDBox
            component="span"
            sx={{
              fontWeight: 600,
              fontSize: "1rem",
              ml: showInlineMobileMonthLabel ? "auto" : 0,
              textAlign: showInlineMobileMonthLabel ? "right" : "inherit",
              flexShrink: 0,
            }}
          >
            {label}
          </MDBox>
        )}
      </MDBox>
      {(options.length > 1 || showYearSelect) && (
        <MDBox
          display="flex"
          alignItems="center"
          flexWrap={showSeparatedMobileSelectors ? "nowrap" : "wrap"}
          gap={{ xs: 0.75, sm: 1 }}
          sx={{
            width: showSeparatedMobileSelectors ? "100%" : "auto",
            flex: showSeparatedMobileSelectors ? "1 1 100%" : "0 0 auto",
            ml: { xs: showSeparatedMobileSelectors ? 0 : "auto", sm: 0 },
            mt: { xs: 0, sm: 0 },
            justifyContent: showSeparatedMobileSelectors ? "space-between" : "flex-end",
            flexShrink: showSeparatedMobileSelectors ? 1 : 0,
          }}
        >
          {showYearSelect && (
            <>
              <MDButton
                size="small"
                variant="outlined"
                color="dark"
                sx={{ ...selectorButtonSx }}
                onClick={handleYearMenuOpen}
                endIcon={<ArrowDropDownIcon />}
              >
                {selectedYearLabel}
              </MDButton>
              <Menu
                anchorEl={yearAnchorEl}
                open={Boolean(yearAnchorEl)}
                onClose={handleYearMenuClose}
              >
                {[1, 2, 3].map((year) => (
                  <MenuItem
                    key={year}
                    selected={year === selectedYear}
                    onClick={() => {
                      handleYearMenuClose();
                      if (year !== selectedYear) {
                        onStudentYearChange(year);
                      }
                    }}
                  >
                    {`Year ${year}`}
                  </MenuItem>
                ))}
              </Menu>
            </>
          )}
          {options.length > 1 && (
            <>
              <MDButton
                size="small"
                variant="outlined"
                color="dark"
                sx={{ ...selectorButtonSx }}
                onClick={handleMenuOpen}
                endIcon={<ArrowDropDownIcon />}
              >
                {currentOption?.label ?? "View"}
              </MDButton>
              <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
                {options.map((option) => (
                  <MenuItem
                    key={option.value}
                    selected={option.value === currentOption?.value}
                    onClick={() => {
                      handleMenuClose();
                      if (option.value && option.value !== view) onView(option.value);
                    }}
                  >
                    {option.label}
                  </MenuItem>
                ))}
              </Menu>
            </>
          )}
        </MDBox>
      )}
      {isMobileToolbar && !showInlineMobileMonthLabel && (
        <MDBox width="100%" sx={{ fontWeight: 600, fontSize: "1rem", mt: 1, textAlign: "center" }}>
          {label}
        </MDBox>
      )}
    </MDBox>
  );
};

/**
 * Props:
 * - strand: "actor" | "student"
 * - participantsSource: { actors?: boolean, students?: boolean, groups?: boolean }
 * - allowMultiSelect: { [viewName: string]: boolean }
 */
export default function ScheduleCore({
  strand,
  participantsSource,
  allowMultiSelect,
  readOnly = false,
  disableEditing = false,
}) {
  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);

  const navigate = useNavigate();
  const [permDenied, setPermDenied] = useState(false);

  const isSmall = useMediaQuery("(max-width:900px)");
  const isMobile = useMediaQuery("(max-width:600px)");
  const isEditable = !readOnly && !disableEditing;

  const [tasks, setTasks] = useState([]);
  const [actors, setActors] = useState([]);
  const [students, setStudents] = useState([]);
  const [groups, setGroups] = useState([]);

  const [selectedParticipants, setSelectedParticipants] = useState([]);
  const [currentView, setCurrentView] = useState(Views.MONTH);
  const { selectedActor, setSelectedActor } = useActor();
  const { user } = useAuth();
  const userYear = useMemo(() => deriveYearFromUser(user), [user]);
  const canSelectStudentYear = strand === "student" && !readOnly;

  const includeActors = Boolean(participantsSource?.actors);
  const includeStudents = Boolean(participantsSource?.students);
  const includeGroups = Boolean(participantsSource?.groups);
  const userParticipantCandidates = useMemo(
    () => buildUserParticipantCandidates(user, userYear),
    [user, userYear]
  );
  const normalizedSelectedParticipants = useMemo(() => {
    if (selectedParticipants.length === 0) return new Set();
    const set = new Set();
    selectedParticipants.forEach((value) => {
      const normalized = normalizeKeyValue(value);
      if (normalized) set.add(normalized);
    });
    return set;
  }, [selectedParticipants]);
  const [selectedYear, setSelectedYear] = useState(() => {
    if (strand === "student" && Number.isFinite(userYear)) {
      return userYear;
    }
    return 1;
  });
  useEffect(() => {
    if (!readOnly || strand !== "student") return;
    if (!Number.isFinite(userYear)) return;
    setSelectedYear((prev) => (prev === userYear ? prev : userYear));
  }, [readOnly, strand, userYear]);

  // Lock body scroll when modals are open (keep your behavior)
  useEffect(() => {
    const isModalOpen = isAddTaskModalOpen || isEventModalOpen;
    document.body.style.overflow = isModalOpen ? "hidden" : "";
    return () => (document.body.style.overflow = "");
  }, [isAddTaskModalOpen, isEventModalOpen]);

  // Load participants depending on source
  useEffect(() => {
    if (readOnly) {
      setActors([]);
      setStudents([]);
      setGroups([]);
      return;
    }

    let isCancelled = false;

    const getUsersByRole = async (role) => {
      const usersRef = collection(db, "users");
      const snap = await getDocs(query(usersRef, where("role", "==", role)));
      return snap.docs
        .map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.displayName || data.name || data.email || "Unnamed",
            type: role,
            ...data,
          };
        })
        .filter((user) => user.disabled !== true);
    };

    const getGroups = async () => {
      const groupRef = collection(db, "groups");
      const snap = await getDocs(groupRef);
      return snap.docs.map((doc) => ({
        id: doc.id,
        name: doc.data().name,
        type: "group",
        ...doc.data(),
      }));
    };

    const load = async () => {
      try {
        const [actorList, studentList, groupList] = await Promise.all([
          includeActors ? getUsersByRole("actor") : Promise.resolve([]),
          includeStudents ? getUsersByRole("student") : Promise.resolve([]),
          includeGroups ? getGroups() : Promise.resolve([]),
        ]);

        if (isCancelled) return;
        setActors(actorList);
        setStudents(studentList);
        setGroups(groupList);
      } catch (error) {
        if (isCancelled) return;
        console.error("Error loading participants:", error);
        setActors([]);
        setStudents([]);
        setGroups([]);
      }
    };

    load();

    return () => {
      isCancelled = true;
    };
  }, [includeActors, includeStudents, includeGroups, readOnly]);

  // Load tasks for this strand
  useEffect(() => {
    const q = query(
      collection(db, "tasks"),
      where("strands", "array-contains", strand) // actor OR student for that view
    );
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        setPermDenied(false);
        setTasks(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      },
      (error) => {
        if (error?.code === "permission-denied") {
          setPermDenied(true);
          // Important: don't loop. Unsubscribe stops retries in this hook run.
          // Weâ€™ll render a lightweight message  a button to go â€œhomeâ€.
        }
      }
    );
    return () => unsub();
  }, [strand]);

  // Map id -> participant object for labeling
  const participantMap = useMemo(() => {
    const all = [
      ...(includeActors ? actors : []),
      ...(includeStudents ? students : []),
      ...(includeGroups ? groups : []),
    ];
    return all.reduce((acc, participant) => {
      const keys = participantIdentifierKeys(participant);
      if (keys.length === 0 && participant?.id) {
        acc[participant.id] = participant;
        return acc;
      }
      keys.forEach((key) => {
        acc[key] = participant;
      });
      return acc;
    }, {});
  }, [actors, students, groups, includeActors, includeStudents, includeGroups]);

  const studentYearMap = useMemo(() => {
    if (!includeStudents) return {};
    return students.reduce((acc, student) => {
      const normalizedYear = Number(student?.studentMeta?.year);
      if (!Number.isFinite(normalizedYear)) return acc;
      const keys = participantIdentifierKeys(student);
      if (keys.length === 0 && student?.id) {
        acc[student.id] = normalizedYear;
        return acc;
      }
      keys.forEach((key) => {
        if (key) acc[key] = normalizedYear;
      });
      return acc;
    }, {});
  }, [students, includeStudents]);

  const groupYearMap = useMemo(() => {
    if (!includeGroups) return {};
    return groups.reduce((acc, group) => {
      let keys = participantIdentifierKeys(group);
      if (keys.length === 0 && group?.id) {
        keys = [group.id];
      }
      if (keys.length === 0) return acc;

      const collectedYears = new Set();
      const arrayCandidates = [group?.years, group?.studentYears, group?.levels];
      for (const candidate of arrayCandidates) {
        if (!Array.isArray(candidate)) continue;
        candidate.forEach((value) => {
          const numeric = Number(value);
          if (Number.isFinite(numeric)) {
            collectedYears.add(numeric);
          }
        });
      }

      if (collectedYears.size === 0) {
        const singleCandidates = [group?.year, group?.studentYear, group?.level];
        for (const candidate of singleCandidates) {
          if (candidate === undefined || candidate === null || candidate === "") continue;
          const numeric = Number(candidate);
          if (Number.isFinite(numeric)) {
            collectedYears.add(numeric);
          }
        }
      }

      if (collectedYears.size === 0) {
        const fallbackSources = [group?.name, group?.id];
        for (const source of fallbackSources) {
          if (typeof source !== "string") continue;
          const match = source.match(/year\s*([0-9]+)/i);
          if (match) {
            const numeric = Number(match[1]);
            if (Number.isFinite(numeric)) {
              collectedYears.add(numeric);
              break;
            }
          }
        }
      }

      if (collectedYears.size === 0) return acc;

      const yearsArray = Array.from(collectedYears);
      keys.forEach((key) => {
        if (key) acc[key] = yearsArray;
      });
      return acc;
    }, {});
  }, [groups, includeGroups]);

  const participantsForToggle = useMemo(() => {
    if (readOnly) return [];
    const actorList = includeActors ? actors : [];
    const studentList = includeStudents
      ? students.filter((student) => {
          if (strand !== "student") return true;
          const normalizedYear = Number(student?.studentMeta?.year);
          return Number.isFinite(normalizedYear) && normalizedYear === selectedYear;
        })
      : [];
    const groupList = includeGroups
      ? groups.filter((group) => {
          if (strand !== "student") return true;
          let keys = participantIdentifierKeys(group);
          if (keys.length === 0 && group?.id) {
            keys = [group.id];
          }
          let hasYearMeta = false;
          for (const key of keys) {
            const years = groupYearMap[key];
            if (Array.isArray(years) && years.length > 0) {
              hasYearMeta = true;
              if (years.includes(selectedYear)) {
                return true;
              }
            }
          }
          return !hasYearMeta;
        })
      : [];
    return [...actorList, ...studentList, ...groupList];
  }, [
    actors,
    groups,
    students,
    includeActors,
    includeGroups,
    includeStudents,
    strand,
    selectedYear,
    groupYearMap,
    readOnly,
  ]);

  useEffect(() => {
    if (readOnly) return;
    if (participantsForToggle.length === 0) return;
    setSelectedParticipants((prev) => {
      const validIds = new Set();
      participantsForToggle.forEach((participant) => {
        participantIdentifierKeys(participant).forEach((key) => {
          if (key) validIds.add(key);
        });
      });
      const filtered = prev.filter((id) => validIds.has(id));
      return filtered.length === prev.length ? prev : filtered;
    });
  }, [participantsForToggle, readOnly]);

  useEffect(() => {
    if (!readOnly) return;
    if (userParticipantCandidates.length === 0) return;
    setSelectedParticipants((prev) => {
      const next = userParticipantCandidates;
      if (prev.length === next.length && prev.every((value, index) => value === next[index])) {
        return prev;
      }
      return [...next];
    });
  }, [readOnly, userParticipantCandidates]);

  // Single selection in print/production views
  useEffect(() => {
    if (currentView !== "print" && currentView !== "production") return;

    if (!selectedParticipants.length) {
      setSelectedActor("");
      return;
    }

    const primaryId = selectedParticipants[0];
    const participant = participantMap[primaryId];
    const displayName =
      participant?.displayName ||
      participant?.name ||
      participant?.fullName ||
      participant?.email ||
      primaryId ||
      "";
    setSelectedActor(displayName);
  }, [currentView, selectedParticipants, participantMap, setSelectedActor]);

  // Filter tasks by selected participants and (if production view) production flag
  const filteredTasks = useMemo(() => {
    const yearFilterActive = strand === "student" && Number.isFinite(selectedYear);
    return tasks.filter((task) => {
      const participantIds = normalizeParticipantIds(task.participants);
      const matchesSelection =
        selectedParticipants.length === 0 ||
        participantIds.some((id) => {
          if (selectedParticipants.includes(id)) return true;
          const normalized = normalizeKeyValue(id);
          return normalized ? normalizedSelectedParticipants.has(normalized) : false;
        });

      let matchesYear = true;
      if (yearFilterActive) {
        const derivedYears = new Set();
        if (Array.isArray(task.studentYears)) {
          task.studentYears.forEach((value) => {
            const numeric = Number(value);
            if (Number.isFinite(numeric)) {
              derivedYears.add(numeric);
            }
          });
        }
        const singleYearCandidates = [task.studentYear, task.year, task.targetYear];
        singleYearCandidates.forEach((value) => {
          if (value === undefined || value === null || value === "") return;
          const numeric = Number(value);
          if (Number.isFinite(numeric)) {
            derivedYears.add(numeric);
          }
        });

        if (derivedYears.size > 0) {
          matchesYear = derivedYears.has(selectedYear);
        } else {
          matchesYear = participantIds.some((id) => {
            const studentYear = studentYearMap[id];
            if (Number.isFinite(studentYear)) return studentYear === selectedYear;
            const groupYears = groupYearMap[id];
            if (Array.isArray(groupYears) && groupYears.includes(selectedYear)) return true;
            return false;
          });
          if (!matchesYear && readOnly && matchesSelection) {
            matchesYear = true;
          }
        }
      }

      const baseMatches = matchesSelection && (!yearFilterActive || matchesYear);

      if (currentView === "production") {
        return task.production === true && baseMatches;
      }
      return baseMatches;
    });
  }, [
    tasks,
    selectedParticipants,
    normalizedSelectedParticipants,
    currentView,
    strand,
    selectedYear,
    studentYearMap,
    groupYearMap,
    readOnly,
  ]);

  // rbc events
  const events = useMemo(
    () =>
      filteredTasks.map((t) => ({
        id: t.id,
        title: t.title,
        start: new Date(`${t.date}T${t.startTime}`),
        end: new Date(`${t.date}T${t.endTime}`),
        startTime: t.startTime,
        endTime: t.endTime,
        resource: t,
        tutor: t.tutor,
        location: t.location,
        color: t.color,
        participants: normalizeParticipantIds(t.participants).map(
          (id) => participantMap[id] || { id, name: id }
        ),
      })),
    [filteredTasks, participantMap]
  );

  const handleEventClick = (event) => {
    setSelectedEvent(event);
    setIsEventModalOpen(true);
  };

  const eventPropGetter = (event) => ({
    style: { backgroundColor: event.color || "#3174ad" },
  });

  // Views: restrict read-only users to month view, but expose print/production otherwise
  const views = useMemo(() => {
    const base = readOnly ? { month: true } : { month: true, print: CustomPrintView };
    if (!readOnly && strand === "actor") base.production = ProductionCalendar;
    return base;
  }, [strand, readOnly]);

  const defaultView = useMemo(() => {
    return Views.MONTH;
  }, []);

  const isMulti = useMemo(() => {
    // allowMultiSelect can be a map by view; default to true
    if (!allowMultiSelect) return true;
    const v = currentView === "month" ? "month" : currentView;
    return allowMultiSelect[v] ?? true;
  }, [allowMultiSelect, currentView]);
  const redirectToTimetable = useCallback(() => {
    const roles = Array.isArray(user?.roles) ? user.roles : [];
    const target = resolveDefaultRouteForRoles(roles);
    navigate(target, { replace: true });
  }, [navigate, user]);

  return (
    <PrintNotesProvider>
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <DashboardLayout>
          <DashboardNavbar />
          <MDBox
            sx={({ breakpoints }) => ({
              [breakpoints.down("sm")]: {
                mx: -2, // offset layout padding so card spans edge-to-edge
              },
            })}
          >
            <Card
              sx={({ breakpoints }) => ({
                [breakpoints.down("sm")]: {
                  borderRadius: 0,
                },
              })}
            >
              {permDenied ? (
                <MDBox p={2}>
                  You don&apos;t have access to that timetable.
                  <MDButton sx={{ ml: 2 }} onClick={redirectToTimetable}>
                    Go to my timetable
                  </MDButton>
                </MDBox>
              ) : (
                <>
                  <MDBox pt={2} pb={2} px={{ xs: 2, md: 2 }}>
                    {!readOnly && (
                      <MDBox
                        sx={({ breakpoints }) => ({
                          display: "flex",
                          alignItems: "center",
                          marginBottom: 3,
                          flexWrap: "wrap",
                          gap: 2,
                          [breakpoints.down("sm")]: {
                            gap: 1.5,
                          },
                        })}
                      >
                        <MDBox
                          sx={({ breakpoints }) => ({
                            flex: "1 1 240px",
                            display: "flex",
                            justifyContent: "flex-start",
                            [breakpoints.down("md")]: {
                              flex: "0 0 auto",
                            },
                            [breakpoints.down("sm")]: {
                              order: 1,
                              flex: "0 0 auto",
                            },
                          })}
                        >
                          {isEditable && (
                            <MDButton
                              variant="gradient"
                              color="dark"
                              onClick={() => setIsAddTaskModalOpen(true)}
                            >
                              <AddIcon sx={{ fontWeight: "bold" }} />
                              {!isMobile && (
                                <MDBox component="span" ml={1} color="white">
                                  Add New Task
                                </MDBox>
                              )}
                            </MDButton>
                          )}
                        </MDBox>
                        <MDBox
                          sx={({ breakpoints }) => ({
                            flex: "1 1 320px",
                            display: "flex",
                            justifyContent: "flex-end",
                            ml: "auto",
                            [breakpoints.down("md")]: {
                              flex: "1 1 60%",
                              ml: "auto",
                            },
                            [breakpoints.down("sm")]: {
                              order: 2,
                              flex: "1 1 auto",
                              minWidth: 0,
                              justifyContent: "flex-end",
                              ml: "auto",
                            },
                          })}
                        >
                          <MDBox
                            sx={{
                              width: "100%",
                              minWidth: 0,
                              maxWidth: { xs: 480, md: 420 },
                              display: "flex",
                              justifyContent: "flex-end",
                              ml: "auto",
                            }}
                          >
                            <GroupToggle
                              participants={participantsForToggle}
                              selectedParticipants={selectedParticipants}
                              onParticipantsChange={setSelectedParticipants}
                              isMulti={isMulti}
                              compact={isSmall}
                            />
                          </MDBox>
                        </MDBox>
                      </MDBox>
                    )}
                    <MDBox
                      id="calendar-capture"
                      className={
                        currentView === "production" ? "production-calendar-active" : undefined
                      }
                    >
                      <Calendar
                        className="main-calendar"
                        localizer={localizer}
                        events={events}
                        startAccessor="start"
                        endAccessor="end"
                        onSelectEvent={handleEventClick}
                        views={views}
                        defaultView={defaultView}
                        showAllEvents
                        messages={{ print: "Print", production: "Production" }}
                        onView={setCurrentView}
                        selectable={isEditable}
                        components={{
                          toolbar: (toolbarProps) => (
                            <CalendarToolbar
                              {...toolbarProps}
                              canSelectStudentYear={canSelectStudentYear}
                              selectedYear={selectedYear}
                              onStudentYearChange={setSelectedYear}
                            />
                          ),
                          event: (props) => (
                            <CustomEvent
                              {...props}
                              isPrintView={currentView === "print" || currentView === "production"}
                            />
                          ),
                        }}
                        popup
                        eventPropGetter={eventPropGetter}
                      />
                    </MDBox>

                    {isEventModalOpen && selectedEvent && (
                      <EventModal
                        event={selectedEvent}
                        actors={actors}
                        students={students}
                        participantMap={participantMap}
                        scheduleStrand={strand}
                        canEdit={isEditable}
                        showParticipants={!readOnly}
                        onClose={() => setIsEventModalOpen(false)}
                      />
                    )}
                    {isEditable && isAddTaskModalOpen && (
                      <AddTaskModal
                        onClose={() => setIsAddTaskModalOpen(false)}
                        scheduleStrand={strand}
                      />
                    )}
                  </MDBox>
                </>
              )}
            </Card>
          </MDBox>
        </DashboardLayout>
      </LocalizationProvider>
    </PrintNotesProvider>
  );
}
