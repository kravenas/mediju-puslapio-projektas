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
