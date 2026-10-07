import { MarkAttendance } from "@/components/attendance/mark-attendance";

export default async function MarkAttendancePage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params;
  return <MarkAttendance aulaId={classId} />;
}
