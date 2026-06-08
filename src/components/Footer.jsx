import { Link, useLocation } from 'react-router-dom'
import { useTheme } from '../context/theme'

export default function Footer() {
  const { isDark } = useTheme()
  const { pathname } = useLocation()

  const isLanding = pathname === '/'

  return (
    <footer style={{
      width: '100%',
      borderTop: '1px solid var(--border)',
      background: 'var(--bg)',
      padding: '20px 28px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: 12,
      marginTop: 'auto',
    }}>
      <span style={{ fontSize: 13, color: 'var(--text-tertiary)', fontWeight: 500 }}>
        © {new Date().getFullYear()} Influencer Studio
      </span>

      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        {[
          { to: '/faq', label: 'FAQ' },
          { to: '/privacy', label: 'Privacy Policy' },
          { to: '/terms', label: 'Terms of Service' },
        ].map(({ to, label }) => (
          <Link key={to} to={to} style={{
            fontSize: 13,
            color: 'var(--text-secondary)',
            textDecoration: 'none',
            fontWeight: 500,
            transition: 'color 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
          >
            {label}
          </Link>
        ))}
      </div>
    </footer>
  )
}
