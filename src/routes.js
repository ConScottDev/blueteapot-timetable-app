// Material Dashboard 2 React layouts
import Tables from "layouts/tables";
import Billing from "layouts/billing";
import Notifications from "layouts/notifications";
import Profile from "layouts/profile";
import SignIn from "layouts/authentication/sign-in";

// @mui icons
import Icon from "@mui/material/Icon";
import {
  RequireAuth,
  RequireStrandPermission,
  RequireAnyStrandWrite,
  RequireUsersPermission,
} from "auth/guards";
import MasterScheduleActors from "components/schedule/MasterScheduleActors";
import MasterScheduleStudents from "components/schedule/MasterScheduleStudents";
import TimetableReadOnlyActors from "components/schedule/TimetableReadOnlyActors";
import TimetableReadOnlyStudents from "components/schedule/TimetableReadOnlyStudents";
import AutoRouteByRole from "auth/AutoRouteByRole";

import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import PeopleIcon from "@mui/icons-material/People";
import { RecentActors } from "@mui/icons-material";
import ChecklistIcon from "@mui/icons-material/Checklist";
import PersonIcon from "@mui/icons-material/Person";
import TaskList from "components/Tasks/TaskList";

import ResetRequest from "layouts/authentication/reset-password/cover"; // rename for clarity
import ResetPassword from "layouts/authentication/reset-password/confirm";
import UserList from "components/Users/UserList";
import HomeRedirect from "layouts/HomeRedirect";
import NotAuthorized from "layouts/NotAuthorized";

const routes = [
  {
    key: "home",
    route: "/",
    component: <AutoRouteByRole />,
  },
  {
    key: "reset-password",
    route: "/reset-password",
    component: <ResetPassword />,
  },
  {
    key: "forgot-password",
    route: "/forgot-password",
    component: <ResetRequest />,
  },
  {
    key: "sign-in",
    route: "/authentication/sign-in",
    component: <SignIn />,
  },
  {
    key: "not-authorized",
    route: "/not-authorized",
    component: (
      <RequireAuth>
        <NotAuthorized />
      </RequireAuth>
    ),
  },
  {
    key: "timetable-actors",
    route: "/timetable/actors",
    component: (
      <RequireAuth>
        <RequireStrandPermission strand="actors">
          <TimetableReadOnlyActors />
        </RequireStrandPermission>
      </RequireAuth>
    ),
  },
  {
    key: "timetable-students",
    route: "/timetable/students",
    component: (
      <RequireAuth>
        <RequireStrandPermission strand="students">
          <TimetableReadOnlyStudents />
        </RequireStrandPermission>
      </RequireAuth>
    ),
  },

  {
    type: "collapse",
    name: "Schedules",
    key: "schedules",
    icon: <CalendarTodayIcon fontSize="small" />,
    collapse: [
      {
        type: "collapse",
        name: "Actors",
        key: "schedule-actors",
        icon: <RecentActors fontSize="small"></RecentActors>,
        route: "/schedule/actors",
        component: (
          <RequireAuth>
            <RequireStrandPermission strand="actors">
              <MasterScheduleActors />
            </RequireStrandPermission>
          </RequireAuth>
        ),
      },
      {
        type: "collapse",
        name: "Students",
        key: "schedule-students",
        icon: <PeopleIcon fontSize="small"></PeopleIcon>,

        route: "/schedule/students",
        component: (
          <RequireAuth>
            <RequireStrandPermission strand="students">
              <MasterScheduleStudents />
            </RequireStrandPermission>
          </RequireAuth>
        ),
      },
    ],
  },
  {
    type: "collapse",
    name: "Users",
    key: "user-list",
    icon: <PersonIcon fontSize="small"></PersonIcon>,
    route: "/user-list",
    component: (
      <RequireAuth>
        <RequireUsersPermission strand="actors">
          <UserList />
        </RequireUsersPermission>
      </RequireAuth>
    ),
  },
  {
    type: "collapse",
    name: "Tasks",
    key: "tasks",
    icon: <ChecklistIcon></ChecklistIcon>,
    route: "/tasks",
    component: (
      <RequireAuth>
        <RequireAnyStrandWrite>
          <TaskList />
        </RequireAnyStrandWrite>
      </RequireAuth>
    ),
  },
  // {
  //   type: "collapse",
  //   name: "Tables",
  //   key: "tables",
  //   icon: <Icon fontSize="small">table_view</Icon>,
  //   route: "/tables",
  //   component: <Tables />,
  // },
  // {
  //   type: "collapse",
  //   name: "Billing",
  //   key: "billing",
  //   icon: <Icon fontSize="small">receipt_long</Icon>,
  //   route: "/billing",
  //   component: <Billing />,
  // },
  // {
  //   type: "collapse",
  //   name: "Notifications",
  //   key: "notifications",
  //   icon: <Icon fontSize="small">notifications</Icon>,
  //   route: "/notifications",
  //   component: <Notifications />,
  // },
  // {
  //   type: "collapse",
  //   name: "Profile",
  //   key: "profile",
  //   icon: <Icon fontSize="small">person</Icon>,
  //   route: "/profile",
  //   component: <Profile />,
  // },
  // {
  //   type: "collapse",
  //   name: "Sign In",
  //   key: "sign-in",
  //   icon: <Icon fontSize="small">login</Icon>,
  //   route: "/authentication/sign-in",
  //   component: <SignIn />,
  // },
];

export default routes;
