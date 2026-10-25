import { MeetingForm } from "@/components/meetings/meeting-form";

export default async function MeetingEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MeetingForm meetingId={id} />;
}
