import { FormEvent, useState } from "react";
import { FormInput, FormNotice, SectionTitle } from "../components/site";
import { useFormSubmission } from "../hooks/useFormSubmission";
import { collegeIsValid, formError, normalizedEmail, text } from "../lib/form";
import { submitMember, submitVolunteer, type MemberSubmission, type SubmissionResult, type VolunteerSubmission } from "../services/api";

export function MembershipPage() {
  const member = useFormSubmission<MemberSubmission>(submitMember);
  const volunteer = useFormSubmission<VolunteerSubmission>(submitVolunteer);
  const [memberValidation, setMemberValidation] = useState<string | null>(null);
  const [volunteerValidation, setVolunteerValidation] = useState<string | null>(null);

  async function handleMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const values = { full_name: text(form, "full_name"), email: normalizedEmail(text(form, "email")), phone: text(form, "phone"), membership_type: text(form, "membership_type"), city: text(form, "city"), college: text(form, "college") };
    const validation = formError(values, { required: ["full_name", "email", "phone", "membership_type", "city"], email: "email", phone: "phone" });
    const collegeError = values.membership_type === "student" && (!values.college || !collegeIsValid(values.college)) ? "Please enter a valid college or institution name." : null;
    setMemberValidation(validation || collegeError);
    if (validation || collegeError) return;
    const submitted = await member.send({ ...values, membership_type: values.membership_type as MemberSubmission["membership_type"], message: text(form, "message") || undefined });
    if (submitted) formElement.reset();
  }

  async function handleVolunteer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const values = { full_name: text(form, "full_name"), email: normalizedEmail(text(form, "email")), phone: text(form, "phone"), city: text(form, "city"), college: text(form, "college") };
    const validation = formError(values, { required: ["full_name", "email", "phone", "city", "college"], email: "email", phone: "phone" });
    const collegeError = values.college && !collegeIsValid(values.college) ? "Please enter a valid college or institution name." : null;
    setVolunteerValidation(validation || collegeError);
    if (validation || collegeError) return;
    const submitted = await volunteer.send({ ...values, skills: text(form, "skills") || undefined, availability: text(form, "availability") || undefined, message: text(form, "message") || undefined });
    if (submitted) formElement.reset();
  }

  return <>
    <PageIntro />
    <section className="shell grid gap-12 py-20 lg:grid-cols-[.85fr_1.15fr]">
      <div><SectionTitle eyebrow="Membership" title="Find a meaningful way to participate." description="Membership types are listed without fees until official registration information is available." /><div className="mt-8 grid gap-3">{["Student member", "General member", "Supporting member"].map((item) => <div key={item} className="border-l-2 border-[var(--crimson)] bg-white p-4 font-semibold">{item}</div>)}</div></div>
      <form onSubmit={handleMember} className="rounded-2xl border border-[var(--border)] bg-white p-6 sm:p-8"><p className="eyebrow">Membership interest</p><div className="mt-6 grid gap-5 sm:grid-cols-2"><FormInput label="Full name" name="full_name" /><FormInput label="Email" name="email" type="email" /><FormInput label="Phone" name="phone" type="tel" /><FormInput label="City" name="city" /><label className="grid gap-2 text-sm font-semibold">Membership type<select className="field" name="membership_type" defaultValue=""><option value="" disabled>Select a type</option><option value="student">Student</option><option value="general">General</option><option value="supporting">Supporting</option></select></label><FormInput label="College / institution (for students)" name="college" required={false} /><label className="grid gap-2 text-sm font-semibold sm:col-span-2">Message (optional)<textarea className="field min-h-28" name="message" placeholder="What brings you to this initiative?" /></label></div><button className="button button-primary mt-6 disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={member.submitting}>{member.submitting ? "Sending..." : "Register interest"}</button>{memberValidation && <FormNotice tone="error">{memberValidation}</FormNotice>}{member.error && <FormNotice tone="error">{member.error}</FormNotice>}{member.success && <FormNotice>{(member.result as SubmissionResult)?.emailVerification?.status === "sent" ? "Your application has been received. Please check your email to verify your email address." : "Your application has been received. Email verification is not configured yet."}</FormNotice>}</form>
    </section>
    <section className="border-y border-[var(--border)] bg-[var(--light)]"><div className="shell grid gap-12 py-20 lg:grid-cols-[.85fr_1.15fr]"><div><SectionTitle eyebrow="Volunteering" title="Bring your time and skills." description="Share your interest in volunteering. This is an application of interest, not an acceptance confirmation." /></div><form onSubmit={handleVolunteer} className="rounded-2xl border border-[var(--border)] bg-white p-6 sm:p-8"><p className="eyebrow">Volunteer application</p><div className="mt-6 grid gap-5 sm:grid-cols-2"><FormInput label="Full name" name="full_name" /><FormInput label="Email" name="email" type="email" /><FormInput label="Phone" name="phone" type="tel" /><FormInput label="City" name="city" /><FormInput label="College / institution" name="college" /><FormInput label="Skills (optional)" name="skills" required={false} /><FormInput label="Availability (optional)" name="availability" required={false} /><label className="grid gap-2 text-sm font-semibold sm:col-span-2">Message (optional)<textarea className="field min-h-28" name="message" /></label></div><button className="button button-primary mt-6 disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={volunteer.submitting}>{volunteer.submitting ? "Sending..." : "Apply to volunteer"}</button>{volunteerValidation && <FormNotice tone="error">{volunteerValidation}</FormNotice>}{volunteer.error && <FormNotice tone="error">{volunteer.error}</FormNotice>}{volunteer.success && <FormNotice>{(volunteer.result as SubmissionResult)?.emailVerification?.status === "sent" ? "Your application has been received. Please check your email to verify your email address." : "Your application has been received. Email verification is not configured yet."}</FormNotice>}</form></div></section>
  </>;
}

function PageIntro() { return <section className="border-b border-[var(--border)] bg-white"><div className="shell py-16 md:py-24"><p className="eyebrow">Membership and volunteering</p><h1 className="mt-4 max-w-3xl text-5xl font-semibold leading-[1.02] tracking-[-.05em]">Bring your time, skills and curiosity.</h1><p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--grey)]">Share your interest with the initiative. Applications are received for review and are not automatic acceptance.</p></div></section>; }
