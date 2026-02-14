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
