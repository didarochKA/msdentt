import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { doctors } from "./doctorsData";

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .filter(Boolean)
    .join("");
}

function DoctorAvatar({
  name,
  photoUrl,
  sizeClassName,
  onClick,
  ariaLabel,
}: {
  name: string;
  photoUrl?: string;
  sizeClassName: string;
  onClick?: (e: React.MouseEvent) => void;
  ariaLabel: string;
}) {
  const [imgOk, setImgOk] = useState(false);
  const showFallback = !photoUrl || !imgOk;

  return (
    <button
      type="button"
      className={`relative ${sizeClassName} rounded-2xl overflow-hidden bg-white/[0.06] border border-white/10 shrink-0 cursor-zoom-in`}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      {photoUrl ? (
        <img
          src={photoUrl}
          alt={name}
          className="w-full h-full object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
          onLoad={() => setImgOk(true)}
          onError={(e) => {
            setImgOk(false);
            e.currentTarget.style.display = "none";
          }}
        />
      ) : null}
      {showFallback ? (
        <div className="absolute inset-0 grid place-items-center text-xs font-semibold text-cyan-100/90">
          {initials(name)}
        </div>
      ) : null}
    </button>
  );
}

export default function DoctorsPage() {
  const items = useMemo(() => doctors, []);
  const [lightbox, setLightbox] = useState<null | { src: string; alt: string }>(null);

  useEffect(() => {
    if (!lightbox) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lightbox]);

  return (
    <div className="min-h-screen bg-[#08080f] text-white antialiased selection:bg-cyan-400/20 selection:text-cyan-100">
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="bg-orb w-72 h-72 bg-blue-500 top-16 left-10" />
        <div className="bg-orb w-96 h-96 bg-cyan-500 top-[35%] right-[-4rem]" style={{ animationDelay: "1s" }} />
        <div className="bg-orb w-80 h-80 bg-indigo-500 bottom-[-3rem] left-[25%]" style={{ animationDelay: "2s" }} />
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-cyan-200/80">Команда</p>
            <h1 className="mt-2 text-4xl sm:text-5xl font-semibold">Врачи MsDent</h1>
            <p className="mt-4 text-slate-300 max-w-2xl">
              Специалисты с фокусом на комфорт, цифровую диагностику и понятный план лечения. Откройте профиль врача,
              чтобы увидеть опыт, образование и процедуры.
            </p>
          </div>
          <Link
            to="/"
            className="px-4 py-2.5 rounded-xl glass hover:bg-white/10 transition-colors text-sm"
          >
            ← На главную
          </Link>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-10">
          {items.map((d) => (
            <Link
              key={d.id}
              to={`/doctors/${d.id}`}
              className="rounded-2xl p-6 glass hover:bg-white/[0.06] hover:border-cyan-300/30 hover:shadow-[0_20px_40px_rgba(6,182,212,.12)] transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <DoctorAvatar
                    name={d.name}
                    photoUrl={d.photoUrl}
                    sizeClassName="w-12 h-12"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (d.photoUrl) setLightbox({ src: d.photoUrl, alt: d.name });
                    }}
                    ariaLabel={d.photoUrl ? `Увеличить фото: ${d.name}` : `Фото: ${d.name}`}
                  />
                  <div>
                  <h2 className="text-xl font-semibold">{d.name}</h2>
                  <p className="mt-1 text-sm text-slate-300">{d.role}</p>
                  </div>
                </div>
                <span className="text-[11px] px-2 py-1 rounded-full border border-cyan-300/25 bg-cyan-400/10 text-cyan-100/90">
                  {d.experienceYears}+ лет
                </span>
              </div>
              <p className="mt-4 text-sm text-slate-200 leading-relaxed">{d.bio}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {d.tags.map((t) => (
                  <span
                    key={t}
                    className="text-[11px] px-2 py-1 rounded-full border border-white/10 bg-white/[0.04] text-slate-200"
                  >
                    {t}
                  </span>
                ))}
              </div>
              <div className="mt-6 text-sm text-cyan-200/90">Открыть профиль →</div>
            </Link>
          ))}
        </div>
      </div>

      {lightbox ? (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm grid place-items-center px-4"
          role="dialog"
          aria-modal="true"
          aria-label="Просмотр фото врача"
          onClick={() => setLightbox(null)}
        >
          <div
            className="w-[90vw] max-w-[520px] rounded-3xl glass border border-white/10 p-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 px-2 pb-2">
              <div className="text-sm text-slate-200/90 truncate">{lightbox.alt}</div>
              <button
                type="button"
                className="px-3 py-1.5 rounded-xl glass hover:bg-white/10 transition-colors text-sm"
                onClick={() => setLightbox(null)}
              >
                Закрыть
              </button>
            </div>
            <div className="rounded-2xl overflow-hidden bg-white/[0.03] border border-white/10">
              <img
                src={lightbox.src}
                alt={lightbox.alt}
                className="w-full max-h-[70vh] object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="px-2 pt-2 text-[12px] text-slate-400">Esc или клик по фону — закрыть.</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

