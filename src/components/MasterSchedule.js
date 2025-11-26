import React, { useEffect, useState, useMemo } from "react";
import { collection, onSnapshot, getDocs } from "firebase/firestore";
import { db } from "utils/firebase";
import AddTaskModal from "./AddTaskModal";
import GroupToggle from "./GroupToggle";
import { Calendar, momentLocalizer, Views } from "react-big-calendar";
import moment from "moment";
import "react-big-calendar/lib/css/react-big-calendar.css";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import MDBox from "./MDBox";
import { Card, Icon } from "@mui/material";
import MDButton from "./MDButton";
import "../assets/MasterSchedule.css";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFnsV3";
import EventModal from "./schedule/EventModal";
import CustomPrintView from "./CustomPrintView";
import CustomEvent from "./CustomEvent"; // Import the custom event component
import ProductionCalendar from "./ProductionCalendar";
import AddIcon from "@mui/icons-material/Add";
import { useActor } from "context/ActorProvider"; // Import useActor hook
import { PrintNotesProvider } from "context/PrintNotesContext";

const localizer = momentLocalizer(moment);

const MasterSchedule = () => {
  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [actors, setActors] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedParticipants, setSelectedParticipants] = useState([]);
  const [currentView, setCurrentView] = useState(Views.MONTH);
  const { selectedActor, setSelectedActor } = useActor(); // Destructure selectedActor and setSelectedActor from context

  useEffect(() => {
    const isModalOpen = isAddTaskModalOpen || isEventModalOpen;

    if (isModalOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isAddTaskModalOpen, isEventModalOpen]);

  useEffect(() => {
    const fetchActors = async () => {
      const actorsCollection = collection(db, "actors");
      const actorsSnapshot = await getDocs(actorsCollection);
      const actorsList = actorsSnapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data().name,
        type: "actor",
      }));
      setActors(actorsList);
    };

    const fetchGroups = async () => {
      const groupsCollection = collection(db, "groups");
      const groupsSnapshot = await getDocs(groupsCollection);
      const groupsList = groupsSnapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data().name,
        type: "group",
      }));
      setGroups(groupsList);
    };

    fetchActors();
    fetchGroups();
  }, []);

  useEffect(() => {
    const tasksCollection = collection(db, "tasks");
    const unsubscribe = onSnapshot(tasksCollection, (snapshot) => {
      const tasksData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setTasks(tasksData);
    });

    return () => unsubscribe();
  }, []);

  const participantMap = useMemo(() => {
    const allParticipants = [...actors, ...groups];
    return allParticipants.reduce((map, participant) => {
      map[participant.id] = participant;
      return map;
    }, {});
  }, [actors, groups]);

  // useEffect(() => {
  //   // Check if the current view is "print" or "production"
  //   if (currentView === "print" || currentView === "production") {
  //     // If there are already selected participants from the "month" view
  //     if (selectedParticipants.length > 0) {
  //       // Set the first participant from the selected ones
  //       const firstSelected = selectedParticipants[0];
  //       setSelectedParticipants([firstSelected]); // Ensure only one actor is selected
  //       setSelectedActor(
  //         actors.find((actor) => actor.id === firstSelected)?.name ||
  //           groups.find((group) => group.id === firstSelected)?.name
  //       );
  //     } else if ([...actors, ...groups].length > 0) {
  //       // If no participants are selected, fallback to the first actor or group from the database
  //       const firstParticipant = actors[0] || groups[0];
  //       setSelectedParticipants([firstParticipant.id]); // Select by ID
  //       setSelectedActor(firstParticipant.name);
  //     }
  //   }
  // }, [currentView, actors, groups, selectedParticipants, setSelectedParticipants]);
  useEffect(() => {
    if (currentView === "print" || currentView === "production") {
      // Set the first selected actor for print/production view
      if (selectedParticipants.length > 0) {
        const firstActor = selectedParticipants[0];
        setSelectedActor(firstActor); // Set the first actor in the custom view
      }
    }
  }, [currentView, selectedParticipants, setSelectedActor]);

  const filteredTasks = tasks.filter((task) => {
    // If in "production" view, filter by both production status and selected participants
    if (currentView === "production") {
      return (
        task.production === true &&
        (selectedParticipants.length === 0 ||
          task.participants.some((participant) => selectedParticipants.includes(participant)))
      );
    }

    // For other views, just filter by selected participants
    return (
      selectedParticipants.length === 0 ||
      task.participants.some((participant) => selectedParticipants.includes(participant))
    );
  });

  const events = filteredTasks.map((task) => ({
    id: task.id,
    title: task.title,
    start: new Date(`${task.date}T${task.startTime}`),
    end: new Date(`${task.date}T${task.endTime}`),
    startTime: task.startTime,
    endTime: task.endTime,
    resource: task,
    tutor: task.tutor,
    location: task.location,
    color: task.color, // Add the color property
    participants: (task.participants || []).map((id) => participantMap[id] || { name: "Unknown" }),
  }));

  const handleEventClick = (event) => {
    setSelectedEvent(event);
    setIsEventModalOpen(true);
  };

  // Function to apply the background color to events
  const eventPropGetter = (event) => {
    const backgroundColor = event.color || "#3174ad"; // Default color if no color is specified
    return {
      style: {
        backgroundColor,
      },
    };
  };
  const PrintViewWrapper = () => <CustomPrintView selectedParticipants={selectedParticipants} />;
  const views = useMemo(
    () => ({
      month: true,
      print: CustomPrintView,
      production: ProductionCalendar,
    }),
    []
  );

  return (
    <PrintNotesProvider>
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <DashboardLayout>
        <DashboardNavbar />
        <MDBox>
          <Card>
            <MDBox pt={1} pb={2} px={2}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "24px",
                }}
              >
                <MDButton
                  variant="gradient"
                  color="dark"
                  onClick={() => setIsAddTaskModalOpen(true)}
                >
                  <AddIcon sx={{ fontWeight: "bold" }}>add</AddIcon>
                  &nbsp;Add New Task
                </MDButton>
                <div>
                  <GroupToggle
                    participants={[...actors, ...groups]}
                    selectedParticipants={selectedParticipants}
                    onParticipantsChange={setSelectedParticipants}
                    isMulti={currentView !== "print" && currentView !== "production"}
                  />
                </div>
              </div>

              <Calendar
                localizer={localizer}
                events={events}
                startAccessor="start"
                endAccessor="end"
                onSelectEvent={handleEventClick}
                views={views}
                defaultView={Views.MONTH}
                showAllEvents
                messages={{ print: "Print", production: "Production" }}
                onView={setCurrentView}
                components={{
                  event: (props) => (
                    <CustomEvent
                      {...props}
                      isPrintView={currentView === "print" || currentView === "production"}
                    />
                  ),
                }}
                popup
                eventPropGetter={eventPropGetter} // Add this line to apply the color
              />

              {isEventModalOpen && selectedEvent && (
                <EventModal
                  event={selectedEvent}
                  actors={actors}
                  onClose={() => setIsEventModalOpen(false)}
                />
              )}
              {isAddTaskModalOpen && <AddTaskModal onClose={() => setIsAddTaskModalOpen(false)} />}
            </MDBox>
          </Card>
        </MDBox>
      </DashboardLayout>
      </LocalizationProvider>
    </PrintNotesProvider>
  );
};

export default MasterSchedule;
