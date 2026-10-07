import { TeacherForm } from "@/components/teachers/teacher-form";

export default async function EditTeacherPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TeacherForm isEdit teacherId={id} />;
}
