import { SimuladoDetail } from "@/components/simulados/simulado-detail";

export default async function SimuladoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SimuladoDetail simuladoId={id} />;
}
