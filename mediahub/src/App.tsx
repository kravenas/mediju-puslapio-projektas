import React, { useState, useEffect } from 'react';
import { Search, Camera, Video, Scissors, Palette, ArrowRight, Star, MapPin, Sun, Moon } from 'lucide-react';

function App() {
  const [selectedCategory, setSelectedCategory] = useState('Visi');
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('darkMode');
      if (saved !== null) return JSON.parse(saved);
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
  }, [darkMode]);

  const categories = [
    { icon: Camera, name: 'Fotografai' },
    { icon: Video, name: 'Videografai' },
    { icon: Scissors, name: 'Montažuotojai' },
    { icon: Palette, name: 'Dizaineriai' },
  ];

  const featuredCreators = [
    { name: 'Jonas Kazlauskas', profession: 'Fotografas', rating: 4.9, city: 'Vilnius', reviews: 127 },
    { name: 'Ieva Petraitė', profession: 'Videografė', rating: 5.0, city: 'Kaunas', reviews: 89 },
    { name: 'Tomas Lukošius', profession: 'Dizaineris', rating: 4.8, city: 'Klaipėda', reviews: 156 },
  ];

  const stats = [
    { number: '500+', label: 'Aktyvių Kūrėjų' },
    { number: '2000+', label: 'Užbaigtų Projektų' },
    { number: '4.8/5', label: 'Vidutinis Įvertinimas' },
    { number: '100%', label: 'Lietuvos Aprėptis' },
  ];

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0A0A0A] transition-colors">
      {/* Navigation */}
      <nav className="bg-white/80 dark:bg-[#0A0A0A]/80 backdrop-blur-xl border-b border-gray-200 dark:border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                MediaHub
              </h1>
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <button className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition">Kaip Veikia</button>
              <button className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition">Kūrėjams</button>
              <button className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition">Pagalba</button>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                aria-label="Toggle dark mode"
              >
                {darkMode ? (
                  <Sun className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                ) : (
                  <Moon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                )}
              </button>
              <button className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition font-medium">
                Prisijungti
              </button>
              <button className="bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-6 py-2 rounded-full hover:bg-gray-800 dark:hover:bg-gray-100 transition font-medium">
                Registruotis
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative bg-gradient-to-b from-gray-50 to-gray-100 dark:from-[#0A0A0A] dark:to-[#171717] overflow-hidden">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-32">
          <div className="text-center">
            <h2 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6 tracking-tight">
              Rask Tobulą Kūrėją<br />Savo Projektui
            </h2>
            <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-400 mb-12 max-w-3xl mx-auto">
              Fotografai, videografai, montažuotojai ir dizaineriai vienoje vietoje
            </p>

            {/* Search Bar */}
            <div className="max-w-4xl mx-auto bg-white dark:bg-[#171717] rounded-2xl shadow-lg dark:shadow-2xl dark:shadow-black/20 p-2 flex flex-col md:flex-row gap-2 border border-gray-200 dark:border-gray-800">
              <div className="flex-1 flex items-center px-4 py-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                <Search className="text-gray-400 mr-3" size={20} />
                <input
                  type="text"
                  placeholder="Ieškoti kūrėjo..."
                  className="flex-1 bg-transparent text-gray-800 dark:text-gray-200 outline-none placeholder-gray-400"
                />
              </div>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-6 py-3 bg-gray-50 dark:bg-gray-800/50 text-gray-800 dark:text-gray-200 rounded-xl outline-none cursor-pointer font-medium"
              >
                <option>Visi</option>
                <option>Fotografai</option>
                <option>Videografai</option>
                <option>Montažuotojai</option>
                <option>Dizaineriai</option>
              </select>
              <button className="bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-8 py-3 rounded-xl font-semibold hover:bg-gray-800 dark:hover:bg-gray-100 transition flex items-center justify-center">
                Ieškoti
                <ArrowRight className="ml-2" size={20} />
              </button>
            </div>

            {/* CTA Buttons */}
            <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
              <button className="bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-8 py-4 rounded-full font-semibold hover:bg-gray-800 dark:hover:bg-gray-100 transition">
                Rasti Kūrėją
              </button>
              <button className="border-2 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 px-8 py-4 rounded-full font-semibold hover:border-gray-400 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
                Prisijungti kaip Kūrėjas
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="py-24 bg-white dark:bg-[#0A0A0A]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h3 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4 tracking-tight">
              Pasirink Kategoriją
            </h3>
            <p className="text-xl text-gray-600 dark:text-gray-400">
              Rask profesionalą, kuris atitinka tavo poreikius
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {categories.map((category, index) => {
              const Icon = category.icon;
              return (
                <div
                  key={index}
                  className="group bg-white dark:bg-[#171717] border border-gray-200 dark:border-gray-800 rounded-2xl p-8 hover:shadow-xl dark:hover:shadow-2xl dark:hover:shadow-black/20 transition-all duration-300 cursor-pointer hover:-translate-y-1"
                >
                  <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-6 group-hover:bg-gray-200 dark:group-hover:bg-gray-700 transition">
                    <Icon className="text-gray-700 dark:text-gray-300" size={28} />
                  </div>
                  <h4 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                    {category.name}
                  </h4>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Profesionalūs {category.name.toLowerCase()} jūsų projektams
                  </p>
                  <button className="text-gray-900 dark:text-white font-semibold flex items-center group-hover:gap-2 transition-all">
                    Žiūrėti visus
                    <ArrowRight size={18} className="ml-1" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 bg-gray-50 dark:bg-[#171717]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h3 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4 tracking-tight">
              Kaip Tai Veikia?
            </h3>
            <p className="text-xl text-gray-600 dark:text-gray-400">
              Tik 3 paprasti žingsniai iki sėkmės
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: '01', title: 'Aprašyk projektą', desc: 'Papasakok ką nori pasiekti ir kokių specialistų reikia' },
              { step: '02', title: 'Gauk pasiūlymus', desc: 'Kūrėjai siūlys savo paslaugas ir kainas tau' },
              { step: '03', title: 'Pasirink ir bendrauk', desc: 'Rinkis geriausią ir dirk tiesiogiai su profesionalu' },
            ].map((item, index) => (
              <div key={index} className="relative">
                <div className="bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-gray-800 rounded-2xl p-8 hover:shadow-lg dark:hover:shadow-2xl dark:hover:shadow-black/20 transition">
                  <div className="text-6xl font-bold text-gray-200 dark:text-gray-800 mb-4">
                    {item.step}
                  </div>
                  <h4 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                    {item.title}
                  </h4>
                  <p className="text-gray-600 dark:text-gray-400">
                    {item.desc}
                  </p>
                </div>
                {index < 2 && (
                  <div className="hidden md:block absolute top-1/2 -right-4 transform -translate-y-1/2">
                    <ArrowRight className="text-gray-300 dark:text-gray-700" size={32} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Creators */}
      <section className="py-24 bg-white dark:bg-[#0A0A0A]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h3 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4 tracking-tight">
              Populiariausi Kūrėjai
            </h3>
            <p className="text-xl text-gray-600 dark:text-gray-400">
              Geriausi profesionalai laukia tavo projekto
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {featuredCreators.map((creator, index) => (
              <div key={index} className="bg-white dark:bg-[#171717] border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden hover:shadow-xl dark:hover:shadow-2xl dark:hover:shadow-black/20 transition-all duration-300 cursor-pointer hover:-translate-y-1">
                <div className="h-64 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900"></div>
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="text-xl font-bold text-gray-900 dark:text-white">{creator.name}</h4>
                      <p className="text-gray-600 dark:text-gray-400 font-medium">{creator.profession}</p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center text-yellow-500 mb-1">
                        <Star size={16} fill="currentColor" />
                        <span className="ml-1 font-bold text-gray-900 dark:text-white">{creator.rating}</span>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-500">({creator.reviews})</p>
                    </div>
                  </div>
                  <div className="flex items-center text-gray-600 dark:text-gray-400 mb-4">
                    <MapPin size={16} />
                    <span className="ml-1">{creator.city}</span>
                  </div>
                  <button className="w-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 py-3 rounded-xl font-semibold hover:bg-gray-800 dark:hover:bg-gray-100 transition">
                    Žiūrėti Profilį
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-24 bg-gray-900 dark:bg-[#171717]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-4xl md:text-5xl font-bold text-white mb-2">
                  {stat.number}
                </div>
                <div className="text-lg text-gray-400">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-white dark:bg-[#0A0A0A]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-gray-900 dark:bg-white rounded-2xl p-12 text-center">
              <h3 className="text-3xl font-bold text-white dark:text-gray-900 mb-4">Esi kūrėjas?</h3>
              <p className="text-lg text-gray-400 dark:text-gray-600 mb-6">
                Prisijunk prie mūsų ir gauk užsakymus be tarpininkų
              </p>
              <button className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white px-8 py-4 rounded-full font-semibold hover:bg-gray-100 dark:hover:bg-gray-800 transition">
                Pradėti Dabar
              </button>
            </div>
            <div className="bg-gray-100 dark:bg-[#171717] border border-gray-200 dark:border-gray-800 rounded-2xl p-12 text-center">
              <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Reikia paslaugų?</h3>
              <p className="text-lg text-gray-600 dark:text-gray-400 mb-6">
                Rask idealų profesionalą savo projektui per kelias minutes
              </p>
              <button className="bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-8 py-4 rounded-full font-semibold hover:bg-gray-800 dark:hover:bg-gray-100 transition">
                Rasti Kūrėją
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 dark:bg-[#0A0A0A] text-gray-400 py-12 border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h4 className="text-white font-bold text-lg mb-4">MediaHub</h4>
              <p className="text-sm">
                Viena platforma - visos medijų paslaugos. Jungiame kūrėjus ir klientus.
              </p>
            </div>
            <div>
              <h5 className="text-white font-semibold mb-4">Kūrėjams</h5>
              <ul className="space-y-2 text-sm">
                <li><button className="hover:text-white transition">Kaip pradėti</button></li>
                <li><button className="hover:text-white transition">Kainos</button></li>
                <li><button className="hover:text-white transition">DUK</button></li>
              </ul>
            </div>
            <div>
              <h5 className="text-white font-semibold mb-4">Klientams</h5>
              <ul className="space-y-2 text-sm">
                <li><button className="hover:text-white transition">Kaip veikia</button></li>
                <li><button className="hover:text-white transition">Kategorijos</button></li>
                <li><button className="hover:text-white transition">Pagalba</button></li>
              </ul>
            </div>
            <div>
              <h5 className="text-white font-semibold mb-4">Kontaktai</h5>
              <ul className="space-y-2 text-sm">
                <li>info@mediahub.lt</li>
                <li>+370 600 12345</li>
                <li>Vilnius, Lietuva</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center text-sm">
            <p>&copy; 2026 MediaHub. Visos teisės saugomos.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
