# Dual Logo Setup Guide

## How to Add Your Second Logo

The application now supports displaying two logos side by side on both the form and dashboard.

### Steps to Add Your Second Logo:

1. **Prepare Your Logo File:**
   - Format: PNG, JPG, or SVG
   - Recommended size: 105x105 pixels (square aspect ratio)
   - Name: `second-logo.png` (or update the filename in the code)

2. **Add the Logo File:**
   - Place your logo file in the `public/` directory
   - Replace the placeholder file `public/second-logo-placeholder.txt` with your actual logo
   - Name it `second-logo.png` (or update the src in `src/components/LogoHeader.jsx`)

3. **Customize (Optional):**
   - To change the logo filename, edit `src/components/LogoHeader.jsx`
   - Update the `src` property in the logos array
   - Update the `alt` text for accessibility

### Current Logo Configuration:

```javascript
const logos = [
  {
    src: '/lagos-logo.png',
    alt: 'Lagos State Government Logo'
  },
  {
    src: '/second-logo.png', // Your second logo
    alt: 'Second Organization Logo'
  }
]
```

### Features:

- **Responsive Design**: Logos automatically adjust size on mobile devices
- **Error Handling**: If a logo fails to load, it's hidden gracefully
- **Hover Effects**: Subtle scale animation on hover
- **Consistent Styling**: Both logos use the same styling and effects
- **Flexible Layout**: Logos wrap to new line on very small screens

### File Structure:
```
public/
├── lagos-logo.png          # Existing Lagos State logo
├── second-logo.png         # Your second logo (add this)
└── second-logo-placeholder.txt  # Instructions (can be deleted)
```

The logos will appear on:
- ✅ Main form pages
- ✅ Dashboard
- ✅ All form sections
- ✅ Mobile and desktop views
