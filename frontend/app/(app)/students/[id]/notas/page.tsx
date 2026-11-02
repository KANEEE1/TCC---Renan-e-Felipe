import { StudentGrades } from "@/components/students/student-grades";

export default async function StudentGradesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <StudentGrades studentId={id} />;
}
