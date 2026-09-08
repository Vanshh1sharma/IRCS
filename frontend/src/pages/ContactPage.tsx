import { Droplets, Siren } from "lucide-react";
import { FormEvent, useState } from "react";
import { FormInput, FormNotice, SectionTitle } from "../components/site";
import { useFormSubmission } from "../hooks/useFormSubmission";
import { formError, phoneIsValid, text } from "../lib/form";
import { submitBloodRequest, submitContact, submitEmergency, type BloodRequestSubmission, type ContactSubmission, type EmergencySubmission } from "../services/api";

export function ContactPage() {
  const contact = useFormSubmission<ContactSubmission>(submitContact);
  const emergency = useFormSubmission<EmergencySubmission>(submitEmergency);
  const blood = useFormSubmission<BloodRequestSubmission>(submitBloodRequest);
  const [contactValidation, setContactValidation] = useState<string | null>(null);
  const [emergencyValidation, setEmergencyValidation] = useState<string | null>(null);
  const [bloodValidation, setBloodValidation] = useState<string | null>(null);

  async function handleContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const values = { name: text(form, "name"), email: text(form, "email"), phone: text(form, "phone"), subject: text(form, "subject"), message: text(form, "message") };
    const validation = formError(values, { required: ["name", "email", "subject", "message"], email: "email" });
    const nextValidation = validation || (values.phone && !phoneIsValid(values.phone) ? "Please enter a valid phone number." : null);
    setContactValidation(nextValidation);
    if (nextValidation) return;
    const submitted = await contact.send({ ...values, phone: text(form, "phone") || undefined });
    if (submitted) formElement.reset();
  }

  async function handleEmergency(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const values = { name: text(form, "name"), phone: text(form, "phone"), location: text(form, "location"), emergency_type: text(form, "emergency_type"), description: text(form, "description"), urgency: text(form, "urgency") };
    const validation = formError(values, { required: ["name", "phone", "location", "emergency_type", "description", "urgency"], phone: "phone" });
    setEmergencyValidation(validation);
    if (validation) return;
    const submitted = await emergency.send({ ...values, emergency_type: values.emergency_type as EmergencySubmission["emergency_type"], urgency: values.urgency as EmergencySubmission["urgency"] });
    if (submitted) formElement.reset();
  }

  async function handleBlood(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const values = { blood_group: text(form, "blood_group"), city: text(form, "city"), hospital: text(form, "hospital"), units_required: text(form, "units_required"), contact_name: text(form, "contact_name"), contact_phone: text(form, "contact_phone"), urgency: text(form, "urgency") };
    const validation = formError(values, { required: ["blood_group", "city", "hospital", "units_required", "contact_name", "contact_phone", "urgency"], phone: "contact_phone" });
    const units = Number(values.units_required);
    setBloodValidation(validation || (!Number.isInteger(units) || units <= 0 ? "Units required must be a positive whole number." : null));
    if (validation || !Number.isInteger(units) || units <= 0) return;
    const submitted = await blood.send({ ...values, blood_group: values.blood_group as BloodRequestSubmission["blood_group"], units_required: units, urgency: values.urgency as BloodRequestSubmission["urgency"], hospital_location: text(form, "hospital_location") || undefined });
    if (submitted) formElement.reset();
  }

  return <><section className="border-b border-[var(--border)] bg-white"><div className="shell py-16 md:py-24"><p className="eyebrow">Reach the initiative</p><h1 className="mt-4 max-w-3xl text-5xl font-semibold leading-[1.02] tracking-[-.05em]">Questions, blood search and emergency information.</h1><p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--grey)]">Official contact channels are placeholders until supplied. For immediate life-threatening emergencies, contact the appropriate emergency services directly.</p></div></section><section className="shell grid gap-12 py-20 lg:grid-cols-[.8fr_1.2fr]"><div className="grid content-start gap-4"><Info icon={<Siren />} title="Official helpline" text="Placeholder - official number to be supplied" /><Info icon={<Droplets />} title="Find blood" text="Search is not available yet. Blood request submission is separate below." /><Info title="NIET campus / office" text="Placeholder - official location details to be supplied" /><Info title="Social media" text="Placeholder - official links to be supplied" /></div><form onSubmit={handleContact} className="rounded-2xl border border-[var(--border)] bg-white p-6 sm:p-8"><SectionTitle eyebrow="Contact form" title="Send a message." /><div className="mt-7 grid gap-5 sm:grid-cols-2"><FormInput label="Name" name="name" /><FormInput label="Email" name="email" type="email" /><FormInput label="Phone (optional)" name="phone" type="tel" required={false} /><FormInput label="Subject" name="subject" /><label className="grid gap-2 text-sm font-semibold sm:col-span-2">Message<textarea className="field min-h-36" name="message" required /></label></div><button className="button button-primary mt-6 disabled:opacity-60" type="submit" disabled={contact.submitting}>{contact.submitting ? "Sending..." : "Send message"}</button>{contactValidation && <FormNotice tone="error">{contactValidation}</FormNotice>}{contact.error && <FormNotice tone="error">{contact.error}</FormNotice>}{contact.success && <FormNotice>Your message has been sent successfully.</FormNotice>}</form></section><section id="blood" className="border-y border-[var(--border)] bg-[var(--light)]"><div className="shell grid gap-12 py-16 lg:grid-cols-2"><div><SectionTitle eyebrow="Find blood" title="Search by blood group and city." description="Blood availability search is not implemented in this phase. Donor personal information will never be displayed publicly." /><div className="mt-8 grid gap-4 sm:grid-cols-[1fr_1fr_auto]"><select className="field" defaultValue=""><option value="" disabled>Blood group</option>{["A+","A-","B+","B-","AB+","AB-","O+","O-"].map((group) => <option key={group}>{group}</option>)}</select><input className="field" placeholder="City" /><button type="button" className="button button-primary" disabled>Search unavailable</button></div></div><form onSubmit={handleBlood} className="rounded-2xl border border-[var(--border)] bg-white p-6 sm:p-8"><SectionTitle eyebrow="Request blood" title="Submit a blood request." /><div className="mt-7 grid gap-5 sm:grid-cols-2"><label className="grid gap-2 text-sm font-semibold">Blood group<select className="field" name="blood_group" defaultValue="" required><option value="" disabled>Select group</option>{["A+","A-","B+","B-","AB+","AB-","O+","O-","unknown"].map((group) => <option key={group}>{group}</option>)}</select></label><FormInput label="City" name="city" /><FormInput label="Hospital" name="hospital" /><FormInput label="Hospital location (optional)" name="hospital_location" required={false} /><FormInput label="Units required" name="units_required" type="number" /><FormInput label="Contact name" name="contact_name" /><FormInput label="Contact phone" name="contact_phone" type="tel" /><label className="grid gap-2 text-sm font-semibold">Urgency<select className="field" name="urgency" defaultValue="" required><option value="" disabled>Select urgency</option>{["low","medium","high","critical"].map((level) => <option key={level}>{level}</option>)}</select></label></div><button className="button button-primary mt-6 disabled:opacity-60" type="submit" disabled={blood.submitting}>{blood.submitting ? "Sending..." : "Submit blood request"}</button>{bloodValidation && <FormNotice tone="error">{bloodValidation}</FormNotice>}{blood.error && <FormNotice tone="error">{blood.error}</FormNotice>}{blood.success && <FormNotice>Your blood request has been received.</FormNotice>}</form></div></section><section id="emergency" className="shell py-20"><SectionTitle eyebrow="Report emergency" title="Share information responsibly." description="This form is not a real-time response service. For immediate life-threatening emergencies, contact the appropriate emergency services directly." /><form onSubmit={handleEmergency} className="mt-8 max-w-3xl rounded-2xl border border-[var(--border)] bg-white p-6"><div className="grid gap-5 sm:grid-cols-2"><FormInput label="Name" name="name" /><FormInput label="Phone" name="phone" type="tel" /><FormInput label="Location" name="location" /><label className="grid gap-2 text-sm font-semibold">Emergency type<select className="field" name="emergency_type" defaultValue="" required><option value="" disabled>Select type</option><option value="medical">Medical</option><option value="blood_requirement">Blood requirement</option><option value="disaster">Disaster</option><option value="accident">Accident</option><option value="other">Other</option></select></label><label className="grid gap-2 text-sm font-semibold">Urgency<select className="field" name="urgency" defaultValue="" required><option value="" disabled>Select urgency</option>{["low","medium","high","critical"].map((level) => <option key={level}>{level}</option>)}</select></label><label className="grid gap-2 text-sm font-semibold sm:col-span-2">Description<textarea className="field min-h-28" name="description" required /></label></div><button type="submit" className="button button-primary mt-6 disabled:opacity-60" disabled={emergency.submitting}>{emergency.submitting ? "Sending..." : "Submit report"}</button>{emergencyValidation && <FormNotice tone="error">{emergencyValidation}</FormNotice>}{emergency.error && <FormNotice tone="error">{emergency.error}</FormNotice>}{emergency.success && <FormNotice>Your emergency report has been received. Please use the listed emergency contacts for urgent assistance.</FormNotice>}</form></section></>;
}

function Info({ icon, title, text: copy }: { icon?: React.ReactNode; title: string; text: string }) { return <div className="border-t-2 border-[var(--dark)] pt-4"><div className="flex items-center gap-2 text-[var(--crimson)]">{icon}<span className="eyebrow">{title}</span></div><p className="mt-2 text-sm leading-6 text-[var(--grey)]">{copy}</p></div>; }