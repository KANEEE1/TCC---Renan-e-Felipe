export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-10">
      <section className="space-y-5 rounded-3xl border border-white/10 bg-[var(--panel)] p-8 shadow-glow backdrop-blur">
        <p className="text-sm uppercase tracking-[0.3em] text-emerald-300">Base mínima</p>
        <h1 className="font-[family:var(--font-heading)] text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          Projeto funcional com Next.js, Express, PostgreSQL e Prisma.
        </h1>
        <p className="max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
          Essa é só a fundação do sistema. Frontend e backend estão separados e prontos para evoluir depois, sem login, CRUD ou telas extras agora.
        </p>
        <a className="inline-flex rounded-full border border-white/12 bg-white/5 px-5 py-3 font-medium text-white transition hover:bg-white/10" href="http://localhost:3333/health">
          Testar backend
        </a>
      </section>
    </main>
  );
}
