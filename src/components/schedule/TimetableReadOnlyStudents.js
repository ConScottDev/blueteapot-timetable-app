import ScheduleCore from "./ScheduleCore";
export default function TimetableReadOnlyStudents() {
  return (
    <ScheduleCore
      strand="student"
      participantsSource={{ students: true, groups: true }}
      allowMultiSelect={{ month: true, print: false }}
      readOnly
    />
  );
}
