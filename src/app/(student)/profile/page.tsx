import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { ProfileForm } from "@/components/ProfileForm";
import { DeleteAccount } from "@/components/DeleteAccount";
import { getInterests, requireStudent } from "@/lib/data";
import { profileFormProps, profileToFormValues } from "@/lib/profile-form";

export const metadata: Metadata = { title: "Your profile" };

export default async function ProfilePage() {
  const { user, profile } = await requireStudent();
  const interests = await getInterests();
  return (
    <>
      <Header active="profile" />
      <main id="main" className="mx-auto w-full max-w-2xl flex-1 px-5 pb-20 pt-10">
        <h1 className="text-3xl font-semibold tracking-tight">Your profile</h1>
        <p className="mb-10 mt-2 text-muted">{user.email}. Update anything and your matches refresh immediately.</p>
        <ProfileForm interests={interests} initial={profileToFormValues(profile)} submitLabel="Save changes" {...profileFormProps()} />
        <DeleteAccount />
      </main>
    </>
  );
}
