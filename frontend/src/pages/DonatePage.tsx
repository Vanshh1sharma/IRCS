import { FormEvent, useState } from "react";
import { FormInput, FormNotice, SectionTitle } from "../components/site";
import { useFormSubmission } from "../hooks/useFormSubmission";
import { emailIsValid, formError, phoneIsValid, text } from "../lib/form";
import { createDonation, type DonationSubmission } from "../services/api";

const amounts = ["500", "1,000", "5,000"];

export function DonatePage() {
  const [amount, setAmount] = useState("");
  const donation = useFormSubmission<DonationSubmission>(createDonation);
  const [validation, setValidation] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const values = { donor_name: text(form, "donor_name"), email: text(form, "email"), phone: text(form, "phone"), amount, frequency: text(form, "frequency"), purpose: text(form, "purpose") };
    const basicError = formError(values, { required: ["donor_name", "email", "amount", "frequency", "purpose"], email: "email" });
    const numericAmount = Number(values.amount.replace(/,/g, ""));
    const nextError = basicError || (!Number.isFinite(numericAmount) || numericAmount <= 0 ? "Please enter a positive donation amount." : values.phone && !phoneIsValid(values.phone) ? "Please enter a valid phone number." : null);
    setValidation(nextError);
    if (nextError) return;
    const submitted = await donation.send({ donor_name: values.donor_name, email: values.email, phone: values.phone || undefined, amount: numericAmount, frequency: values.frequency as DonationSubmission["frequency"], purpose: values.purpose as DonationSubmission["purpose"] });
    if (submitted) { formElement.reset(); setAmount(""); }
  }

  return <><section className="border-b border-[var(--border)] bg-white"><div className="shell py-16 md:py-24"><p className="eyebrow">Support the work</p><h1 className="mt-4 max-w-3xl text-5xl font-semibold leading-[1.02] tracking-[-.05em]">Give thoughtfully. See clearly where things stand.</h1><p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--grey)]">This form records donation intent only. Payment integration will be available shortly; no payment credentials are collected here.</p></div></section><section className="shell grid gap-12 py-20 lg:grid-cols-[.8fr_1.2fr]"><div><SectionTitle eyebrow="Donation preferences" title="Choose a starting point." /><div className="mt-8 grid grid-cols-3 gap-3">{amounts.map((item) => <button type="button" key={item} onClick={() => setAmount(item)} className={`rounded-xl border p-4 font-bold ${amount === item ? "border-[var(--crimson)] bg-red-50 text-[var(--crimson)]" : "border-[var(--border)] bg-white"}`}>₹{item}</button>)}</div><label className="mt-4 grid gap-2 text-sm font-semibold">Custom amount<input className="field" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Enter amount" /></label><div className="mt-7 border-l-2 border-[var(--crimson)] bg-[var(--light)] p-4 text-sm leading-6 text-[var(--grey)]">No card number, CVV, UPI PIN, bank password, or payment credentials are requested.</div></div><form onSubmit={handleSubmit} className="rounded-2xl border border-[var(--border)] bg-white p-6 sm:p-8"><p className="eyebrow">Donor details</p><div className="mt-6 grid gap-5"><FormInput label="Name" name="donor_name" /><FormInput label="Email" name="email" type="email" /><FormInput label="Phone (optional)" name="phone" type="tel" required={false} /><label className="grid gap-2 text-sm font-semibold">Frequency<select className="field" defaultValue="" name="frequency" required><option value="" disabled>Select frequency</option><option value="one_time">One time</option><option value="monthly">Monthly</option></select></label><label className="grid gap-2 text-sm font-semibold">Purpose<select className="field" defaultValue="" name="purpose" required><option value="" disabled>Select purpose</option><option value="general_support">General support</option><option value="blood_donation">Blood donation</option><option value="disaster_relief">Disaster relief</option><option value="health_camps">Health camps</option></select></label></div><button type="submit" className="button button-primary mt-6 disabled:opacity-60" disabled={donation.submitting}>{donation.submitting ? "Recording..." : "Record donation intent"}</button>{validation && <FormNotice tone="error">{validation}</FormNotice>}{donation.error && <FormNotice tone="error">{donation.error}</FormNotice>}{donation.success && <FormNotice>Your donation intent has been recorded. Payment integration will be available shortly.</FormNotice>}</form></section></>;
}
