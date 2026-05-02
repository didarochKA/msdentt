import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { doctors } from "./doctorsData";
import { siteConfig } from "./siteConfig";
import { MapPin, Star } from "lucide-react";

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
  onClick?: () => void;
  ariaLabel: string;
}) {
  const [imgOk, setImgOk] = useState(false);
  const showFallback = !photoUrl || !imgOk;

  return (
    <button
      type="button"
      className={`relative ${sizeClassName} rounded-3xl overflow-hidden bg-white/[0.06] border border-white/10 shrink-0 cursor-zoom-in`}
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
        <div className="absolute inset-0 grid place-items-center text-sm font-semibold text-cyan-100/90">
          {initials(name)}
        </div>
      ) : null}
    </button>
  );
}

export default function DoctorProfilePage() {
  const params = useParams();
  const doctor = useMemo(() => doctors.find((d) => d.id === params.id), [params.id]);
  const [lightbox, setLightbox] = useState<null | { src: string; alt: string }>(null);

  useEffect(() => {
    if (!lightbox) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lightbox]);

  if (!doctor) {
    return (
      <div className="min-h-screen bg-[#08080f] text-white antialiased selection:bg-cyan-400/20 selection:text-cyan-100">
        <div className="fixed inset-0 -z-10 overflow-hidden">
          <div className="bg-orb w-72 h-72 bg-blue-500 top-16 left-10" />
          <div className="bg-orb w-96 h-96 bg-cyan-500 top-[35%] right-[-4rem]" style={{ animationDelay: "1s" }} />
          <div className="bg-orb w-80 h-80 bg-indigo-500 bottom-[-3rem] left-[25%]" style={{ animationDelay: "2s" }} />
        </div>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
          <p className="text-slate-300">Врач не найден.</p>
          <div className="mt-6">
            <Link
              to="/doctors"
              className="px-4 py-2.5 rounded-xl glass hover:bg-white/10 transition-colors text-sm"
            >
              ← К списку врачей
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#08080f] text-white antialiased selection:bg-cyan-400/20 selection:text-cyan-100">
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="bg-orb w-72 h-72 bg-blue-500 top-16 left-10" />
        <div className="bg-orb w-96 h-96 bg-cyan-500 top-[35%] right-[-4rem]" style={{ animationDelay: "1s" }} />
        <div className="bg-orb w-80 h-80 bg-indigo-500 bottom-[-3rem] left-[25%]" style={{ animationDelay: "2s" }} />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link to="/doctors" className="text-sm text-slate-200/90 hover:text-white transition-colors">
            ← Врачи
          </Link>
          <Link to="/" className="text-sm text-slate-200/90 hover:text-white transition-colors">
            На главную
          </Link>
        </div>

        <section className="mt-6 rounded-3xl glass soft-glow">
            <div className="p-6 sm:p-8">
              <div className="flex items-start gap-4">
                <DoctorAvatar
                  name={doctor.name}
                  photoUrl={doctor.photoUrl}
                  sizeClassName="w-16 h-16 sm:w-20 sm:h-20"
                  onClick={() => {
                    if (doctor.photoUrl) setLightbox({ src: doctor.photoUrl, alt: doctor.name });
                  }}
                  ariaLabel={doctor.photoUrl ? `Увеличить фото: ${doctor.name}` : `Фото: ${doctor.name}`}
                />
                <div>
                  <h1 className="text-2xl sm:text-3xl font-semibold">{doctor.name}</h1>
                  <p className="mt-1 text-cyan-200/90 italic">{doctor.role}</p>
                </div>
              </div>

              <div className="mt-4 grid sm:grid-cols-2 gap-3">
                <div className="rounded-2xl glass p-4">
                  <p className="text-xs text-slate-400">Опыт доктора</p>
                  <div className="mt-2 flex items-center gap-2">
                    <Star size={16} className="text-amber-300" />
                    <p className="font-semibold">{doctor.rating.doctorExperienceScore}</p>
                  </div>
                </div>
                <div className="rounded-2xl glass p-4">
                  <p className="text-xs text-slate-400">Отзывы пациентов</p>
                  <div className="mt-2 flex items-center gap-2">
                    <Star size={16} className="text-cyan-300" />
                    <p className="font-semibold">{doctor.rating.patientReviewsScore}</p>
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
                <p className="text-sm font-medium text-white">Принимает в клиниках:</p>
                <div className="mt-2 space-y-2 text-sm text-slate-200">
                  {doctor.clinics.map((c) => (
                    <div key={c.address} className="flex items-start gap-2">
                      <MapPin size={16} className="mt-0.5 text-rose-300 shrink-0" />
                      <span>{c.address}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-7">
                <h2 className="text-lg font-semibold">Образование и опыт работы</h2>
                <div className="mt-3 grid sm:grid-cols-2 gap-3">
                  <div className="rounded-2xl glass p-4">
                    <p className="text-xs text-slate-400">Стаж работы</p>
                    <p className="mt-1 font-semibold">{doctor.experienceYears} лет</p>
                  </div>
                  <div className="rounded-2xl glass p-4">
                    <p className="text-xs text-slate-400">Принимает</p>
                    <p className="mt-1 font-semibold">взрослых{doctor.acceptsFromAge <= 16 ? " и детей" : ""} с {doctor.acceptsFromAge} лет</p>
                  </div>
                </div>

                <details className="mt-4 rounded-2xl glass p-4">
                  <summary className="cursor-pointer text-sm font-medium text-cyan-200/90">
                    Образование: смотреть полностью
                  </summary>
                  <ul className="mt-3 space-y-2 text-sm text-slate-200 list-disc pl-5">
                    {doctor.education.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                </details>
              </div>

              <div className="mt-8">
                <h2 className="text-lg font-semibold">Процедуры, которые врач выполняет</h2>
                <ul className="mt-3 space-y-2 text-sm text-slate-200 list-disc pl-5 marker:text-cyan-300">
                  {doctor.procedures.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>

              <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
                <h2 className="text-lg font-semibold">О враче</h2>
                <p className="mt-2 text-sm text-slate-200 leading-relaxed">{doctor.bio}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {doctor.tags.map((t) => (
                    <span
                      key={t}
                      className="text-[11px] px-2 py-1 rounded-full border border-white/10 bg-white/[0.04] text-slate-200"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-8 grid sm:grid-cols-2 gap-3">
                <Link
                  to={`/?to=booking&doctorId=${encodeURIComponent(doctor.id)}`}
                  className="w-full text-center px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-semibold hover:translate-y-[-1px] transition soft-glow"
                >
                  Записаться онлайн
                </Link>
                <a
                  href={`tel:+${siteConfig.phoneDigits}`}
                  className="w-full text-center px-4 py-3 rounded-xl glass hover:bg-white/10 text-white font-semibold transition-colors"
                >
                  Запись по телефону
                </a>
              </div>
            </div>
        </section>
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

