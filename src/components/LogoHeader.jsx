export default function LogoHeader({ size = 105 }) {
  const src = '/lagos-logo.png' // Place your logo at public/lagos-logo.png
  return (
    <div className="brand" style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.75rem' }}>
      <img
        src={src}
        alt="Lagos State Government Logo"
        width={size}
        height={size}
        style={{ objectFit: 'contain', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))' }}
        onError={(e) => { e.currentTarget.style.display = 'none' }}
      />
    </div>
  )
}


