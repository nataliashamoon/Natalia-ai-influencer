export default function TermsOfService() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 'calc(var(--nav-h) + 48px) 24px 80px' }}>
      <h1 style={{ fontSize: 32, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>Terms of Service</h1>
      <p style={{ fontSize: 14, color: 'var(--text-tertiary)', marginBottom: 40 }}>Last updated: June 8, 2026</p>

      <Section title="Acceptance of Terms">
        By accessing or using Influencer Studio, you agree to be bound by these Terms of Service. If you do not agree, please do not use the app.
      </Section>

      <Section title="Use of the Service">
        Influencer Studio is a platform for creating and managing AI-generated influencer personas. You may use the service for personal or commercial creative projects, subject to the restrictions below.
      </Section>

      <Section title="Prohibited Use">
        You agree not to use Influencer Studio to:
        <ul style={{ marginTop: 8, paddingLeft: 20, lineHeight: 2 }}>
          <li>Create content that is illegal, harmful, abusive, or defamatory</li>
          <li>Impersonate real individuals without their consent</li>
          <li>Generate or distribute explicit, obscene, or sexually exploitative content</li>
          <li>Violate the intellectual property rights of others</li>
          <li>Attempt to reverse-engineer, hack, or disrupt the service</li>
          <li>Violate the terms of any third-party service (Higgsfield, Google, etc.)</li>
        </ul>
      </Section>

      <Section title="AI-Generated Content">
        Content generated through Influencer Studio is produced by third-party AI models (Higgsfield). We do not guarantee the accuracy, quality, or legality of AI-generated content. You are solely responsible for how you use and distribute generated content. Commercial use rights are governed by Higgsfield's terms of service.
      </Section>

      <Section title="Your Account">
        You are responsible for maintaining the security of your account and all activity that occurs under it. Notify us immediately of any unauthorized use.
      </Section>

      <Section title="Intellectual Property">
        Influencer Studio and its original content, features, and design are owned by us. AI-generated content rights are subject to the terms of the underlying model providers.
      </Section>

      <Section title="Disclaimer of Warranties">
        Influencer Studio is provided "as is" without warranties of any kind, express or implied. We do not guarantee uninterrupted or error-free service.
      </Section>

      <Section title="Limitation of Liability">
        To the fullest extent permitted by law, we shall not be liable for any indirect, incidental, or consequential damages arising out of your use of the service.
      </Section>

      <Section title="Changes to Terms">
        We may update these terms at any time. Continued use of the app after changes constitutes acceptance of the new terms.
      </Section>

      <Section title="Contact">
        For questions about these terms, email{' '}
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
