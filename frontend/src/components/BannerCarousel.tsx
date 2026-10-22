import React, { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export type BannerSlide =
  | { kind: 'image'; src: string; alt: string }
  | { kind: 'custom'; key: string; content: React.ReactNode };

interface BannerCarouselProps {
  slides: BannerSlide[];
  intervalMs?: number;
}

// Auto-rotating banner; pauses while hovered/focused and when the tab is hidden
export const BannerCarousel: React.FC<BannerCarouselProps> = ({ slides, intervalMs = 5000 }) => {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = slides.length;

  const go = useCallback((next: number) => setIndex(((next % count) + count) % count), [count]);

  useEffect(() => {
    if (paused || count < 2) return;
    const timer = window.setTimeout(() => {
      if (!document.hidden) go(index + 1);
    }, intervalMs);
    return () => window.clearTimeout(timer);
  }, [index, paused, count, intervalMs, go]);

  if (count === 0) return null;

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Announcements"
      className="group relative overflow-hidden rounded-3xl shadow-xl"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="relative aspect-[1257/360] min-h-[210px] w-full">
        {slides.map((slide, i) => {
          const active = i === index;
          return (
            <div
              key={slide.kind === 'image' ? slide.src : slide.key}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${count}`}
              aria-hidden={!active}
              className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                active ? 'opacity-100' : 'pointer-events-none opacity-0'
              }`}
            >
              {slide.kind === 'image' ? (
                // Contain + matching gradient keeps the whole banner visible when the slot is taller than 1257:360 (phones)
                <div className="h-full w-full bg-gradient-to-b from-[#0b0660] to-[#3b00e6]">
                  <img src={slide.src} alt={slide.alt} className="h-full w-full object-contain" loading={i === 0 ? 'eager' : 'lazy'} />
                </div>
              ) : (
                slide.content
              )}
            </div>
          );
        })}
      </div>

      {count > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(index - 1)}
            aria-label="Previous slide"
            className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-white opacity-0 backdrop-blur transition-opacity hover:bg-black/50 focus:opacity-100 group-hover:opacity-100"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => go(index + 1)}
            aria-label="Next slide"
            className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-white opacity-0 backdrop-blur transition-opacity hover:bg-black/50 focus:opacity-100 group-hover:opacity-100"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          {/* Dots double as a 5s progress indicator for the active slide */}
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2">
            {slides.map((slide, i) => (
              <button
                key={slide.kind === 'image' ? slide.src : slide.key}
                type="button"
                onClick={() => go(i)}
                aria-label={`Go to slide ${i + 1}`}
                aria-current={i === index}
                className={`relative h-1.5 overflow-hidden rounded-full bg-white/40 transition-all ${i === index ? 'w-8' : 'w-1.5 hover:bg-white/70'}`}
              >
                {i === index && (
                  <span
                    key={`${index}-${paused}`}
                    className="absolute inset-y-0 left-0 rounded-full bg-white"
                    style={{
                      width: paused ? '100%' : undefined,
                      animation: paused ? undefined : `banner-progress ${intervalMs}ms linear forwards`,
                    }}
                  />
                )}
              </button>
            ))}
          </div>
          <style>{'@keyframes banner-progress { from { width: 0% } to { width: 100% } }'}</style>
        </>
      )}
    </section>
  );
};
