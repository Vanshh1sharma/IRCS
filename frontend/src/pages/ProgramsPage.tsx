import { ArrowLeft, ArrowRight } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { EmptyState, ErrorState, LoadingState, ProgramCard, SectionTitle } from "../components/site";
import { usePublicResource } from "../hooks/usePublicResource";
import { getProgram, getPrograms } from "../services/api";

export function ProgramsPage() {
  const { data: programs, loading, error, retry } = usePublicResource(getPrograms);

  return <>
    <PageIntro />
    <section className="shell py-20">
      {loading && <LoadingState />}
      {!loading && error && <ErrorState onRetry={retry} />}
      {!loading && !error && programs?.length === 0 && <EmptyState message="No published programmes are available at the moment." />}
      {!loading && !error && programs && programs.length > 0 && <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{programs.map((program) => <ProgramCard key={program.id} program={program} />)}</div>}
    </section>
  </>;
}

export function ProgramDetailPage() {
  const { slug } = useParams();
  const { data: program, loading, error, retry } = usePublicResource(() => getProgram(slug ?? ""), slug);

  if (loading) return <section className="shell py-24"><LoadingState /></section>;
  if (error || !program) return <section className="shell py-24"><ErrorState onRetry={retry} /><Link to="/programs" className="button button-secondary mt-8"><ArrowLeft size={16} /> Back to programmes</Link></section>;

  const image = program.image_url ?? program.image;
  return <>
    <section className="border-b border-[var(--border)] bg-white"><div className="shell grid gap-10 py-14 md:grid-cols-2 md:items-center"><div><Link to="/programs" className="inline-flex items-center gap-2 text-sm font-bold text-[var(--crimson)]"><ArrowLeft size={15} /> All programmes</Link><p className="eyebrow mt-10">{program.category}</p><h1 className="mt-4 text-5xl font-semibold leading-[1.02] tracking-[-.05em]">{program.title}</h1><p className="mt-6 text-lg leading-8 text-[var(--grey)]">{program.description}</p></div>{image && <img src={image} alt="" className="aspect-[4/3] w-full rounded-[2rem] object-cover" />}</div></section>
    <section className="shell grid gap-12 py-20 md:grid-cols-[1.1fr_.9fr]"><div><SectionTitle eyebrow="About this programme" title="Practical care, grounded in community needs." />{program.impact && <p className="mt-6 leading-8 text-[var(--grey)]">{program.impact}</p>}<p className="mt-6 text-sm font-semibold text-[var(--grey)]">Category: {program.category}</p></div><div className="bg-[var(--light)] p-7"><p className="eyebrow">Programme information</p><h2 className="mt-3 text-2xl font-semibold">Have a question?</h2><p className="mt-3 leading-7 text-[var(--grey)]">Contact the initiative for more information about this published programme.</p><Link to="/contact" className="button button-primary mt-7">Ask a question <ArrowRight size={16} /></Link></div></section>
  </>;
}

function PageIntro() {
  return <section className="border-b border-[var(--border)] bg-white"><div className="shell py-16 md:py-24"><p className="eyebrow">What we do</p><h1 className="mt-4 max-w-3xl text-5xl font-semibold leading-[1.02] tracking-[-.05em]">Programmes for health, preparedness and community care.</h1><p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--grey)]">Explore the initiative's currently published programme areas.</p></div></section>;
}
