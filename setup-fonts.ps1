# MediaHub - Font Setup Script
# Šis scriptas sukurs visus reikalingus failus su custom fontais

Write-Host "🎨 MediaHub Font Setup pradedamas..." -ForegroundColor Cyan

# 1. Sukurti direktorijų struktūrą
Write-Host "`n📁 Kuriamos direktorijos..." -ForegroundColor Yellow

$directories = @(
    "public/fonts",
    "src/styles"
)

foreach ($dir in $directories) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Host "  ✓ Sukurta: $dir" -ForegroundColor Green
    } else {
        Write-Host "  → Jau egzistuoja: $dir" -ForegroundColor Gray
    }
}

# 2. Sukurti fonts.css failą su Google Fonts importu
Write-Host "`n📝 Kuriamas fonts.css..." -ForegroundColor Yellow

$fontsCss = @'
/* MediaHub - Custom Fonts */

/* Google Fonts Import */
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&display=swap');
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

/* Font Families */
:root {
  /* Heading Font - Sora (creative, modern) */
  --font-heading: 'Sora', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

  /* Body Font - Inter (readable, professional) */
  --font-body: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

  /* Font Weights */
  --weight-light: 300;
  --weight-regular: 400;
  --weight-medium: 500;
  --weight-semibold: 600;
  --weight-bold: 700;
  --weight-extrabold: 800;
}

/* Base Typography */
body {
  font-family: var(--font-body);
  font-weight: var(--weight-regular);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Headings */
h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-heading);
  font-weight: var(--weight-bold);
  line-height: 1.2;
}

/* Special Class: Italic Accent */
.italic-accent {
  font-style: italic;
  font-weight: var(--weight-semibold);
  background: linear-gradient(135deg, #F7931E 0%, #FF6B35 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* Hero Heading Styles */
.hero-heading {
  font-family: var(--font-heading);
  font-size: clamp(2rem, 5vw, 3.5rem);
  font-weight: var(--weight-extrabold);
  line-height: 1.1;
  letter-spacing: -0.02em;
}

/* Hero Subheading */
.hero-subheading {
  font-family: var(--font-body);
  font-size: clamp(1rem, 2vw, 1.25rem);
  font-weight: var(--weight-regular);
  line-height: 1.6;
}

/* Button Text */
.btn-text {
  font-family: var(--font-heading);
  font-weight: var(--weight-semibold);
  letter-spacing: 0.01em;
}
'@

Set-Content -Path "src/styles/fonts.css" -Value $fontsCss
Write-Host "  ✓ fonts.css sukurtas!" -ForegroundColor Green

# 3. Sukurti typography.css su pilna sistema
Write-Host "`n📝 Kuriamas typography.css..." -ForegroundColor Yellow

$typographyCss = @'
/* MediaHub - Typography System */

:root {
  /* Font Sizes - Fluid Typography */
  --text-xs: clamp(0.75rem, 0.7rem + 0.25vw, 0.875rem);
  --text-sm: clamp(0.875rem, 0.8rem + 0.35vw, 1rem);
  --text-base: clamp(1rem, 0.95rem + 0.25vw, 1.125rem);
  --text-lg: clamp(1.125rem, 1rem + 0.5vw, 1.25rem);
  --text-xl: clamp(1.25rem, 1.1rem + 0.75vw, 1.5rem);
  --text-2xl: clamp(1.5rem, 1.3rem + 1vw, 2rem);
  --text-3xl: clamp(2rem, 1.7rem + 1.5vw, 2.5rem);
  --text-4xl: clamp(2.5rem, 2rem + 2.5vw, 3.5rem);
  --text-5xl: clamp(3rem, 2.5rem + 3vw, 4.5rem);

  /* Line Heights */
  --leading-tight: 1.1;
  --leading-snug: 1.3;
  --leading-normal: 1.5;
  --leading-relaxed: 1.6;
  --leading-loose: 1.8;

  /* Letter Spacing */
  --tracking-tight: -0.02em;
  --tracking-normal: 0;
  --tracking-wide: 0.01em;
}

/* Heading Styles */
.h1 {
  font-size: var(--text-5xl);
  font-weight: var(--weight-extrabold);
  line-height: var(--leading-tight);
  letter-spacing: var(--tracking-tight);
}

.h2 {
  font-size: var(--text-4xl);
  font-weight: var(--weight-bold);
  line-height: var(--leading-tight);
}

.h3 {
  font-size: var(--text-3xl);
  font-weight: var(--weight-bold);
  line-height: var(--leading-snug);
}

.h4 {
  font-size: var(--text-2xl);
  font-weight: var(--weight-semibold);
  line-height: var(--leading-snug);
}

/* Body Text */
.body-lg {
  font-size: var(--text-lg);
  line-height: var(--leading-relaxed);
}

.body {
  font-size: var(--text-base);
  line-height: var(--leading-normal);
}

.body-sm {
  font-size: var(--text-sm);
  line-height: var(--leading-normal);
}

.caption {
  font-size: var(--text-xs);
  line-height: var(--leading-normal);
}

/* Utility Classes */
.font-heading {
  font-family: var(--font-heading);
}

.font-body {
  font-family: var(--font-body);
}

.italic {
  font-style: italic;
}

.not-italic {
  font-style: normal;
}

.font-light { font-weight: var(--weight-light); }
.font-regular { font-weight: var(--weight-regular); }
.font-medium { font-weight: var(--weight-medium); }
.font-semibold { font-weight: var(--weight-semibold); }
.font-bold { font-weight: var(--weight-bold); }
.font-extrabold { font-weight: var(--weight-extrabold); }
'@

Set-Content -Path "src/styles/typography.css" -Value $typographyCss
Write-Host "  ✓ typography.css sukurtas!" -ForegroundColor Green

# 4. Sukurti React komponentą su pavyzdžiu
Write-Host "`n📝 Kuriamas Hero komponentas..." -ForegroundColor Yellow

$heroComponent = @'
import React from 'react';
import '../styles/fonts.css';
import '../styles/typography.css';

const Hero = () => {
  return (
    <section className="hero-section">
      <div className="hero-container">
        <h1 className="hero-heading">
          Rask kūrėją, kuris pavers{' '}
          <span className="italic-accent">tavo idėjas</span>{' '}
          tikrove.
        </h1>

        <p className="hero-subheading">
          Fotografai, videografai ir dizaineriai Lietuvoje - vienoje vietoje
        </p>

        {/* CTA Buttons */}
        <div className="hero-cta">
          <button className="btn-primary">
            <span className="btn-text">Pradėti Paiešką →</span>
          </button>
          <button className="btn-secondary">
            <span className="btn-text">Kaip Tai Veikia?</span>
          </button>
        </div>

        {/* Trust Indicators */}
        <div className="trust-indicators">
          <div className="trust-item">
            <span className="trust-icon">✓</span>
            <span className="trust-text">500+ Kūrėjų</span>
          </div>
          <div className="trust-item">
            <span className="trust-icon">✓</span>
            <span className="trust-text">Skaidrios Kainos</span>
          </div>
          <div className="trust-item">
            <span className="trust-icon">✓</span>
            <span className="trust-text">Nemokami Pasiūlymai</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
'@

if (-not (Test-Path "src/components")) {
    New-Item -ItemType Directory -Path "src/components" -Force | Out-Null
}
Set-Content -Path "src/components/Hero.jsx" -Value $heroComponent
Write-Host "  ✓ Hero.jsx sukurtas!" -ForegroundColor Green

# 5. Sukurti Hero CSS
Write-Host "`n📝 Kuriamas hero.css..." -ForegroundColor Yellow

$heroCss = @'
/* MediaHub - Hero Section Styles */

.hero-section {
  position: relative;
  min-height: 90vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #F7931E 0%, #FF6B35 100%);
  overflow: hidden;
  padding: 2rem 1rem;
}

/* Optional: Animated background shapes */
.hero-section::before {
  content: '';
  position: absolute;
  top: -50%;
  right: -10%;
  width: 600px;
  height: 600px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  filter: blur(100px);
  animation: float 20s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50% { transform: translateY(-50px) rotate(180deg); }
}

.hero-container {
  max-width: 1200px;
  margin: 0 auto;
  text-align: center;
  color: white;
  position: relative;
  z-index: 1;
}

/* Hero Heading */
.hero-heading {
  margin-bottom: 1.5rem;
  text-shadow: 0 2px 20px rgba(0, 0, 0, 0.1);
}

/* Italic Accent (už "tavo idėjas") */
.italic-accent {
  position: relative;
  display: inline-block;
  font-style: italic;
  font-weight: 600;
  background: white;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  text-shadow: none;
}

/* Optional: Underline effect */
.italic-accent::after {
  content: '';
  position: absolute;
  bottom: -4px;
  left: 0;
  right: 0;
  height: 3px;
  background: white;
  opacity: 0.5;
  border-radius: 2px;
}

/* Hero Subheading */
.hero-subheading {
  margin-bottom: 3rem;
  color: rgba(255, 255, 255, 0.95);
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
}

/* CTA Buttons Container */
.hero-cta {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
  margin-bottom: 3rem;
}

/* Primary Button */
.btn-primary {
  padding: 1rem 2rem;
  background: white;
  color: #FF6B35;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
}

/* Secondary Button */
.btn-secondary {
  padding: 1rem 2rem;
  background: transparent;
  color: white;
  border: 2px solid white;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-secondary:hover {
  background: white;
  color: #FF6B35;
}

/* Trust Indicators */
.trust-indicators {
  display: flex;
  gap: 2rem;
  justify-content: center;
  flex-wrap: wrap;
  margin-top: 4rem;
}

.trust-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: white;
  font-size: var(--text-sm);
}

.trust-icon {
  font-size: 1.25rem;
}

/* Responsive */
@media (max-width: 768px) {
  .hero-section {
    min-height: 80vh;
    padding: 1rem;
  }

  .hero-cta {
    flex-direction: column;
    align-items: stretch;
  }

  .btn-primary,
  .btn-secondary {
    width: 100%;
  }

  .trust-indicators {
    flex-direction: column;
    gap: 1rem;
  }
}
'@

Set-Content -Path "src/styles/hero.css" -Value $heroCss
Write-Host "  ✓ hero.css sukurtas!" -ForegroundColor Green

# 6. Sukurti README su instrukcijomis
Write-Host "`n📝 Kuriamas README..." -ForegroundColor Yellow

$readme = @'
# MediaHub - Font Setup

## ✅ Kas buvo sukurta:

1. **fonts.css** - Google Fonts importas ir font kintamieji
2. **typography.css** - Pilna typography sistema
3. **hero.css** - Hero section stiliai
4. **Hero.jsx** - React komponentas

## 🎨 Fontai:

- **Headings**: Sora (bold, creative, modern)
- **Body**: Inter (clean, readable)
- **Special**: Italic accent su gradient

## 🚀 Kaip naudoti:

### 1. Importuok CSS į savo main failą:

```javascript
// src/index.js arba src/App.js
import './styles/fonts.css';
import './styles/typography.css';
```

### 2. Naudok Hero komponentą:

```javascript
import Hero from './components/Hero';

function App() {
  return (
    <div>
      <Hero />
      {/* Kitas content */}
    </div>
  );
}
```

### 3. Arba custom HTML:

```html
<h1 class="hero-heading">
  Rask kūrėją, kuris pavers
  <span class="italic-accent">tavo idėjas</span>
  tikrove.
</h1>
```

## 🎨 CSS Klasės:

### Typography:
- `.h1`, `.h2`, `.h3`, `.h4` - Heading stiliai
- `.body-lg`, `.body`, `.body-sm` - Body text
- `.italic-accent` - Italic su gradient
- `.font-heading`, `.font-body` - Font families

### Weights:
- `.font-light` (300)
- `.font-regular` (400)
- `.font-medium` (500)
- `.font-semibold` (600)
- `.font-bold` (700)
- `.font-extrabold` (800)

## 🔄 Keisti fontą:

Jei nori kito font'o (pvz. Outfit vietoj Sora):

1. Atidaryk **fonts.css**
2. Pakeisk Google Fonts URL:
   ```css
   @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap');
   ```
3. Pakeisk kintamąjį:
   ```css
   --font-heading: 'Outfit', sans-serif;
   ```

## 📦 Alternatyvūs Fontai:

### Variantas 1: Outfit (rounded, friendly)
```css
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap');
--font-heading: 'Outfit', sans-serif;
```

### Variantas 2: Poppins (geometric, popular)
```css
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');
--font-heading: 'Poppins', sans-serif;
```

### Variantas 3: Space Grotesk (tech, modern)
```css
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap');
--font-heading: 'Space Grotesk', sans-serif;
```

## 💡 Tips:

- Italic accent automatiškai turi gradient (orange → amber)
- Visi fontai yra responsive (fluid typography)
- Mobile-first design
- Performance optimized (Google Fonts CDN)

## 🎯 Pavyzdys su skirtingais stiliais:

```html
<!-- Bold heading -->
<h1 class="h1 font-extrabold">
  Labai didelis heading
</h1>

<!-- Heading su italic accent -->
<h2 class="h2">
  Normalus tekstas <span class="italic-accent">su akcentu</span>
</h2>

<!-- Body text -->
<p class="body">
  Standartinis body tekstas
</p>
```

Sėkmės! 🚀
'@

Set-Content -Path "README-FONTS.md" -Value $readme
Write-Host "  ✓ README-FONTS.md sukurtas!" -ForegroundColor Green

# 7. Baigiamoji žinutė
Write-Host "`n✅ SETUP BAIGTAS!" -ForegroundColor Green
Write-Host "`n📋 Sukurti failai:" -ForegroundColor Cyan
Write-Host "  → src/styles/fonts.css" -ForegroundColor White
Write-Host "  → src/styles/typography.css" -ForegroundColor White
Write-Host "  → src/styles/hero.css" -ForegroundColor White
Write-Host "  → src/components/Hero.jsx" -ForegroundColor White
Write-Host "  → README-FONTS.md" -ForegroundColor White

Write-Host "`n📖 Skaityk README-FONTS.md instrukcijai" -ForegroundColor Yellow
Write-Host "`n🎨 Fontai:" -ForegroundColor Cyan
Write-Host "  → Headings: Sora (bold, modern)" -ForegroundColor White
Write-Host "  → Body: Inter (clean, readable)" -ForegroundColor White
Write-Host "  → Italic accent: Automatinis gradient" -ForegroundColor White

Write-Host "`n🚀 Next steps:" -ForegroundColor Cyan
Write-Host "  1. Importuok fonts.css į savo App.js" -ForegroundColor White
Write-Host "  2. Naudok Hero komponentą arba custom HTML" -ForegroundColor White
Write-Host "  3. Customize colors/fonts pagal poreikius" -ForegroundColor White

Write-Host "`n💡 Jei nori pakeisti fontą, skaityk README sekcija 'Keisti fontą'" -ForegroundColor Yellow
Write-Host "`n✨ Happy coding! ✨`n" -ForegroundColor Magenta
