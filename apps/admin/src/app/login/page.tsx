import type { Metadata } from 'next';
import { BrandLogo } from '@/components/brand-logo';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { brand } from '@/config/brand';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Sign in' };

const REASONS: Record<string, string> = {
  expired: 'Your session has ended. Sign in again to continue.',
  forbidden: 'That account does not have admin access.',
};

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const { from, reason } = await searchParams;
  const notice = typeof reason === 'string' ? REASONS[reason] : undefined;

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 p-6">
      <div className="grid w-full max-w-sm gap-6">
        <BrandLogo size={40} className="justify-center text-lg" />
        <Card>
          <CardHeader>
            <CardTitle>Sign in to the admin panel</CardTitle>
            <CardDescription>{notice ?? 'Use an account with the admin role.'}</CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm from={typeof from === 'string' ? from : undefined} />
          </CardContent>
        </Card>
        {brand.supportEmail ? (
          <p className="text-center text-xs text-muted-foreground">
            Need access? Contact <a className="underline underline-offset-4" href={`mailto:${brand.supportEmail}`}>{brand.supportEmail}</a>
          </p>
        ) : null}
      </div>
    </main>
  );
}
