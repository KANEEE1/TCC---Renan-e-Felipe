import { Suspense } from "react";
import { TeacherScheduleView } from "@/components/teachers/teacher-schedule-view";

export default function TeacherSchedulePage() {
  return (
    <Suspense>
      <TeacherScheduleView />
    </Suspense>
  );
}
