import { StudentForm } from "@/components/students/student-form";

export default async function EditStudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <StudentForm isEdit studentId={id} />;
}
