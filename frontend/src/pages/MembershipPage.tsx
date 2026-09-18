import { FormEvent, useState } from "react";
import { FormInput, FormNotice, SectionTitle } from "../components/site";
import { useFormSubmission } from "../hooks/useFormSubmission";
import { collegeIsValid, formError, normalizedEmail, text } from "../lib/form";
import { submitMember, submitVolunteer, type MemberSubmission, type SubmissionResult, type VolunteerSubmission } from "../services/api";

const volunteerAreaOptions = [
  ["blood_donation", "Blood Donation & Health Activities"],
  ["community_outreach", "Community Outreach"],
  ["awareness_campaigns", "Awareness & Campaigns"],
  ["event_support", "Event & Program Support"],
  ["coordination_logistics", "Coordination & Logistics"],
  ["digital_technical", "Digital & Technical Support"],
  ["media_documentation", "Media & Documentation"],
] as const;

const memberContributionOptions = [
  ["blood_donation", "Blood Donation & Health Activities"],
  ["community_outreach", "Community Outreach"],
  ["awareness_campaigns", "Awareness & Campaigns"],
  ["event_support", "Event & Program Support"],
  ["digital_technical", "Digital & Technical Support"],
  ["media_documentation", "Media & Documentation"],
  ["general_support", "General Support"],
] as const;

export function MembershipPage() {
  const member = useFormSubmission<MemberSubmission>(submitMember);
  const volunteer = useFormSubmission<VolunteerSubmission>(submitVolunteer);
  const [memberValidation, setMemberValidation] = useState<string | null>(null);
  const [volunteerValidation, setVolunteerValidation] = useState<string | null>(null);

  async function handleMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const values = { full_name: text(form, "full_name"), email: normalizedEmail(text(form, "email")), phone: text(form, "phone"), membership_type: text(form, "membership_type"), contribution_area: text(form, "contribution_area"), city: text(form, "city"), college: text(form, "college") };
    const validation = formError(values, { required: ["full_name", "email", "phone", "membership_type", "city"], email: "email", phone: "phone" });
    const contributionAreaError = values.contribution_area ? null : "Please select how you would like to contribute.";
    const collegeError = values.membership_type === "student" && (!values.college || !collegeIsValid(values.college)) ? "Please enter a valid college or institution name." : null;
    setMemberValidation(validation || contributionAreaError || collegeError);
    if (validation || contributionAreaError || collegeError) return;
    const submitted = await member.send({ ...values, membership_type: values.membership_type as MemberSubmission["membership_type"], contribution_area: values.contribution_area as MemberSubmission["contribution_area"], college: values.college || undefined, message: text(form, "message") || undefined });
    if (submitted) formElement.reset();
  }

  async function handleVolunteer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const values = { full_name: text(form, "full_name"), email: normalizedEmail(text(form, "email")), phone: text(form, "phone"), volunteer_area: text(form, "volunteer_area"), city: text(form, "city"), college: text(form, "college") };
    const validation = formError(values, { required: ["full_name", "email", "phone", "city", "college"], email: "email", phone: "phone" });
    const volunteerAreaError = values.volunteer_area ? null : "Please select an area of interest.";
    const collegeError = values.college && !collegeIsValid(values.college) ? "Please enter a valid college or institution name." : null;
    setVolunteerValidation(validation || volunteerAreaError || collegeError);
    if (validation || volunteerAreaError || collegeError) return;
    const submitted = await volunteer.send({ ...values, volunteer_area: values.volunteer_area as VolunteerSubmission["volunteer_area"], skills: text(form, "skills") || undefined, availability: text(form, "availability") || undefined, message: text(form, "message") || undefined });
    if (submitted) formElement.reset();
  }

  return <>
    <PageIntro />
    <section className="shell grid gap-12 py-20 lg:grid-cols-[.85fr_1.15fr]">
      <div><SectionTitle eyebrow="Membership" title="Find a meaningful way to participate." description="Membership types are listed without fees until official registration information is available." /><div className="mt-8 grid gap-3">{["Student member", "General member", "Supporting member"].map((item) => <div key={item} className="border-l-2 border-[var(--crimson)] bg-white p-4 font-semibold">{item}</div>)}</div></div>
      <form onSubmit={handleMember} className="rounded-2xl border border-[var(--border)] bg-white p-6 sm:p-8"><p className="eyebrow">Membership interest</p><div className="mt-6 grid gap-5 sm:grid-cols-2"><FormInput label="Full name" name="full_name" /><FormInput label="Email" name="email" type="email" /><FormInput label="Phone" name="phone" type="tel" /><FormInput label="City" name="city" /><label className="grid gap-2 text-sm font-semibold">Membership type<select className="field" name="membership_type" defaultValue=""><option value="" disabled>Select a type</option><option value="student">Student</option><option value="general">General</option><option value="supporting">Supporting</option></select></label><FormInput label="College / institution (for students)" name="college" required={false} /><div className="grid gap-2 sm:col-span-2"><AreaSelect id="contribution_area" label="How would you like to contribute?" options={memberContributionOptions} /><p className="text-sm leading-6 text-[var(--grey)]">Members are expected to participate responsibly in approved IRCS-NIET activities, follow organization and college guidelines, support humanitarian and community-service initiatives, and contribute their time or skills where appropriate.</p></div><label className="grid gap-2 text-sm font-semibold sm:col-span-2">Message (optional)<textarea className="field min-h-28" name="message" placeholder="What brings you to this initiative?" /></label></div><button className="button button-primary mt-6 disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={member.submitting}>{member.submitting ? "Sending..." : "Register interest"}</button>{memberValidation && <FormNotice tone="error">{memberValidation}</FormNotice>}{member.error && <FormNotice tone="error">{member.error}</FormNotice>}{member.success && <FormNotice>{(member.result as SubmissionResult)?.emailVerification?.status === "sent" ? "Your application has been received. Please check your email to verify your email address." : "Your application has been received. Email verification is not configured yet."}</FormNotice>}</form>
    </section>
    <section className="border-y border-[var(--border)] bg-[var(--light)]"><div className="shell grid gap-12 py-20 lg:grid-cols-[.85fr_1.15fr]"><div><SectionTitle eyebrow="Volunteering" title="Bring your time and skills." description="Share your interest in volunteering. This is an application of interest, not an acceptance confirmation." /></div><form onSubmit={handleVolunteer} className="rounded-2xl border border-[var(--border)] bg-white p-6 sm:p-8"><p className="eyebrow">Volunteer application</p><div className="mt-6 grid gap-5 sm:grid-cols-2"><FormInput label="Full name" name="full_name" /><FormInput label="Email" name="email" type="email" /><FormInput label="Phone" name="phone" type="tel" /><FormInput label="City" name="city" /><FormInput label="College / institution" name="college" /><div className="grid gap-2 sm:col-span-2"><AreaSelect id="volunteer_area" label="Area of interest" options={volunteerAreaOptions} /><p className="text-sm leading-6 text-[var(--grey)]">Volunteers may assist with IRCS-NIET activities, awareness campaigns, community outreach, events, donation drives and other approved humanitarian initiatives. Responsibilities may vary depending on the activity and the volunteer's skills and availability.</p></div><FormInput label="Skills (optional)" name="skills" required={false} /><FormInput label="Availability (optional)" name="availability" required={false} /><label className="grid gap-2 text-sm font-semibold sm:col-span-2">Message (optional)<textarea className="field min-h-28" name="message" /></label></div><button className="button button-primary mt-6 disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={volunteer.submitting}>{volunteer.submitting ? "Sending..." : "Apply to volunteer"}</button>{volunteerValidation && <FormNotice tone="error">{volunteerValidation}</FormNotice>}{volunteer.error && <FormNotice tone="error">{volunteer.error}</FormNotice>}{volunteer.success && <FormNotice>{(volunteer.result as SubmissionResult)?.emailVerification?.status === "sent" ? "Your application has been received. Please check your email to verify your email address." : "Your application has been received. Email verification is not configured yet."}</FormNotice>}</form></div></section>
  </>;
}

function PageIntro() { return <section className="border-b border-[var(--border)] bg-white"><div className="shell py-16 md:py-24"><p className="eyebrow">Membership and volunteering</p><h1 className="mt-4 max-w-3xl text-5xl font-semibold leading-[1.02] tracking-[-.05em]">Bring your time, skills and curiosity.</h1><p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--grey)]">Share your interest with the initiative. Applications are received for review and are not automatic acceptance.</p></div></section>; }

function AreaSelect({ id, label, options }: { id: string; label: string; options: readonly (readonly [string, string])[] }) {
  return <label className="grid gap-2 text-sm font-semibold sm:col-span-2">{label}<select className="field" id={id} name={id} defaultValue=""><option value="" disabled>Select an area</option>{options.map(([value, optionLabel]) => <option key={value} value={value}>{optionLabel}</option>)}</select></label>;
}
