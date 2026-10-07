import { AttendanceReport } from "@/components/attendance/attendance-report";

export default async function AttendanceReportPage({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;
  return <AttendanceReport studentId={studentId} />;
}
