import { MeetingEdit } from "@/components/meetings/meeting-edit";

export default async function MeetingEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MeetingEdit meetingId={id} />;
}
