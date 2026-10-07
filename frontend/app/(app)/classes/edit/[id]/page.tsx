import { ClassForm } from "@/components/classes/class-form";

export default async function EditClassPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ClassForm isEdit classId={id} />;
}
