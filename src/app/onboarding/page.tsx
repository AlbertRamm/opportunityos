import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { ProfileForm } from "@/components/ProfileForm";
import { TrackEvent } from "@/components/Track";
import { getInterests, getProfileRow, requireUser } from "@/lib/data";
import { profileFormProps } from "@/lib/profile-form";

export const metadata: Metadata = { title: "Your profile" };

export default async function Onboarding() {
  await requireUser();
  const profile = await getProfileRow();
  if (profile?.onboarding_completed_at) redirect("/dashboard");
  const interests = await getInterests();
  return (
    <>
      <header className="mx-auto w-full max-w-2xl px-5 py-5"><Logo /></header>
      <main id="main" className="mx-auto w-full max-w-2xl flex-1 px-5 pb-20 pt-6">
        <TrackEvent name="onboarding_started" />
        <h1 className="text-3xl font-semibold tracking-tight">What would you like to explore?</h1>
        <p className="mb-10 mt-2 text-muted">Your interests help us suggest experiences. Your grade and location help us check where you can apply.</p>
        <ProfileForm interests={interests} initial={{}} submitLabel="Show my opportunities" {...profileFormProps()} />
      </main>
    </>
  );
}
