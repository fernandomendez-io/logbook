export default function VerifyEmailPage() {
  return (
    <div className="bg-surface border border-border rounded-xl p-8 text-center shadow-2xl">
      <div className="w-16 h-16 bg-green-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg className="w-8 h-8 text-green-primary" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
        </svg>
      </div>
      <h1 className="text-lg font-semibold text-foreground mb-2">Check your email</h1>
      <p className="text-sm text-foreground/50 mb-4">
        We sent a verification link to your email address. Click the link to activate your account.
      </p>
      <p className="text-xs text-foreground/30">
        Didn&apos;t receive it? Check your spam folder or contact your administrator.
      </p>
    </div>
  )
}
