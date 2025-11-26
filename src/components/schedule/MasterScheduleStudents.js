// components/schedule/MasterScheduleStudents.jsx
import React from "react";
import ScheduleCore from "./ScheduleCore";
import { useAuth } from "auth/AuthProvider";

export default function MasterScheduleStudents() {
  const { canWriteStrand } = useAuth();
  const canWrite = canWriteStrand("students");

  return (
    <ScheduleCore
      strand="student"
      participantsSource={{ students: true, groups: true }}
      allowMultiSelect={{ month: true, print: false }}
      disableEditing={!canWrite}
    />
  );
}
