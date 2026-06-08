export default function PrivacyPolicy() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 'calc(var(--nav-h) + 48px) 24px 80px' }}>
      <h1 style={{ fontSize: 32, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>Privacy Policy</h1>
      <p style={{ fontSize: 14, color: 'var(--text-tertiary)', marginBottom: 40 }}>Last updated: June 8, 2026</p>

      <Section title="Overview">
        Influencer Studio ("we", "us", or "our") is committed to protecting your privacy. This policy explains what information we collect, how we use it, and your rights regarding your data.
      </Section>

      <Section title="Information We Collect">
        When you sign in with Google, we receive your email address and public profile information (name, profile photo) from Google. We use this only to create and identify your account.
        <br /><br />
        We store the influencer profiles you create, including names, descriptions, images, and generated content history, in a secure database linked to your account.
      </Section>

      <Section title="How We Use Your Information">
        We use your information solely to:
        <ul style={{ marginTop: 8, paddingLeft: 20, lineHeight: 2 }}>
          <li>Provide and maintain your account</li>
          <li>Sync your influencer profiles across devices</li>
          <li>Respond to support requests</li>
        </ul>
        We do not sell, rent, or share your personal information with third parties for marketing purposes.
      </Section>

      <Section title="Third-Party Services">
        Influencer Studio uses the following third-party services:
        <ul style={{ marginTop: 8, paddingLeft: 20, lineHeight: 2 }}>
          <li><strong>Supabase</strong> — secure cloud database and authentication</li>
          <li><strong>Google OAuth</strong> — sign-in only; we do not access your Google data beyond your email and profile</li>
          <li><strong>Higgsfield AI</strong> — AI image and video generation; governed by their own privacy policy</li>
          <li><strong>Vercel</strong> — app hosting</li>
        </ul>
      </Section>

      <Section title="Data Storage and Security">
        Your data is stored in a Supabase database with Row Level Security enabled, meaning only your account can access your influencer data. We use industry-standard encryption for data in transit and at rest.
      </Section>

      <Section title="Data Retention">
        We retain your data for as long as your account is active. You may request deletion of your account and all associated data at any time by contacting us.
      </Section>

      <Section title="Your Rights">
        You have the right to access, correct, or delete your personal data at any time. To make a request, contact us at the email below.
      </Section>

      <Section title="Contact">
        For privacy-related questions or data requests, email us at{' '}
        <a href="mailto:nataliashamoon1@gmail.com" style={{ color: 'var(--accent)' }}>nataliashamoon1@gmail.com</a>.
      </Section>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 36 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>{title}</h2>
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.8, margin: 0 }}>{children}</p>
    </div>
  )
}
