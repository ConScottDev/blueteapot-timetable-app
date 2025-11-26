// components/schedule/TimetableReadOnlyActors.jsx
import ScheduleCore from "./ScheduleCore";
export default function TimetableReadOnlyActors() {
  return (
    <ScheduleCore
      strand="actor"
      participantsSource={{ actors: true, groups: true }}
      allowMultiSelect={{ month: true, print: false, production: false }}
      readOnly
    />
  );
}
