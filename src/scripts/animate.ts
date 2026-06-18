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

  // Sonic 2 title-card SLIDE-IN choreography (engine TitleCardElement order/directions),
  // staggered then held — no exit. Each `.from` animates FROM an off-screen offset TO the
  // element's CSS resting position, so reduced-motion (early return above) shows the final
  // composition immediately. Directions mirror the disassembly:
  //   blue ← top · yellow/zone/bar/ctas ← right · red/ZONE/act ← left.
  const hero = document.querySelector('[data-hero]');
  if (hero) {
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.from('[data-tc="blue"]',      { yPercent: -100, duration: .45 })
      .from('[data-tc="red"]',       { xPercent: -210, duration: .5 }, 0.06)
      .from('[data-tc="yellow"]',    { xPercent: 130, duration: .5 }, 0.06)
      .from('[data-tc="bar"]',       { x: () => window.innerWidth * 0.6, opacity: 0, duration: .45 }, 0.16)
      .from('[data-tc="ctas"]',      { x: () => window.innerWidth * 0.6, opacity: 0, duration: .45 }, 0.18)
      .from('[data-tc="zone"]',      { x: () => window.innerWidth, opacity: 0, duration: .5, ease: 'power4.out' }, 0.24)
      .from('[data-tc="zonelabel"]', { x: -window.innerWidth * 0.6, opacity: 0, duration: .45 }, 0.32)
      .from('[data-tc="act"]',       { x: -window.innerWidth * 0.5, opacity: 0, duration: .45 }, 0.32);
  }

  gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((el) => {
    gsap.from(el, { y: 40, opacity: 0, duration: .5, ease: 'power2.out',
      scrollTrigger: { trigger: el, start: 'top 80%' } });
  });
}
document.addEventListener('DOMContentLoaded', initAnimations);
