import { AssignStudents } from "@/components/classes/assign-students";

export default async function AssignStudentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AssignStudents classId={id} />;
}
