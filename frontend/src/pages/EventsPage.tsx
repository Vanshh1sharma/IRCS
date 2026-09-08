import { EventCard, EmptyState, ErrorState, LoadingState, SectionTitle } from "../components/site";
import { usePublicResource } from "../hooks/usePublicResource";
import { getEvents } from "../services/api";

export function EventsPage() {
  const { data: events, loading, error, retry } = usePublicResource(getEvents);

  return <><section className="border-b border-[var(--border)] bg-white"><div className="shell py-16 md:py-24"><p className="eyebrow">Gatherings and action</p><h1 className="mt-4 max-w-3xl text-5xl font-semibold leading-[1.02] tracking-[-.05em]">Upcoming events, when they are confirmed.</h1><p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--grey)]">Find published events and activities from the initiative.</p></div></section><section className="shell py-20"><SectionTitle eyebrow="Upcoming events" title="Make room on the calendar." />{loading && <LoadingState />}{!loading && error && <div className="mt-10"><ErrorState onRetry={retry} /></div>}{!loading && !error && events?.length === 0 && <div className="mt-10"><EmptyState message="No upcoming events at the moment." /></div>}{!loading && !error && events && events.length > 0 && <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{events.map((event) => <EventCard key={event.id} event={event} />)}</div>}</section></>;
}
