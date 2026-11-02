import { ClassGrades } from "@/components/classes/class-grades";

export default async function ClassGradesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ClassGrades classId={id} />;
}
