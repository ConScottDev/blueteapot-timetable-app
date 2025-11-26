// components/schedule/MasterScheduleActors.jsx
import React from "react";
import ScheduleCore from "./ScheduleCore";
import { useAuth } from "auth/AuthProvider";

export default function MasterScheduleActors() {
  const { canWriteStrand } = useAuth();
  const canWrite = canWriteStrand("actors");

  return (
    <ScheduleCore
      strand="actor"
      participantsSource={{ actors: true, groups: true }}
      allowMultiSelect={{ month: true, print: false, production: false }}
      disableEditing={!canWrite}
    />
  );
}
