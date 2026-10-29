import { MeetingList } from "@/components/meetings/meeting-list";

export default async function MeetingEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MeetingList initialMode="edit" editId={id} />;
}
