export default function LogoHeader({ size = 105 }) {
  const logos = [
    {
      src: '/lagos-logo.png',
      alt: 'Lagos State Government Logo'
    },
    {
      src: '/second-logo.png', // Add your second logo file to public/second-logo.png
      alt: 'Second Organization Logo'
    }
  ]
  
  return (
    <div className="brand">
      {logos.map((logo, index) => (
        <img
          key={index}
          src={logo.src}
          alt={logo.alt}
          width={size}
          height={size}
          style={{ 
            objectFit: 'contain', 
            filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))',
            maxWidth: '100%'
          }}
          onError={(e) => { 
            console.warn(`Logo ${logo.src} failed to load`)
            e.currentTarget.style.display = 'none' 
          }}
        />
      ))}
    </div>
  )
}


