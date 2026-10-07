import { TeacherAvailability } from "@/components/teachers/teacher-availability";

export default async function TeacherAvailabilityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TeacherAvailability teacherId={id} />;
}
