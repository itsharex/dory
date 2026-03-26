export default async function WelcomePage() {
    const { redirect } = await import('next/navigation');
    redirect('/sign-in');
}
