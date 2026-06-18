import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { prefersReducedMotion } from '../lib/motion';

export function initAnimations(): void {
  if (prefersReducedMotion()) return; // static render; hero video stays paused → poster shows
  gsap.registerPlugin(ScrollTrigger);

  // Motion allowed: opt the hero video into playback (markup omits `autoplay` so that
  // reduced-motion users never see it move — they keep the poster image).
  const heroVideo = document.querySelector<HTMLVideoElement>('.hero-video');
  if (heroVideo) { heroVideo.autoplay = true; heroVideo.play().catch(() => {}); }

  const hero = document.querySelector('[data-hero]');
  if (hero) {
    const tl = gsap.timeline();
    tl.from(hero.querySelectorAll('.band'), { xPercent: (i) => (i === 0 ? -120 : 120), duration: .5, ease: 'power3.out' })
      .from(hero.querySelector('.plate'), { scale: 0, rotation: -20, duration: .35, ease: 'back.out(2)' }, '-=.15')
      .from(hero.querySelector('.wordmark'), { scale: 1.6, opacity: 0, duration: .35, ease: 'back.out(1.7)' }, '-=.2')
      .from(hero.querySelectorAll('.trace,.techline,.ctas'), { y: 20, opacity: 0, stagger: .08, duration: .3 }, '-=.1')
      .from(hero.querySelector('.video'), { opacity: 0, duration: .6 }, '-=.4');
  }

  gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((el) => {
    gsap.from(el, { y: 40, opacity: 0, duration: .5, ease: 'power2.out',
      scrollTrigger: { trigger: el, start: 'top 80%' } });
  });
}
document.addEventListener('DOMContentLoaded', initAnimations);
