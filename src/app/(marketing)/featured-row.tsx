"use client";

import { useEffect, useRef, useState } from "react";

type Card = { id: string; headline: string; organization: string; title: string; url: string };

export function FeaturedRow({ cards }: { cards: Card[] }) {
  const track = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });
  useEffect(() => {
    const list = track.current;
    if (!list) return;
    function sync() {
      if (list) setEdges({ start: list.scrollLeft < 2, end: list.scrollWidth - list.clientWidth - list.scrollLeft < 2 });
    }
    const observer = new ResizeObserver(sync);
    observer.observe(list);
    list.addEventListener("scroll", sync, { passive: true });
    sync();
    return () => { observer.disconnect(); list.removeEventListener("scroll", sync); };
  }, [cards.length]);

  function move(direction: number) {
    const list = track.current;
    const first = list?.firstElementChild;
    if (!list || !first) return;
    const step = first.getBoundingClientRect().width + parseFloat(getComputedStyle(list).columnGap);
    list.scrollBy({ left: direction * step, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }
  return <>
    <ul id="featured-cards" ref={track} aria-label="Featured opportunities" tabIndex={0} className="mt-5 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3">
      {cards.map(card => <li key={card.id} className="w-[82%] shrink-0 snap-start sm:w-[42%] lg:w-[33%]">
        <a href={card.url} title={card.title} className="flex h-full min-h-36 flex-col justify-between gap-5 rounded-xl border border-[#641426]/15 bg-[#faf7f4] p-5 hover:border-[#641426] focus-visible:outline-offset-[-3px]">
          <span className="text-sm text-stone-600">{card.organization}</span>
          <h3 className="text-xl font-semibold leading-tight">{card.headline}</h3>
        </a>
      </li>)}
    </ul>
    {!(edges.start && edges.end) && <div className="mt-2 flex justify-end gap-2">
      {[-1, 1].map(direction => <button type="button" key={direction} aria-controls="featured-cards" aria-label={direction < 0 ? "Previous opportunity" : "Next opportunity"} disabled={direction < 0 ? edges.start : edges.end} onClick={() => move(direction)} className="h-11 w-11 rounded-full border border-current text-lg disabled:opacity-30">{direction < 0 ? "←" : "→"}</button>)}
    </div>}
  </>;
}
