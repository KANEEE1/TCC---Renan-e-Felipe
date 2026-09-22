import { EditSchedule } from "@/components/schedule/edit-schedule";

export default async function EditSchedulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EditSchedule id={id} />;
}
