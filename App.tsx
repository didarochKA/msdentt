import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  CalendarCheck2,
  Check,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  Gem,
  Globe,
  HeartPulse,
  Menu,
  ScanFace,
  Send,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Syringe,
  X,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { siteConfig } from "./siteConfig";
import { doctors } from "./doctorsData";

type RevealEl = HTMLElement & { dataset: DOMStringMap };
type SessionAccount = { email: string; name: string; isAdmin: boolean };
type StoredSession = { token: string; account: SessionAccount };
type AdminUser = { id: string; email: string; name: string; isAdmin: boolean; createdAt: string };
type AdminStatus = "new" | "in_progress" | "done";
type AdminBooking = {
  id: string;
  phone: string;
  plan: string | null;
  doctorId: string | null;
  reason: string | null;
  status: AdminStatus;
  note: string | null;
  assignedTo: string | null;
  assignedAt?: string | null;
  createdAt: string;
  updatedAt?: string;
};
type AdminConsultation = {
  id: string;
  email: string;
  status: AdminStatus;
  note: string | null;
  assignedTo: string | null;
  assignedAt?: string | null;
  createdAt: string;
  updatedAt?: string;
};
type AdminDashboard = {
  stats: { users: number; bookings: number; consultations: number };
  users: AdminUser[];
  bookings: AdminBooking[];
  consultations: AdminConsultation[];
};

function statusLabel(status: AdminStatus): string {
  if (status === "new") return "Новая";
  if (status === "in_progress") return "В работе";
  return "Закрыта";
}

function statusPillClass(status: AdminStatus): string {
  if (status === "new") return "bg-cyan-400/15 text-cyan-100 border-cyan-300/30";
  if (status === "in_progress") return "bg-amber-400/15 text-amber-100 border-amber-300/30";
  return "bg-emerald-400/15 text-emerald-100 border-emerald-300/30";
}

function bookingMatchesAdminQuery(b: AdminBooking, qRaw: string): boolean {
  const q = qRaw.trim().toLowerCase();
  if (!q) return true;
  const digitsQ = q.replace(/\D/g, "");
  const doctor = b.doctorId ? doctors.find((d) => d.id === b.doctorId) : undefined;
  const doctorLine = doctor ? `${doctor.name} ${doctor.role}`.toLowerCase() : "";
  return (
    b.phone.includes(digitsQ) ||
    (b.plan || "").toLowerCase().includes(q) ||
    (b.reason || "").toLowerCase().includes(q) ||
    (b.doctorId || "").toLowerCase().includes(q) ||
    doctorLine.includes(q) ||
    (b.status || "").toLowerCase().includes(q) ||
    (b.note || "").toLowerCase().includes(q) ||
    (b.assignedTo || "").toLowerCase().includes(q) ||
    new Date(b.createdAt).toLocaleString().toLowerCase().includes(q)
  );
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {}
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.top = "-9999px";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

function downloadCsv(filename: string, rows: Array<Record<string, string | number | null | undefined>>) {
  const headers = Array.from(
    rows.reduce((acc, row) => {
      Object.keys(row).forEach((k) => acc.add(k));
      return acc;
    }, new Set<string>())
  );
  const escape = (v: unknown) => {
    const s = String(v ?? "");
    if (/[",\n\r;]/.test(s)) return `"${s.split('"').join('""')}"`;
    return s;
  };
  const lines = [headers.join(";"), ...rows.map((r) => headers.map((h) => escape(r[h])).join(";"))].join("\n");
  const blob = new Blob([`\uFEFF${lines}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const navLinks = [
  { id: "hero", label: "Главная" },
  { id: "advantages", label: "Преимущества" },
  { id: "how", label: "Как это работает" },
  { id: "pricing", label: "Цены" },
  { id: "booking", label: "Запись онлайн" },
  { id: "consultation", label: "Консультация" },
  { id: "faq", label: "FAQ" },
];

const BOOKING_REASONS = [
  "Первичная консультация",
  "Профессиональная гигиена",
  "Лечение кариеса",
  "Эндодонтическое лечение (каналы)",
  "Эстетическая реставрация",
  "Отбеливание",
  "Консультация ортодонта",
  "Брекеты / элайнеры (подбор и план)",
  "Консультация ортопеда (протезирование)",
  "Имплантация (консультация/план)",
  "Удаление зуба",
  "Услуги гнатолога (прикус / СМА)",
  "Диагностика (ОПТГ / КЛКТ)",
  "Другое (уточню в переписке)",
] as const;

const advantages = [
  {
    title: "Безболезненное лечение",
    text: "Современные протоколы анестезии и бережный подход для максимального комфорта.",
    icon: Syringe,
  },
  {
    title: "Цифровая диагностика",
    text: "3D-сканирование и точная визуализация позволяют принимать решения быстрее и точнее.",
    icon: ScanFace,
  },
  {
    title: "Оборудование экспертного класса",
    text: "Технологии последнего поколения для прогнозируемого и безопасного результата.",
    icon: Sparkles,
  },
  {
    title: "Врачи с большим опытом",
    text: "Команда практикующих специалистов с международной экспертизой и стабильными результатами.",
    icon: Stethoscope,
  },
  {
    title: "Гарантия результата",
    text: "Прозрачный план лечения и сопровождение после процедур для долгосрочного эффекта.",
    icon: ShieldCheck,
  },
  {
    title: "Премиальный сервис",
    text: "Персональный менеджер, точное время приема и комфортный формат на каждом этапе.",
    icon: Gem,
  },
];

const reviews = [
  {
    initials: "АМ",
    name: "Айжан М.",
    text: "Максимально комфортно, без стресса и боли. Чувствуется уровень клиники с первого визита.",
  },
  {
    initials: "ТК",
    name: "Тимур К.",
    text: "Сделали цифровую диагностику и сразу показали понятный план лечения. Очень профессионально.",
  },
  {
    initials: "ЖС",
    name: "Жанна С.",
    text: "Идеальный сервис: от записи до результата. Теперь рекомендую MsDent близким.",
  },
];

const plans = {
  monthly: [
    {
      name: "Базовый",
      price: "79 000 ₸",
      highlighted: false,
      services: [
        "Первичная консультация",
        "Профессиональная гигиена",
        "Цифровая диагностика",
      ],
    },
    {
      name: "Pro",
      price: "149 000 ₸",
      highlighted: true,
      services: [
        "Все из Базового",
        "Лечение кариеса (до 2 зубов)",
        "Персональный план ухода",
      ],
    },
    {
      name: "Премиум",
      price: "249 000 ₸",
      highlighted: false,
      services: [
        "Все из Pro",
        "Эстетическая реставрация",
        "Приоритетная запись 24/7",
      ],
    },
  ],
  yearly: [
    {
      name: "Базовый",
      price: "790 000 ₸",
      highlighted: false,
      services: [
        "12 месяцев сопровождения",
        "2 профессиональные чистки",
        "Диагностика каждые 6 месяцев",
      ],
    },
    {
      name: "Pro",
      price: "1 490 000 ₸",
      highlighted: true,
      services: [
        "Все из Базового",
        "Расширенная терапия",
        "Персональный куратор",
      ],
    },
    {
      name: "Премиум",
      price: "2 390 000 ₸",
      highlighted: false,
      services: [
        "Все из Pro",
        "Эстетический протокол",
        "VIP-поддержка и concierge",
      ],
    },
  ],
};

const faqItems = [
  {
    q: "Больно ли проходит лечение?",
    a: "Нет. Мы используем щадящие методы анестезии и индивидуально подбираем протокол, чтобы процедура проходила комфортно.",
  },
  {
    q: "Сколько длится первичная консультация?",
    a: "В среднем 40-60 минут: знакомство, диагностика, ответы на вопросы и индивидуальный план лечения.",
  },
  {
    q: "Можно ли записаться онлайн?",
    a: "Да, вы можете оставить заявку на сайте, и наш координатор свяжется с вами в течение 10 минут в рабочее время.",
  },
  {
    q: "Даете ли вы гарантию на лечение?",
    a: "Да, мы предоставляем гарантийные обязательства и ведем пациента после процедур для устойчивого результата.",
  },
  {
    q: "Есть ли рассрочка и поэтапная оплата?",
    a: "Да, доступны удобные сценарии оплаты в зависимости от выбранного плана и сложности лечения.",
  },
];

const statTargets = [
  { label: "Лет опыта", suffix: "+", value: 10, icon: Clock3 },
  { label: "Пациентов", suffix: "+", value: 5000, icon: HeartPulse },
  { label: "Довольных клиентов", suffix: "%", value: 98, icon: ShieldCheck },
  { label: "Поддержка", suffix: "/7", value: 24, icon: CalendarCheck2 },
];

function normalizePhoneDigits(raw: string): string | null {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("8") && d.length === 11) d = `7${d.slice(1)}`;
  if (d.length === 10 && d.startsWith("7")) d = `7${d}`;
  if (d.length === 11 && d.startsWith("7")) return d;
  return null;
}

function normalizeEmail(raw: string): string | null {
  const email = raw.trim();
  if (!email) return null;
  const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  return isValid ? email : null;
}

const SESSION_KEY = "msdent_session";
const API_BASE = import.meta.env.VITE_API_BASE ?? "";

function readStoredSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.token && parsed?.account?.email && parsed?.account?.name) return parsed as StoredSession;
    if (parsed?.email && parsed?.name) {
      const migrated: StoredSession = {
        token: "",
        account: { email: String(parsed.email), name: String(parsed.name), isAdmin: false },
      };
      localStorage.setItem(SESSION_KEY, JSON.stringify(migrated));
      return migrated;
    }
    return null;
  } catch {
    return null;
  }
}

function writeStoredSession(session: StoredSession | null): void {
  if (!session) return void localStorage.removeItem(SESSION_KEY);
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

async function apiPost<T>(path: string, payload: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = typeof data?.message === "string" ? data.message : "Ошибка сервера. Попробуйте снова.";
    throw new Error(message);
  }
  return data as T;
}

async function apiGet<T>(path: string, options?: { headers?: Record<string, string> }): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "GET",
    headers: options?.headers,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = typeof data?.message === "string" ? data.message : "Ошибка сервера. Попробуйте снова.";
    throw new Error(message);
  }
  return data as T;
}

async function apiDelete<T>(path: string, options?: { headers?: Record<string, string> }): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "DELETE",
    headers: options?.headers,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = typeof data?.message === "string" ? data.message : "Ошибка сервера. Попробуйте снова.";
    throw new Error(message);
  }
  return data as T;
}

async function apiPatch<T>(
  path: string,
  payload: Record<string, unknown>,
  options?: { headers?: Record<string, string> }
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...(options?.headers || {}) },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = typeof data?.message === "string" ? data.message : "Ошибка сервера. Попробуйте снова.";
    throw new Error(message);
  }
  return data as T;
}

export default function App() {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [stats, setStats] = useState([0, 0, 0, 0]);
  const [statsStarted, setStatsStarted] = useState(false);
  const statSectionRef = useRef<HTMLElement | null>(null);
  const [bookPhone, setBookPhone] = useState("");
  const [bookError, setBookError] = useState<string | null>(null);
  const [bookBusy, setBookBusy] = useState(false);
  const [bookDone, setBookDone] = useState(false);
  const [consultEmail, setConsultEmail] = useState("");
  const [consultError, setConsultError] = useState<string | null>(null);
  const [consultBusy, setConsultBusy] = useState(false);
  const [consultDone, setConsultDone] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountMode, setAccountMode] = useState<"login" | "register">("login");
  const [accountEmail, setAccountEmail] = useState("");
  const [accountPassword, setAccountPassword] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountError, setAccountError] = useState<string | null>(null);
  const [accountSuccess, setAccountSuccess] = useState<string | null>(null);
  const [accountBusy, setAccountBusy] = useState(false);
  const [adminBusy, setAdminBusy] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminData, setAdminData] = useState<AdminDashboard | null>(null);
  const [adminQuery, setAdminQuery] = useState("");
  const [adminTab, setAdminTab] = useState<"bookings" | "consultations" | "users">("bookings");
  const [adminConfirm, setAdminConfirm] = useState<null | {
    kind: "booking" | "consultation";
    id: string;
    title: string;
    subtitle?: string;
  }>(null);
  const [adminEdit, setAdminEdit] = useState<
    | null
    | {
        kind: "booking" | "consultation";
        id: string;
        title: string;
        status: AdminStatus;
        assignedTo: string;
        note: string;
      }
  >(null);
  const [adminEditBusy, setAdminEditBusy] = useState(false);
  const [adminStatusFilter, setAdminStatusFilter] = useState<"all" | AdminStatus>("all");
  const [adminSelected, setAdminSelected] = useState<Record<"bookings" | "consultations", Record<string, boolean>>>({
    bookings: {},
    consultations: {},
  });
  const [adminBulkBusy, setAdminBulkBusy] = useState(false);
  const [currentAccount, setCurrentAccount] = useState<SessionAccount | null>(null);
  const [authToken, setAuthToken] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [bookingDoctorId, setBookingDoctorId] = useState<string | null>(null);
  const [bookingReason, setBookingReason] = useState<string>("");
  const [payBusy, setPayBusy] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [paymentBanner, setPaymentBanner] = useState<null | "success" | "cancel">(null);
  const bookInputRef = useRef<HTMLInputElement | null>(null);
  const consultInputRef = useRef<HTMLInputElement | null>(null);

  const telHref = useMemo(() => `tel:+${siteConfig.phoneDigits}`, []);
  const mailHref = useMemo(() => `mailto:${siteConfig.email}`, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll);
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search || "");
    const payment = params.get("payment");
    if (payment === "success") setPaymentBanner("success");
    else if (payment === "cancel") setPaymentBanner("cancel");
  }, [location.search]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const doctorId = params.get("doctorId");
    const reason = params.get("reason");
    const to = params.get("to");

    if (doctorId) {
      const exists = doctors.some((d) => d.id === doctorId);
      setBookingDoctorId(exists ? doctorId : null);
    } else {
      setBookingDoctorId(null);
    }

    if (reason) {
      setBookingReason(BOOKING_REASONS.includes(reason as (typeof BOOKING_REASONS)[number]) ? reason : "");
    } else {
      setBookingReason("");
    }

    if (to) window.setTimeout(() => scrollToId(to), 50);
  }, [location.search]);

  useEffect(() => {
    if (!menuOpen && !accountOpen && !adminEdit) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setAccountOpen(false);
        setAdminEdit(null);
      }
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [menuOpen, accountOpen, adminEdit]);

  useEffect(() => {
    const session = readStoredSession();
    setCurrentAccount(session?.account ?? null);
    setAuthToken(session?.token ?? "");
  }, []);

  useEffect(() => {
    if (!authToken) return;
    let cancelled = false;
    apiGet<{ account: SessionAccount }>("/api/accounts/me", {
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then((res) => {
        if (cancelled) return;
        setCurrentAccount(res.account);
        writeStoredSession({ token: authToken, account: res.account });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [authToken]);

  useEffect(() => {
    const elements = Array.from(document.querySelectorAll(".reveal")) as RevealEl[];
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target as RevealEl;
            const delay = Number(el.dataset.delay ?? 0);
            setTimeout(() => el.classList.add("in-view"), delay);
            io.unobserve(el);
          }
        });
      },
      { threshold: 0.2 }
    );

    elements.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [currentAccount?.isAdmin]);

  useEffect(() => {
    if (!statSectionRef.current) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setStatsStarted(true);
            io.disconnect();
          }
        });
      },
      { threshold: 0.35 }
    );
    io.observe(statSectionRef.current);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!statsStarted) return;
    const duration = 1800;
    const stepMs = 30;
    const steps = Math.floor(duration / stepMs);
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep += 1;
      const next = statTargets.map((item) =>
        Math.min(item.value, Math.round((item.value * currentStep) / steps))
      );
      setStats(next);
      if (currentStep >= steps) clearInterval(timer);
    }, stepMs);

    return () => clearInterval(timer);
  }, [statsStarted]);

  const selectedPlans = useMemo(() => plans[billing], [billing]);
  const selectedBookingDoctor = useMemo(
    () => (bookingDoctorId ? doctors.find((d) => d.id === bookingDoctorId) ?? null : null),
    [bookingDoctorId]
  );

  const scrollToId = (id: string, after?: () => void) => {
    const node = document.getElementById(id);
    if (!node) return;
    node.scrollIntoView({ behavior: "smooth", block: "start" });
    setMenuOpen(false);
    if (after) window.setTimeout(after, 400);
  };

  const buildBookingMessage = (digits: string) => {
    const parts = [
      "Здравствуйте! Хочу записаться на приём в MsDent.",
      `Мой телефон: +${digits}`,
    ];
    if (bookingReason.trim()) parts.push(`Хочу записаться на: ${bookingReason.trim()}.`);
    if (selectedBookingDoctor) parts.push(`Врач: ${selectedBookingDoctor.name} (${selectedBookingDoctor.role}).`);
    if (selectedPlan) parts.push(`Интересует план: ${selectedPlan}.`);
    return parts.join("\n");
  };

  const buildConsultMessage = (email: string) =>
    [
      "Здравствуйте! Хочу получить консультацию в MsDent.",
      `Мой email: ${email}`,
      "Прошу связаться со мной.",
    ].join("\n");

  const submitBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setBookError(null);
    setBookDone(false);
    setPayError(null);
    const digits = normalizePhoneDigits(bookPhone);
    if (!digits) {
      setBookError("Введите корректный номер телефона (например, +7 747 749 90 27).");
      return;
    }
    if (!bookingReason.trim()) {
      setBookError("Выберите, на какую терапию / направление вы хотите записаться.");
      return;
    }
    setBookBusy(true);
    try {
      await apiPost("/api/bookings", {
        phone: digits,
        plan: selectedPlan,
        doctorId: bookingDoctorId,
        reason: bookingReason.trim(),
      });
      const text = buildBookingMessage(digits);
      const url = `https://wa.me/${siteConfig.whatsAppDigits}?text=${encodeURIComponent(text)}`;
      window.open(url, "_blank", "noopener,noreferrer");
      setBookDone(true);
      setBookPhone("");
      setSelectedPlan(null);
      setBookingDoctorId(null);
      setBookingReason("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Не удалось отправить заявку.";
      setBookError(message);
    } finally {
      setBookBusy(false);
    }
  };

  const startOnlinePayment = async () => {
    setPayError(null);
    const digits = normalizePhoneDigits(bookPhone);
    if (!digits) {
      setPayError("Введите корректный номер телефона (например, +7 747 749 90 27).");
      return;
    }
    if (!bookingReason.trim()) {
      setPayError("Выберите, на какую терапию / направление вы хотите записаться.");
      return;
    }

    setPayBusy(true);
    try {
      const res = await apiPost<{ ok: true; url: string }>("/api/payments/checkout", {
        phone: digits,
        plan: selectedPlan,
        doctorId: bookingDoctorId,
        reason: bookingReason.trim(),
      });
      window.location.href = res.url;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Не удалось создать оплату.";
      setPayError(message);
    } finally {
      setPayBusy(false);
    }
  };

  const submitConsultation = async (e: React.FormEvent) => {
    e.preventDefault();
    setConsultError(null);
    setConsultDone(false);
    const email = normalizeEmail(consultEmail);
    if (!email) {
      setConsultError("Введите корректный email, например msdent@gmail.com.");
      return;
    }
    setConsultBusy(true);
    try {
      await apiPost("/api/consultations", { email });
      const body = buildConsultMessage(email);
      const subject = encodeURIComponent("Консультация — MsDent");
      window.location.href = `${mailHref}?subject=${subject}&body=${encodeURIComponent(body)}`;
      setConsultDone(true);
      setConsultEmail("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Не удалось отправить заявку.";
      setConsultError(message);
    } finally {
      setConsultBusy(false);
    }
  };

  const selectPlan = (planName: string) => {
    setSelectedPlan(planName);
    scrollToId("booking", () => bookInputRef.current?.focus());
  };

  const openAccountModal = (mode: "login" | "register" = "login") => {
    setAccountMode(mode);
    setAccountOpen(true);
    setMenuOpen(false);
    setAccountError(null);
    setAccountSuccess(null);
    if (currentAccount) {
      setAccountEmail(currentAccount.email);
      setAccountName(currentAccount.name);
      setAccountPassword("");
    }
  };

  const submitAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccountError(null);
    setAccountSuccess(null);
    const email = normalizeEmail(accountEmail);
    if (!email) {
      setAccountError("Введите корректный email.");
      return;
    }
    if (accountMode === "register" && accountName.trim().length < 2) {
      setAccountError("Укажите имя (минимум 2 символа).");
      return;
    }
    if (accountMode === "register" && accountPassword.trim().length < 6) {
      setAccountError("Пароль должен содержать минимум 6 символов.");
      return;
    }

    setAccountBusy(true);
    try {
      const endpoint = accountMode === "register" ? "/api/accounts/register" : "/api/accounts/login";
      const payload =
        accountMode === "register"
          ? { email, name: accountName.trim(), password: accountPassword.trim() }
          : { email, password: accountPassword.trim() };
      const response = await apiPost<{ account: SessionAccount; token: string }>(endpoint, payload);
      if (!response.token) throw new Error("Токен не получен от сервера. Перезапустите API и войдите заново.");
      writeStoredSession({ account: response.account, token: response.token });
      setAuthToken(response.token);
      setCurrentAccount(response.account);
      setAccountSuccess(accountMode === "register" ? "Аккаунт создан, вы автоматически вошли." : "Вход выполнен.");
      setAccountOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Ошибка авторизации.";
      setAccountError(message);
    } finally {
      setAccountBusy(false);
    }
  };

  const logoutAccount = () => {
    writeStoredSession(null);
    setCurrentAccount(null);
    setAuthToken("");
    setAccountPassword("");
    setAccountSuccess(null);
    setAccountError(null);
  };

  const loadAdminDashboard = async () => {
    setAdminError(null);
    setAdminBusy(true);
    try {
      const data = await apiGet<AdminDashboard>("/api/admin/dashboard", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      setAdminData(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Не удалось загрузить админ-панель.";
      setAdminError(message);
      setAdminData(null);
    } finally {
      setAdminBusy(false);
    }
  };

  const saveAdminEdit = async () => {
    if (!adminEdit) return;
    setAdminEditBusy(true);
    setAdminError(null);
    try {
      if (adminEdit.kind === "booking") {
        const res = await apiPatch<{ ok: boolean; booking: AdminBooking }>(
          `/api/admin/bookings/${adminEdit.id}`,
          {
            status: adminEdit.status,
            assignedTo: adminEdit.assignedTo.trim() ? adminEdit.assignedTo.trim() : null,
            note: adminEdit.note.trim() ? adminEdit.note.trim() : null,
          },
          { headers: { Authorization: `Bearer ${authToken}` } }
        );
        setAdminData((prev) =>
          prev
            ? { ...prev, bookings: prev.bookings.map((b) => (b.id === adminEdit.id ? res.booking : b)) }
            : prev
        );
      } else {
        const res = await apiPatch<{ ok: boolean; consultation: AdminConsultation }>(
          `/api/admin/consultations/${adminEdit.id}`,
          {
            status: adminEdit.status,
            assignedTo: adminEdit.assignedTo.trim() ? adminEdit.assignedTo.trim() : null,
            note: adminEdit.note.trim() ? adminEdit.note.trim() : null,
          },
          { headers: { Authorization: `Bearer ${authToken}` } }
        );
        setAdminData((prev) =>
          prev
            ? {
                ...prev,
                consultations: prev.consultations.map((c) => (c.id === adminEdit.id ? res.consultation : c)),
              }
            : prev
        );
      }
      setAdminEdit(null);
    } catch (e) {
      setAdminError(e instanceof Error ? e.message : "Не удалось сохранить изменения.");
    } finally {
      setAdminEditBusy(false);
    }
  };

  return (
    <div className="bg-[#08080f] text-white min-h-screen antialiased selection:bg-cyan-400/20 selection:text-cyan-100">
      <a className="skip-link" href="#main">
        Перейти к содержимому
      </a>

      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="bg-orb w-72 h-72 bg-blue-500 top-16 left-10" />
        <div className="bg-orb w-96 h-96 bg-cyan-500 top-[35%] right-[-4rem]" style={{ animationDelay: "1s" }} />
        <div className="bg-orb w-80 h-80 bg-indigo-500 bottom-[-3rem] left-[25%]" style={{ animationDelay: "2s" }} />
      </div>

      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled ? "bg-[#08080f]/70 backdrop-blur-xl border-b border-white/10" : "bg-transparent"
        }`}
      >
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <button onClick={() => scrollToId("hero")} className="flex items-center gap-2">
            <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center soft-glow">
              <Sparkles size={18} />
            </span>
            <span className="font-semibold tracking-wide text-lg">MsDent</span>
          </button>

          <div className="hidden lg:flex items-center gap-8 text-sm text-slate-200/90">
            {navLinks.map((link) => (
              <button
                key={link.id}
                onClick={() => scrollToId(link.id)}
                className="hover:text-white transition-colors"
              >
                {link.label}
              </button>
            ))}
            <Link to="/doctors" className="hover:text-white transition-colors">
              Врачи
            </Link>
          </div>

          <div className="hidden lg:flex items-center gap-3">
            {currentAccount?.isAdmin && (
              <button
                type="button"
                onClick={() => scrollToId("admin")}
                className="px-4 py-2.5 rounded-xl glass hover:bg-white/10 transition-colors text-sm"
              >
                Админ-панель
              </button>
            )}
            {currentAccount ? (
              <>
                <div className="px-4 py-2 rounded-xl glass text-sm">
                  {currentAccount.name}
                </div>
                <button
                  type="button"
                  onClick={logoutAccount}
                  className="px-4 py-2.5 rounded-xl glass hover:bg-white/10 transition-colors text-sm"
                >
                  Выйти
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => openAccountModal("login")}
                className="px-4 py-2.5 rounded-xl glass hover:bg-white/10 transition-colors text-sm"
              >
                Аккаунт
              </button>
            )}
            <button
              type="button"
              onClick={() => scrollToId("booking")}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-medium hover:scale-[1.03] transition-transform soft-glow"
            >
              Записаться
            </button>
          </div>

          <button
            className="lg:hidden p-2 rounded-lg glass"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Открыть меню"
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </nav>

        {menuOpen && (
          <div className="lg:hidden px-4 pb-4">
            <div className="glass rounded-2xl p-4 flex flex-col gap-3">
              {navLinks.map((link) => (
                <button
                  key={link.id}
                  onClick={() => scrollToId(link.id)}
                  className="text-left text-slate-200 hover:text-white py-2"
                >
                  {link.label}
                </button>
              ))}
              <Link to="/doctors" className="text-left text-slate-200 hover:text-white py-2">
                Врачи
              </Link>
              <button
                type="button"
                onClick={() => scrollToId("booking")}
                className="mt-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500"
              >
                Записаться
              </button>
              {currentAccount?.isAdmin && (
                <button
                  type="button"
                  onClick={() => scrollToId("admin")}
                  className="px-4 py-2.5 rounded-xl glass text-left"
                >
                  Админ-панель
                </button>
              )}
              {currentAccount ? (
                <>
                  <div className="px-4 py-2.5 rounded-xl glass text-left text-sm">
                    {currentAccount.name}
                  </div>
                  <button
                    type="button"
                    onClick={logoutAccount}
                    className="px-4 py-2.5 rounded-xl glass text-left"
                  >
                    Выйти
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => openAccountModal("login")}
                  className="px-4 py-2.5 rounded-xl glass text-left"
                >
                  Аккаунт
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      <main id="main" className="pt-24">
        <section id="hero" className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="fade-in-up">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass text-xs text-cyan-100/90 mb-5">
                <HeartPulse size={14} />
                Премиальная стоматология в Астане
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold leading-tight">
                Премиальная стоматология
                <span className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
                  {" "}
                  без боли
                </span>{" "}
                в Астане
              </h1>
              <p className="mt-6 text-slate-300 text-base sm:text-lg leading-relaxed max-w-xl">
                Точная цифровая диагностика, персональный план лечения и сервис высокого уровня.
                Мы делаем процесс спокойным, предсказуемым и максимально комфортным.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4">
                <button
                  type="button"
                  onClick={() => scrollToId("booking", () => bookInputRef.current?.focus())}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 font-medium soft-glow hover:scale-[1.03] transition-transform"
                >
                  Записаться онлайн
                </button>
                <button
                  type="button"
                  onClick={() => scrollToId("consultation", () => consultInputRef.current?.focus())}
                  className="px-6 py-3 rounded-xl glass hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
                >
                  Получить консультацию <ArrowRight size={17} />
                </button>
              </div>
            </div>

            <div className="reveal" data-delay="100">
              <div className="glass rounded-3xl p-6 sm:p-8 soft-glow">
                <div className="rounded-2xl p-5 bg-gradient-to-br from-blue-500/20 to-cyan-500/10 border border-white/10">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm text-cyan-100/90">Smart Dental Preview</p>
                    <Sparkles size={17} className="text-cyan-300" />
                  </div>
                  <div className="space-y-3">
                    {[
                      "AI-анализ снимка за 2 минуты",
                      "Точный план лечения и сроки",
                      "Комфортные процедуры без боли",
                    ].map((item) => (
                      <div key={item} className="flex items-center gap-2 text-slate-200">
                        <Check size={16} className="text-cyan-300" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-5">
                  <div className="glass rounded-xl p-4">
                    <p className="text-xs text-slate-400">Среднее время визита</p>
                    <p className="text-2xl font-semibold mt-1">45 мин</p>
                  </div>
                  <div className="glass rounded-xl p-4">
                    <p className="text-xs text-slate-400">Точность диагностики</p>
                    <p className="text-2xl font-semibold mt-1">98%</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="advantages" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="reveal">
            <h2 className="text-3xl sm:text-4xl font-semibold">Почему выбирают MsDent</h2>
            <p className="mt-3 text-slate-300 max-w-2xl">
              Современные технологии, сильная команда и сервис, который ощущается как забота.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-10">
            {advantages.map((item, idx) => {
              const Icon = item.icon;
              return (
                <article
                  key={item.title}
                  className="reveal glass rounded-2xl p-6 hover:scale-[1.03] hover:border-cyan-300/40 hover:shadow-[0_20px_40px_rgba(6,182,212,.12)] transition-all duration-300"
                  data-delay={idx * 90}
                >
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500/30 to-cyan-500/20 border border-white/10 flex items-center justify-center text-cyan-300 mb-4">
                    <Icon size={20} />
                  </div>
                  <h3 className="font-semibold text-lg">{item.title}</h3>
                  <p className="mt-2 text-slate-300 text-sm leading-relaxed">{item.text}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section ref={statSectionRef} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="glass rounded-3xl p-6 sm:p-10">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              {statTargets.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="reveal" data-delay={idx * 100}>
                    <div className="flex items-center gap-2 text-cyan-300 mb-2">
                      <Icon size={17} />
                      <span className="text-xs uppercase tracking-[0.14em] text-slate-400">Показатель</span>
                    </div>
                    <p className="text-3xl sm:text-4xl font-semibold">
                      {stats[idx]}
                      {item.suffix}
                    </p>
                    <p className="mt-1 text-slate-300 text-sm">{item.label}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section id="how" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="reveal">
            <h2 className="text-3xl sm:text-4xl font-semibold">Как это работает</h2>
            <p className="mt-3 text-slate-300">Прозрачный путь к здоровой и красивой улыбке.</p>
          </div>
          <div className="relative mt-10 grid md:grid-cols-3 gap-5">
            <div className="hidden md:block absolute top-12 left-[18%] right-[18%] h-[2px] line-gradient opacity-70" />
            {[
              { step: "01", title: "Консультация", text: "Обсуждаем запрос, собираем анамнез и формируем ожидания." },
              { step: "02", title: "Диагностика", text: "Проводим цифровой анализ и строим персональный протокол лечения." },
              { step: "03", title: "Лечение", text: "Выполняем процедуры с фокусом на комфорт, эстетику и результат." },
            ].map((item, i) => (
              <article key={item.step} className="reveal glass rounded-2xl p-6 relative" data-delay={i * 120}>
                <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center font-semibold mb-4 soft-glow">
                  {item.step}
                </div>
                <h3 className="font-semibold text-xl">{item.title}</h3>
                <p className="mt-2 text-slate-300">{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="reveal">
            <h2 className="text-3xl sm:text-4xl font-semibold">Отзывы пациентов</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5 mt-8">
            {reviews.map((review, i) => (
              <article key={review.name} className="reveal glass rounded-2xl p-6" data-delay={i * 100}>
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500/30 to-cyan-500/30 border border-white/15 flex items-center justify-center font-semibold">
                    {review.initials}
                  </div>
                  <div className="text-amber-300 text-sm">★★★★★</div>
                </div>
                <p className="mt-4 text-slate-200 leading-relaxed">{review.text}</p>
                <p className="mt-3 text-sm text-slate-400">{review.name}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="pricing" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="reveal flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5">
            <div>
              <h2 className="text-3xl sm:text-4xl font-semibold">Пакеты лечения</h2>
              <p className="mt-3 text-slate-300">Выберите комфортный формат сопровождения.</p>
            </div>
            <div className="glass rounded-xl p-1 inline-flex">
              <button
                onClick={() => setBilling("monthly")}
                className={`px-4 py-2 rounded-lg text-sm transition ${
                  billing === "monthly" ? "bg-white/15 text-white" : "text-slate-300"
                }`}
              >
                Ежемесячно
              </button>
              <button
                onClick={() => setBilling("yearly")}
                className={`px-4 py-2 rounded-lg text-sm transition ${
                  billing === "yearly" ? "bg-white/15 text-white" : "text-slate-300"
                }`}
              >
                Годовой план
              </button>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-5 mt-8">
            {selectedPlans.map((plan, i) => (
              <article
                key={plan.name}
                className={`reveal rounded-2xl p-6 transition-all duration-300 hover:scale-[1.02] ${
                  plan.highlighted
                    ? "bg-gradient-to-b from-blue-500/25 to-cyan-500/15 border border-cyan-300/40 soft-glow"
                    : "glass hover:border-cyan-300/30"
                }`}
                data-delay={i * 80}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold">{plan.name}</h3>
                  {plan.highlighted && (
                    <span className="text-xs px-2 py-1 rounded-full bg-cyan-400/20 text-cyan-200 border border-cyan-300/40">
                      Популярный
                    </span>
                  )}
                </div>
                <p className="text-3xl font-semibold mt-4">{plan.price}</p>
                <p className="text-slate-400 text-sm mt-1">{billing === "monthly" ? "в месяц" : "за 12 месяцев"}</p>
                <ul className="mt-5 space-y-3">
                  {plan.services.map((s) => (
                    <li key={s} className="flex items-start gap-2 text-slate-200 text-sm">
                      <CircleDollarSign size={16} className="text-cyan-300 mt-0.5 shrink-0" />
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => selectPlan(plan.name)}
                  className="mt-6 w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 transition"
                >
                  Выбрать план
                </button>
              </article>
            ))}
          </div>
        </section>

        <section id="faq" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="reveal text-center">
            <h2 className="text-3xl sm:text-4xl font-semibold">Частые вопросы</h2>
            <p className="mt-3 text-slate-300">Коротко о самом важном перед визитом.</p>
          </div>
          <div className="mt-8 space-y-3">
            {faqItems.map((item, i) => {
              const isOpen = openFaq === i;
              return (
                <article key={item.q} className="reveal glass rounded-xl overflow-hidden" data-delay={i * 80}>
                  <button
                    className="w-full px-5 py-4 flex items-center justify-between text-left"
                    onClick={() => setOpenFaq(isOpen ? null : i)}
                  >
                    <span className="font-medium">{item.q}</span>
                    <ChevronDown
                      size={18}
                      className={`transition-transform duration-300 ${isOpen ? "rotate-180 text-cyan-300" : ""}`}
                    />
                  </button>
                  <div
                    className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                      isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                    }`}
                  >
                    <div className="overflow-hidden">
                      <p className="px-5 pb-4 text-slate-300 text-sm leading-relaxed">{item.a}</p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 pb-16">
          <div className="reveal mb-6">
            <h2 className="text-3xl sm:text-4xl font-semibold">Связаться с клиникой</h2>
            <p className="mt-3 text-slate-300">Выберите нужный формат: быстрая запись в WhatsApp или консультация по email.</p>
          </div>

          {paymentBanner ? (
            <div
              className={`reveal mb-5 rounded-2xl border p-4 ${
                paymentBanner === "success"
                  ? "border-emerald-300/30 bg-emerald-500/10 text-emerald-100"
                  : "border-amber-300/30 bg-amber-500/10 text-amber-100"
              }`}
              role="status"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm">
                  {paymentBanner === "success"
                    ? "Оплата прошла успешно. Спасибо! Мы увидели оплату и свяжемся с вами для подтверждения записи."
                    : "Оплата отменена. Вы можете попробовать ещё раз или записаться через WhatsApp."}
                </div>
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-xl glass hover:bg-white/10 transition-colors text-sm"
                  onClick={() => setPaymentBanner(null)}
                >
                  Скрыть
                </button>
              </div>
            </div>
          ) : null}

          <div className="grid lg:grid-cols-2 gap-5">
            <section
              id="booking"
              className="reveal rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-emerald-600/20 via-emerald-500/10 to-cyan-500/10 border border-emerald-300/30"
            >
              <div className="inline-flex items-center text-xs text-emerald-200/90 bg-emerald-400/10 border border-emerald-300/25 rounded-full px-3 py-1">
                Онлайн-запись
              </div>
              <h3 className="mt-4 text-2xl font-semibold">Записаться онлайн</h3>
              <p className="mt-2 text-slate-200 text-sm">
                Отправим шаблон сообщения в WhatsApp на номер {siteConfig.phoneDisplay}. Подходит для записи на
                конкретную дату и время.
              </p>
              {selectedPlan && (
                <p className="mt-4 text-sm text-cyan-100/95 rounded-xl bg-black/20 border border-white/10 px-4 py-2 inline-block">
                  Выбран пакет: <span className="font-semibold text-white">{selectedPlan}</span>.
                </p>
              )}
              {selectedBookingDoctor && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-black/20 border border-white/10 px-4 py-3">
                  <div>
                    <p className="text-xs text-slate-400">Выбран врач</p>
                    <p className="text-sm font-semibold text-white">{selectedBookingDoctor.name}</p>
                    <p className="text-xs text-cyan-200/90">{selectedBookingDoctor.role}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setBookingDoctorId(null);
                      setBookError(null);
                      setBookDone(false);
                    }}
                    className="shrink-0 text-xs px-3 py-2 rounded-lg glass hover:bg-white/10 transition-colors text-slate-200"
                  >
                    Выбрать другого
                  </button>
                </div>
              )}
              <form className="mt-5 space-y-3" onSubmit={submitBooking} noValidate>
                <div>
                  <label htmlFor="booking-reason" className="block text-sm text-slate-200 mb-1.5">
                    Направление / терапия
                  </label>
                  <select
                    id="booking-reason"
                    value={bookingReason}
                    onChange={(ev) => {
                      setBookingReason(ev.target.value);
                      setBookError(null);
                      setBookDone(false);
                    }}
                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/15 outline-none focus:ring-2 focus:ring-emerald-300/40 text-white"
                  >
                    <option value="" className="bg-[#0a1320] text-slate-200">
                      Выберите направление
                    </option>
                    {BOOKING_REASONS.map((r) => (
                      <option key={r} value={r} className="bg-[#0a1320] text-slate-200">
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
                <label className="sr-only" htmlFor="booking-phone">
                  Телефон для записи
                </label>
                <input
                  id="booking-phone"
                  ref={bookInputRef}
                  type="tel"
                  name="phone"
                  autoComplete="tel"
                  value={bookPhone}
                  onChange={(ev) => {
                    setBookPhone(ev.target.value);
                    setBookError(null);
                    setBookDone(false);
                  }}
                  placeholder="+7 (747) 749-90-27"
                  className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/15 outline-none focus:ring-2 focus:ring-emerald-300/40 placeholder:text-slate-400"
                />
                <button
                  type="submit"
                  disabled={bookBusy}
                  className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-semibold hover:translate-y-[-1px] transition disabled:opacity-60 disabled:pointer-events-none"
                >
                  {bookBusy ? "Открываем WhatsApp..." : "Записаться через WhatsApp"}
                </button>
              </form>
              <button
                type="button"
                onClick={startOnlinePayment}
                disabled={payBusy}
                className="mt-3 w-full px-6 py-3 rounded-xl glass hover:bg-white/10 text-white font-semibold transition disabled:opacity-60 disabled:pointer-events-none"
              >
                {payBusy ? "Переходим к оплате..." : "Оплатить онлайн (депозит)"}
              </button>
              <p className="mt-2 text-xs text-slate-200/80">
                Депозит фиксированный. После оплаты мы свяжемся с вами для подтверждения времени приёма.
              </p>
              {bookError && (
                <p className="mt-3 text-sm text-rose-200" role="alert">
                  {bookError}
                </p>
              )}
              {payError && (
                <p className="mt-3 text-sm text-rose-200" role="alert">
                  {payError}
                </p>
              )}
              {bookDone && (
                <p className="mt-3 text-sm text-cyan-100" role="status">
                  Если чат не открылся, разрешите всплывающие окна или напишите в WhatsApp на {siteConfig.phoneDisplay}.
                </p>
              )}
            </section>

            <section
              id="consultation"
              className="reveal rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-blue-600/25 via-cyan-500/10 to-indigo-500/10 border border-cyan-300/25"
              data-delay="90"
            >
              <div className="inline-flex items-center text-xs text-cyan-100/90 bg-cyan-400/10 border border-cyan-300/25 rounded-full px-3 py-1">
                Первичная консультация
              </div>
              <h3 className="mt-4 text-2xl font-semibold">Получить консультацию</h3>
              <p className="mt-2 text-slate-200 text-sm">
                Откроем письмо на {siteConfig.email}. Укажите свой email для обратной связи.
              </p>
              <form className="mt-5 space-y-3" onSubmit={submitConsultation} noValidate>
                <label className="sr-only" htmlFor="consult-email">
                  Email для консультации
                </label>
                <input
                  id="consult-email"
                  ref={consultInputRef}
                  type="email"
                  name="email"
                  autoComplete="email"
                  value={consultEmail}
                  onChange={(ev) => {
                    setConsultEmail(ev.target.value);
                    setConsultError(null);
                    setConsultDone(false);
                  }}
                  placeholder="your@email.com"
                  className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/15 outline-none focus:ring-2 focus:ring-cyan-300/40 placeholder:text-slate-400"
                />
                <button
                  type="submit"
                  disabled={consultBusy}
                  className="w-full px-6 py-3 rounded-xl bg-white text-[#0a1320] font-semibold hover:translate-y-[-1px] transition disabled:opacity-60 disabled:pointer-events-none"
                >
                  {consultBusy ? "Открываем почту..." : "Получить консультацию по email"}
                </button>
              </form>
              {consultError && (
                <p className="mt-3 text-sm text-rose-200" role="alert">
                  {consultError}
                </p>
              )}
              {consultDone && (
                <p className="mt-3 text-sm text-cyan-100" role="status">
                  Если почта не открылась, напишите на {siteConfig.email} вручную.
                </p>
              )}
            </section>
          </div>
          <p className="mt-4 text-xs text-slate-300/80">
            Нажимая кнопку, вы соглашаетесь с обработкой персональных данных для связи по заявке.
          </p>
        </section>

        {currentAccount?.isAdmin && (
          <section id="admin" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="reveal rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-cyan-200/80">Только для администратора</p>
                  <h2 className="mt-2 text-3xl font-semibold">Админ-панель</h2>
                </div>
                <button
                  type="button"
                  onClick={loadAdminDashboard}
                  disabled={adminBusy || !authToken}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 font-medium disabled:opacity-60 disabled:pointer-events-none"
                >
                  {adminBusy ? "Загрузка..." : "Обновить данные"}
                </button>
              </div>

              <div className="mt-5 grid sm:grid-cols-[1fr_auto] gap-3">
                <input
                  type="text"
                  value={adminQuery}
                  onChange={(e) => setAdminQuery(e.target.value)}
                  placeholder="Поиск: телефон, email, имя, план..."
                  className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/15 outline-none focus:ring-2 focus:ring-cyan-300/40 placeholder:text-slate-400"
                />
                <div className="inline-flex rounded-xl glass p-1 text-sm">
                  <button
                    type="button"
                    onClick={() => {
                      setAdminTab("bookings");
                      setAdminStatusFilter("all");
                      setAdminSelected((prev) => ({ ...prev, bookings: {} }));
                    }}
                    className={`px-3 py-2 rounded-lg transition ${
                      adminTab === "bookings" ? "bg-white/15 text-white" : "text-slate-300"
                    }`}
                  >
                    Записи
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAdminTab("consultations");
                      setAdminStatusFilter("all");
                      setAdminSelected((prev) => ({ ...prev, consultations: {} }));
                    }}
                    className={`px-3 py-2 rounded-lg transition ${
                      adminTab === "consultations" ? "bg-white/15 text-white" : "text-slate-300"
                    }`}
                  >
                    Консультации
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAdminTab("users");
                      setAdminStatusFilter("all");
                      setAdminSelected((prev) => ({ ...prev, bookings: {}, consultations: {} }));
                    }}
                    className={`px-3 py-2 rounded-lg transition ${
                      adminTab === "users" ? "bg-white/15 text-white" : "text-slate-300"
                    }`}
                  >
                    Пользователи
                  </button>
                </div>
              </div>
              {adminData && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
                  <div className="flex flex-wrap items-center gap-2">
                    {adminTab !== "users" && (
                      <>
                        <button
                          type="button"
                          onClick={() => setAdminStatusFilter("all")}
                          className={`px-3 py-2 rounded-lg transition border ${
                            adminStatusFilter === "all"
                              ? "bg-white/15 text-white border-white/15"
                              : "glass hover:bg-white/10 border-white/10"
                          }`}
                        >
                          Все
                        </button>
                        {(["new", "in_progress", "done"] as const).map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setAdminStatusFilter(s)}
                            className={`px-3 py-2 rounded-lg transition border ${
                              adminStatusFilter === s
                                ? `border-white/15 ${statusPillClass(s)}`
                                : "glass hover:bg-white/10 border-white/10"
                            }`}
                          >
                            {statusLabel(s)}
                          </button>
                        ))}
                      </>
                    )}
                    {adminTab === "users" && (
                      <span className="inline-flex items-center gap-1 text-slate-300">
                        Подсказка: поиск работает по email/имени/роли
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="px-3 py-2 rounded-lg glass hover:bg-white/10 transition-colors"
                    onClick={() => {
                      if (!adminData) return;
                      const q = adminQuery.trim().toLowerCase();
                      if (adminTab === "users") {
                        const rows = adminData.users
                          .filter((u) => {
                            if (!q) return true;
                            return (
                              u.email.toLowerCase().includes(q) ||
                              u.name.toLowerCase().includes(q) ||
                              (u.isAdmin ? "admin" : "user").includes(q)
                            );
                          })
                          .map((u) => ({
                            id: u.id,
                            email: u.email,
                            name: u.name,
                            isAdmin: u.isAdmin ? 1 : 0,
                            createdAt: u.createdAt,
                          }));
                        downloadCsv(`msdent-users-${new Date().toISOString().slice(0, 10)}.csv`, rows);
                        return;
                      }
                      if (adminTab === "bookings") {
                        const rows = adminData.bookings
                          .filter((b) => bookingMatchesAdminQuery(b, adminQuery))
                          .filter((b) => (adminStatusFilter === "all" ? true : b.status === adminStatusFilter))
                          .map((b) => ({
                            id: b.id,
                            phone: `+${b.phone}`,
                            plan: b.plan ?? "",
                            doctorId: b.doctorId ?? "",
                            reason: b.reason ?? "",
                            status: b.status,
                            assignedTo: b.assignedTo ?? "",
                            note: b.note ?? "",
                            createdAt: b.createdAt,
                            updatedAt: b.updatedAt ?? "",
                          }));
                        downloadCsv(`msdent-bookings-${new Date().toISOString().slice(0, 10)}.csv`, rows);
                        return;
                      }
                      const rows = adminData.consultations
                        .filter((c) => {
                          if (!q) return true;
                          return (
                            c.email.toLowerCase().includes(q) ||
                            (c.status || "").toLowerCase().includes(q) ||
                            (c.note || "").toLowerCase().includes(q) ||
                            (c.assignedTo || "").toLowerCase().includes(q) ||
                            new Date(c.createdAt).toLocaleString().toLowerCase().includes(q)
                          );
                        })
                        .filter((c) => (adminStatusFilter === "all" ? true : c.status === adminStatusFilter))
                        .map((c) => ({
                          id: c.id,
                          email: c.email,
                          status: c.status,
                          assignedTo: c.assignedTo ?? "",
                          note: c.note ?? "",
                          createdAt: c.createdAt,
                          updatedAt: c.updatedAt ?? "",
                        }));
                      downloadCsv(`msdent-consultations-${new Date().toISOString().slice(0, 10)}.csv`, rows);
                    }}
                  >
                    Экспорт CSV (вкладка)
                  </button>
                </div>
              )}

              {!authToken && (
                <p className="mt-2 text-xs text-rose-200">
                  Нет токена сессии. Выйдите и войдите в аккаунт заново, чтобы получить токен.
                </p>
              )}
              {adminError && <p className="mt-3 text-sm text-rose-200">{adminError}</p>}

              {adminData && (
                <div className="mt-6 space-y-5">
                <div className="grid sm:grid-cols-3 gap-3">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs text-slate-300">Пользователи</p>
                    <p className="mt-1 text-2xl font-semibold">{adminData.stats.users}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs text-slate-300">Записи</p>
                    <p className="mt-1 text-2xl font-semibold">{adminData.stats.bookings}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs text-slate-300">Консультации</p>
                    <p className="mt-1 text-2xl font-semibold">{adminData.stats.consultations}</p>
                  </div>
                </div>

                  {adminTab === "users" && (
                    <div className="rounded-xl border border-white/10 overflow-hidden">
                      <div className="px-4 py-3 border-b border-white/10 font-medium">Пользователи</div>
                      <div className="max-h-80 overflow-auto text-sm">
                        {adminData.users.length === 0 ? (
                          <p className="px-4 py-3 text-slate-300">Пока нет пользователей.</p>
                        ) : (
                          [...adminData.users]
                            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                            .filter((u) => {
                              const q = adminQuery.trim().toLowerCase();
                              if (!q) return true;
                              return (
                                u.email.toLowerCase().includes(q) ||
                                u.name.toLowerCase().includes(q) ||
                                (u.isAdmin ? "admin" : "user").includes(q)
                              );
                            })
                            .map((user) => (
                              <div key={user.id} className="px-4 py-3 border-b border-white/5">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="font-medium">
                                      {user.name} {user.isAdmin && <span className="text-cyan-200/90">(admin)</span>}
                                    </p>
                                    <p className="text-slate-300">{user.email}</p>
                                    <p className="text-xs text-slate-400">
                                      Создан: {new Date(user.createdAt).toLocaleString()}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ))
                        )}
                      </div>
                    </div>
                  )}

                  {adminTab === "bookings" && (
                    <div className="rounded-xl border border-white/10 overflow-hidden">
                      <div className="px-4 py-3 border-b border-white/10 font-medium">Заявки на запись</div>
                      <div className="px-4 py-3 border-b border-white/10 bg-white/[0.02]">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <label className="inline-flex items-center gap-2 text-xs text-slate-300">
                            <input
                              type="checkbox"
                              checked={
                                adminData.bookings.filter((b) =>
                                  (adminStatusFilter === "all" ? true : b.status === adminStatusFilter)
                                ).length > 0 &&
                                adminData.bookings
                                  .filter((b) =>
                                    (adminStatusFilter === "all" ? true : b.status === adminStatusFilter)
                                  )
                                  .every((b) => Boolean(adminSelected.bookings[b.id]))
                              }
                              onChange={(e) => {
                                const checked = e.target.checked;
                                const visible = adminData.bookings
                                  .filter((b) => {
                                    if (!bookingMatchesAdminQuery(b, adminQuery)) return false;
                                    return adminStatusFilter === "all" ? true : b.status === adminStatusFilter;
                                  })
                                  .map((b) => b.id);
                                setAdminSelected((prev) => ({
                                  ...prev,
                                  bookings: checked
                                    ? visible.reduce((acc, id) => ({ ...acc, [id]: true }), { ...prev.bookings })
                                    : visible.reduce((acc, id) => {
                                        const next = { ...acc };
                                        delete next[id];
                                        return next;
                                      }, { ...prev.bookings }),
                                }));
                              }}
                            />
                            Выбрать видимые
                          </label>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              disabled={adminBulkBusy}
                              className="px-3 py-2 rounded-lg glass hover:bg-white/10 transition-colors text-xs disabled:opacity-60 disabled:pointer-events-none"
                              onClick={async () => {
                                if (!adminData) return;
                                const ids = Object.keys(adminSelected.bookings).filter((id) => adminSelected.bookings[id]);
                                if (ids.length === 0) return;
                                setAdminBulkBusy(true);
                                setAdminError(null);
                                try {
                                  for (const id of ids) {
                                    const res = await apiPatch<{ ok: boolean; booking: AdminBooking }>(
                                      `/api/admin/bookings/${id}`,
                                      { status: "in_progress" },
                                      { headers: { Authorization: `Bearer ${authToken}` } }
                                    );
                                    setAdminData((prev) =>
                                      prev
                                        ? { ...prev, bookings: prev.bookings.map((b) => (b.id === id ? res.booking : b)) }
                                        : prev
                                    );
                                  }
                                  setAdminSelected((prev) => ({ ...prev, bookings: {} }));
                                } catch (e) {
                                  setAdminError(e instanceof Error ? e.message : "Bulk-операция не удалась.");
                                } finally {
                                  setAdminBulkBusy(false);
                                }
                              }}
                            >
                              В работу
                            </button>
                            <button
                              type="button"
                              disabled={adminBulkBusy}
                              className="px-3 py-2 rounded-lg glass hover:bg-white/10 transition-colors text-xs disabled:opacity-60 disabled:pointer-events-none"
                              onClick={async () => {
                                if (!adminData) return;
                                const ids = Object.keys(adminSelected.bookings).filter((id) => adminSelected.bookings[id]);
                                if (ids.length === 0) return;
                                setAdminBulkBusy(true);
                                setAdminError(null);
                                try {
                                  for (const id of ids) {
                                    const res = await apiPatch<{ ok: boolean; booking: AdminBooking }>(
                                      `/api/admin/bookings/${id}`,
                                      { status: "done" },
                                      { headers: { Authorization: `Bearer ${authToken}` } }
                                    );
                                    setAdminData((prev) =>
                                      prev
                                        ? { ...prev, bookings: prev.bookings.map((b) => (b.id === id ? res.booking : b)) }
                                        : prev
                                    );
                                  }
                                  setAdminSelected((prev) => ({ ...prev, bookings: {} }));
                                } catch (e) {
                                  setAdminError(e instanceof Error ? e.message : "Bulk-операция не удалась.");
                                } finally {
                                  setAdminBulkBusy(false);
                                }
                              }}
                            >
                              Закрыть
                            </button>
                            <button
                              type="button"
                              disabled={adminBulkBusy}
                              className="px-3 py-2 rounded-lg bg-rose-500/80 hover:bg-rose-500 transition-colors text-xs font-semibold disabled:opacity-60 disabled:pointer-events-none"
                              onClick={async () => {
                                if (!adminData) return;
                                const ids = Object.keys(adminSelected.bookings).filter((id) => adminSelected.bookings[id]);
                                if (ids.length === 0) return;
                                setAdminBulkBusy(true);
                                setAdminError(null);
                                try {
                                  for (const id of ids) {
                                    await apiDelete<{ ok: boolean; removed: boolean }>(`/api/admin/bookings/${id}`, {
                                      headers: { Authorization: `Bearer ${authToken}` },
                                    });
                                    setAdminData((prev) =>
                                      prev
                                        ? {
                                            ...prev,
                                            stats: { ...prev.stats, bookings: Math.max(0, prev.stats.bookings - 1) },
                                            bookings: prev.bookings.filter((b) => b.id !== id),
                                          }
                                        : prev
                                    );
                                  }
                                  setAdminSelected((prev) => ({ ...prev, bookings: {} }));
                                } catch (e) {
                                  setAdminError(e instanceof Error ? e.message : "Bulk-операция не удалась.");
                                } finally {
                                  setAdminBulkBusy(false);
                                }
                              }}
                            >
                              Удалить
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="max-h-80 overflow-auto text-sm">
                        {adminData.bookings.length === 0 ? (
                          <p className="px-4 py-3 text-slate-300">Пока нет заявок.</p>
                        ) : (
                          [...adminData.bookings]
                            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                            .filter((b) => bookingMatchesAdminQuery(b, adminQuery))
                            .filter((b) => (adminStatusFilter === "all" ? true : b.status === adminStatusFilter))
                            .map((item) => {
                              const bookingDoctor = item.doctorId
                                ? doctors.find((d) => d.id === item.doctorId)
                                : undefined;
                              return (
                                <div key={item.id} className="px-4 py-3 border-b border-white/5">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="pt-1">
                                      <input
                                        type="checkbox"
                                        checked={Boolean(adminSelected.bookings[item.id])}
                                        onChange={(e) =>
                                          setAdminSelected((prev) => ({
                                            ...prev,
                                            bookings: { ...prev.bookings, [item.id]: e.target.checked },
                                          }))
                                        }
                                        aria-label="Выбрать заявку"
                                      />
                                    </div>
                                    <div>
                                      <div className="flex flex-wrap items-center gap-2">
                                        <p className="font-medium">+{item.phone}</p>
                                        <span
                                          className={`text-[11px] px-2 py-1 rounded-full border ${statusPillClass(
                                            item.status
                                          )}`}
                                        >
                                          {statusLabel(item.status)}
                                        </span>
                                      </div>
                                      <p className="text-slate-300">План: {item.plan || "Не указан"}</p>
                                      <p className="mt-1 text-slate-300">
                                        Направление:{" "}
                                        <span className="text-white/90">{item.reason?.trim() || "Не указано"}</span>
                                      </p>
                                      <p className="mt-1 text-slate-300">
                                        Врач:{" "}
                                        <span className="text-white/90">
                                          {bookingDoctor
                                            ? `${bookingDoctor.name} (${bookingDoctor.role})`
                                            : item.doctorId
                                              ? item.doctorId
                                              : "Не указан"}
                                        </span>
                                      </p>
                                      {item.assignedTo && (
                                        <p className="mt-1 text-xs text-slate-300">
                                          Менеджер: <span className="text-white/90">{item.assignedTo}</span>
                                        </p>
                                      )}
                                      {item.note && <p className="mt-1 text-xs text-slate-300">Заметка: {item.note}</p>}
                                      <p className="text-xs text-slate-400">
                                        Создана: {new Date(item.createdAt).toLocaleString()}
                                      </p>
                                    </div>
                                    <div className="flex flex-wrap items-center justify-end gap-2">
                                      <button
                                        type="button"
                                        onClick={() => void copyTextToClipboard(`+${item.phone}`)}
                                        className="px-3 py-2 rounded-lg glass hover:bg-white/10 transition-colors text-xs"
                                      >
                                        Копировать
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setAdminEdit({
                                            kind: "booking",
                                            id: item.id,
                                            title: `Заявка на запись +${item.phone}`,
                                            status: item.status,
                                            assignedTo: item.assignedTo || "",
                                            note: item.note || "",
                                          })
                                        }
                                        className="px-3 py-2 rounded-lg glass hover:bg-white/10 transition-colors text-xs"
                                      >
                                        Менеджер/статус
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setAdminConfirm({
                                            kind: "booking",
                                            id: item.id,
                                            title: `Удалить заявку на запись +${item.phone}?`,
                                            subtitle: item.plan ? `План: ${item.plan}` : undefined,
                                          })
                                        }
                                        className="px-3 py-2 rounded-lg glass hover:bg-white/10 transition-colors text-xs"
                                      >
                                        Удалить
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                        )}
                      </div>
                    </div>
                  )}

                  {adminTab === "consultations" && (
                    <div className="rounded-xl border border-white/10 overflow-hidden">
                      <div className="px-4 py-3 border-b border-white/10 font-medium">Заявки на консультацию</div>
                      <div className="px-4 py-3 border-b border-white/10 bg-white/[0.02]">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <label className="inline-flex items-center gap-2 text-xs text-slate-300">
                            <input
                              type="checkbox"
                              checked={
                                adminData.consultations.filter((c) =>
                                  (adminStatusFilter === "all" ? true : c.status === adminStatusFilter)
                                ).length > 0 &&
                                adminData.consultations
                                  .filter((c) =>
                                    (adminStatusFilter === "all" ? true : c.status === adminStatusFilter)
                                  )
                                  .every((c) => Boolean(adminSelected.consultations[c.id]))
                              }
                              onChange={(e) => {
                                const checked = e.target.checked;
                                const visible = adminData.consultations
                                  .filter((c) => {
                                    const q = adminQuery.trim().toLowerCase();
                                    if (q) {
                                      if (
                                        !(
                                          c.email.toLowerCase().includes(q) ||
                                          (c.status || "").toLowerCase().includes(q) ||
                                          (c.note || "").toLowerCase().includes(q) ||
                                          (c.assignedTo || "").toLowerCase().includes(q) ||
                                          new Date(c.createdAt).toLocaleString().toLowerCase().includes(q)
                                        )
                                      )
                                        return false;
                                    }
                                    return adminStatusFilter === "all" ? true : c.status === adminStatusFilter;
                                  })
                                  .map((c) => c.id);
                                setAdminSelected((prev) => ({
                                  ...prev,
                                  consultations: checked
                                    ? visible.reduce((acc, id) => ({ ...acc, [id]: true }), { ...prev.consultations })
                                    : visible.reduce((acc, id) => {
                                        const next = { ...acc };
                                        delete next[id];
                                        return next;
                                      }, { ...prev.consultations }),
                                }));
                              }}
                            />
                            Выбрать видимые
                          </label>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              disabled={adminBulkBusy}
                              className="px-3 py-2 rounded-lg glass hover:bg-white/10 transition-colors text-xs disabled:opacity-60 disabled:pointer-events-none"
                              onClick={async () => {
                                if (!adminData) return;
                                const ids = Object.keys(adminSelected.consultations).filter(
                                  (id) => adminSelected.consultations[id]
                                );
                                if (ids.length === 0) return;
                                setAdminBulkBusy(true);
                                setAdminError(null);
                                try {
                                  for (const id of ids) {
                                    const res = await apiPatch<{ ok: boolean; consultation: AdminConsultation }>(
                                      `/api/admin/consultations/${id}`,
                                      { status: "in_progress" },
                                      { headers: { Authorization: `Bearer ${authToken}` } }
                                    );
                                    setAdminData((prev) =>
                                      prev
                                        ? {
                                            ...prev,
                                            consultations: prev.consultations.map((c) =>
                                              c.id === id ? res.consultation : c
                                            ),
                                          }
                                        : prev
                                    );
                                  }
                                  setAdminSelected((prev) => ({ ...prev, consultations: {} }));
                                } catch (e) {
                                  setAdminError(e instanceof Error ? e.message : "Bulk-операция не удалась.");
                                } finally {
                                  setAdminBulkBusy(false);
                                }
                              }}
                            >
                              В работу
                            </button>
                            <button
                              type="button"
                              disabled={adminBulkBusy}
                              className="px-3 py-2 rounded-lg glass hover:bg-white/10 transition-colors text-xs disabled:opacity-60 disabled:pointer-events-none"
                              onClick={async () => {
                                if (!adminData) return;
                                const ids = Object.keys(adminSelected.consultations).filter(
                                  (id) => adminSelected.consultations[id]
                                );
                                if (ids.length === 0) return;
                                setAdminBulkBusy(true);
                                setAdminError(null);
                                try {
                                  for (const id of ids) {
                                    const res = await apiPatch<{ ok: boolean; consultation: AdminConsultation }>(
                                      `/api/admin/consultations/${id}`,
                                      { status: "done" },
                                      { headers: { Authorization: `Bearer ${authToken}` } }
                                    );
                                    setAdminData((prev) =>
                                      prev
                                        ? {
                                            ...prev,
                                            consultations: prev.consultations.map((c) =>
                                              c.id === id ? res.consultation : c
                                            ),
                                          }
                                        : prev
                                    );
                                  }
                                  setAdminSelected((prev) => ({ ...prev, consultations: {} }));
                                } catch (e) {
                                  setAdminError(e instanceof Error ? e.message : "Bulk-операция не удалась.");
                                } finally {
                                  setAdminBulkBusy(false);
                                }
                              }}
                            >
                              Закрыть
                            </button>
                            <button
                              type="button"
                              disabled={adminBulkBusy}
                              className="px-3 py-2 rounded-lg bg-rose-500/80 hover:bg-rose-500 transition-colors text-xs font-semibold disabled:opacity-60 disabled:pointer-events-none"
                              onClick={async () => {
                                if (!adminData) return;
                                const ids = Object.keys(adminSelected.consultations).filter(
                                  (id) => adminSelected.consultations[id]
                                );
                                if (ids.length === 0) return;
                                setAdminBulkBusy(true);
                                setAdminError(null);
                                try {
                                  for (const id of ids) {
                                    await apiDelete<{ ok: boolean; removed: boolean }>(`/api/admin/consultations/${id}`, {
                                      headers: { Authorization: `Bearer ${authToken}` },
                                    });
                                    setAdminData((prev) =>
                                      prev
                                        ? {
                                            ...prev,
                                            stats: {
                                              ...prev.stats,
                                              consultations: Math.max(0, prev.stats.consultations - 1),
                                            },
                                            consultations: prev.consultations.filter((c) => c.id !== id),
                                          }
                                        : prev
                                    );
                                  }
                                  setAdminSelected((prev) => ({ ...prev, consultations: {} }));
                                } catch (e) {
                                  setAdminError(e instanceof Error ? e.message : "Bulk-операция не удалась.");
                                } finally {
                                  setAdminBulkBusy(false);
                                }
                              }}
                            >
                              Удалить
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="max-h-80 overflow-auto text-sm">
                        {adminData.consultations.length === 0 ? (
                          <p className="px-4 py-3 text-slate-300">Пока нет заявок.</p>
                        ) : (
                          [...adminData.consultations]
                            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                            .filter((c) => {
                              const q = adminQuery.trim().toLowerCase();
                              if (!q) return true;
                              return (
                                c.email.toLowerCase().includes(q) ||
                                (c.status || "").toLowerCase().includes(q) ||
                                (c.note || "").toLowerCase().includes(q) ||
                                (c.assignedTo || "").toLowerCase().includes(q) ||
                                new Date(c.createdAt).toLocaleString().toLowerCase().includes(q)
                              );
                            })
                            .filter((c) => (adminStatusFilter === "all" ? true : c.status === adminStatusFilter))
                            .map((item) => (
                              <div key={item.id} className="px-4 py-3 border-b border-white/5">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="pt-1">
                                    <input
                                      type="checkbox"
                                      checked={Boolean(adminSelected.consultations[item.id])}
                                      onChange={(e) =>
                                        setAdminSelected((prev) => ({
                                          ...prev,
                                          consultations: { ...prev.consultations, [item.id]: e.target.checked },
                                        }))
                                      }
                                      aria-label="Выбрать заявку"
                                    />
                                  </div>
                                  <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <p className="font-medium">{item.email}</p>
                                      <span
                                        className={`text-[11px] px-2 py-1 rounded-full border ${statusPillClass(
                                          item.status
                                        )}`}
                                      >
                                        {statusLabel(item.status)}
                                      </span>
                                    </div>
                                    {item.assignedTo && (
                                      <p className="mt-1 text-xs text-slate-300">
                                        Менеджер: <span className="text-white/90">{item.assignedTo}</span>
                                      </p>
                                    )}
                                    {item.note && <p className="mt-1 text-xs text-slate-300">Заметка: {item.note}</p>}
                                    <p className="text-xs text-slate-400">
                                      Создана: {new Date(item.createdAt).toLocaleString()}
                                    </p>
                                  </div>
                                  <div className="flex flex-wrap items-center justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={() => void copyTextToClipboard(item.email)}
                                      className="px-3 py-2 rounded-lg glass hover:bg-white/10 transition-colors text-xs"
                                    >
                                      Копировать
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setAdminEdit({
                                          kind: "consultation",
                                          id: item.id,
                                          title: `Заявка на консультацию`,
                                          status: item.status,
                                          assignedTo: item.assignedTo || "",
                                          note: item.note || "",
                                        })
                                      }
                                      className="px-3 py-2 rounded-lg glass hover:bg-white/10 transition-colors text-xs"
                                    >
                                      Менеджер/статус
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setAdminConfirm({
                                          kind: "consultation",
                                          id: item.id,
                                          title: `Удалить заявку на консультацию?`,
                                          subtitle: item.email,
                                        })
                                      }
                                      className="px-3 py-2 rounded-lg glass hover:bg-white/10 transition-colors text-xs"
                                    >
                                      Удалить
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))
                        )}
                      </div>
                    </div>
                  )}
              </div>
            )}
            </div>
          </section>
        )}
      </main>

      {adminConfirm && (
        <div
          className="fixed inset-0 z-[80] bg-[#02030a]/75 backdrop-blur-sm flex items-center justify-center px-4"
          onClick={() => setAdminConfirm(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0b1020] p-6 sm:p-7 shadow-[0_20px_80px_rgba(0,0,0,.45)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-rose-200/80">Подтверждение</p>
                <h3 className="mt-2 text-xl font-semibold">{adminConfirm.title}</h3>
                {adminConfirm.subtitle && <p className="mt-2 text-sm text-slate-300">{adminConfirm.subtitle}</p>}
                <p className="mt-3 text-sm text-slate-400">Действие нельзя отменить.</p>
              </div>
              <button
                type="button"
                onClick={() => setAdminConfirm(null)}
                className="w-9 h-9 rounded-lg glass flex items-center justify-center"
                aria-label="Закрыть подтверждение"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setAdminConfirm(null)}
                className="px-4 py-3 rounded-xl glass hover:bg-white/10 transition-colors"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    if (adminConfirm.kind === "booking") {
                      await apiDelete<{ ok: boolean; removed: boolean }>(`/api/admin/bookings/${adminConfirm.id}`, {
                        headers: { Authorization: `Bearer ${authToken}` },
                      });
                      setAdminData((prev) =>
                        prev
                          ? {
                              ...prev,
                              stats: { ...prev.stats, bookings: Math.max(0, prev.stats.bookings - 1) },
                              bookings: prev.bookings.filter((b) => b.id !== adminConfirm.id),
                            }
                          : prev
                      );
                    } else {
                      await apiDelete<{ ok: boolean; removed: boolean }>(
                        `/api/admin/consultations/${adminConfirm.id}`,
                        { headers: { Authorization: `Bearer ${authToken}` } }
                      );
                      setAdminData((prev) =>
                        prev
                          ? {
                              ...prev,
                              stats: { ...prev.stats, consultations: Math.max(0, prev.stats.consultations - 1) },
                              consultations: prev.consultations.filter((c) => c.id !== adminConfirm.id),
                            }
                          : prev
                      );
                    }
                    setAdminConfirm(null);
                  } catch (e) {
                    setAdminError(e instanceof Error ? e.message : "Не удалось удалить запись.");
                    setAdminConfirm(null);
                  }
                }}
                className="px-4 py-3 rounded-xl bg-rose-500/90 hover:bg-rose-500 transition-colors font-semibold"
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}

      {adminEdit && (
        <div
          className="fixed inset-0 z-[80] bg-[#02030a]/75 backdrop-blur-sm flex items-center justify-center px-4"
          onClick={() => (adminEditBusy ? null : setAdminEdit(null))}
        >
          <div
            className="w-full max-w-xl rounded-3xl border border-white/10 bg-[#0b1020] p-6 sm:p-7 shadow-[0_20px_80px_rgba(0,0,0,.45)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-cyan-200/80">Редактирование</p>
                <h3 className="mt-2 text-xl font-semibold">{adminEdit.title}</h3>
                <p className="mt-2 text-sm text-slate-400">
                  Обновите статус и оставьте заметку для команды (видно только админам).
                </p>
              </div>
              <button
                type="button"
                onClick={() => (adminEditBusy ? null : setAdminEdit(null))}
                className="w-9 h-9 rounded-lg glass flex items-center justify-center"
                aria-label="Закрыть редактор"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-5 grid sm:grid-cols-[220px_1fr] gap-3 items-start">
              <div>
                <label className="block text-xs text-slate-400 mb-2" htmlFor="admin-status">
                  Статус
                </label>
                <select
                  id="admin-status"
                  value={adminEdit.status}
                  onChange={(e) =>
                    setAdminEdit((prev) => (prev ? { ...prev, status: e.target.value as AdminStatus } : prev))
                  }
                  className="w-full px-3 py-3 rounded-xl bg-white/10 border border-white/15 outline-none focus:ring-2 focus:ring-cyan-300/40 text-sm"
                >
                  <option value="new">Новая</option>
                  <option value="in_progress">В работе</option>
                  <option value="done">Закрыта</option>
                </select>
                <div className="mt-3">
                  <span className={`inline-flex text-[11px] px-2 py-1 rounded-full border ${statusPillClass(adminEdit.status)}`}>
                    {statusLabel(adminEdit.status)}
                  </span>
                </div>

                <label className="block text-xs text-slate-400 mb-2 mt-5" htmlFor="admin-assignee">
                  Менеджер
                </label>
                <input
                  id="admin-assignee"
                  value={adminEdit.assignedTo}
                  onChange={(e) => setAdminEdit((prev) => (prev ? { ...prev, assignedTo: e.target.value } : prev))}
                  placeholder="Например: Айжан"
                  className="w-full px-3 py-3 rounded-xl bg-white/10 border border-white/15 outline-none focus:ring-2 focus:ring-cyan-300/40 text-sm placeholder:text-slate-400"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-2" htmlFor="admin-note">
                  Заметка
                </label>
                <textarea
                  id="admin-note"
                  value={adminEdit.note}
                  onChange={(e) => setAdminEdit((prev) => (prev ? { ...prev, note: e.target.value } : prev))}
                  placeholder="Например: перезвонить завтра после 18:00, просил рассрочку, предпочитает терапевта X…"
                  rows={5}
                  className="w-full px-3 py-3 rounded-xl bg-white/10 border border-white/15 outline-none focus:ring-2 focus:ring-cyan-300/40 text-sm resize-y placeholder:text-slate-400"
                />
                <p className="mt-2 text-[11px] text-slate-400">До 2000 символов.</p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setAdminEdit(null)}
                disabled={adminEditBusy}
                className="px-4 py-3 rounded-xl glass hover:bg-white/10 transition-colors disabled:opacity-60 disabled:pointer-events-none"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={() => void saveAdminEdit()}
                disabled={adminEditBusy || !authToken}
                className="px-4 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 font-semibold disabled:opacity-60 disabled:pointer-events-none"
              >
                {adminEditBusy ? "Сохранение..." : "Сохранить"}
              </button>
            </div>
          </div>
        </div>
      )}

      {accountOpen && (
        <div
          className="fixed inset-0 z-[70] bg-[#02030a]/70 backdrop-blur-sm flex items-center justify-center px-4"
          onClick={() => setAccountOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0b1020] p-6 sm:p-7 shadow-[0_20px_80px_rgba(0,0,0,.45)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-cyan-200/80">
                  Личный кабинет
                </p>
                <h3 className="mt-2 text-2xl font-semibold">
                  {accountMode === "login" ? "Вход в аккаунт" : "Создать аккаунт"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setAccountOpen(false)}
                className="w-9 h-9 rounded-lg glass flex items-center justify-center"
                aria-label="Закрыть окно аккаунта"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-5 inline-flex rounded-xl glass p-1 text-sm">
              <button
                type="button"
                onClick={() => {
                  setAccountMode("login");
                  setAccountError(null);
                  setAccountSuccess(null);
                }}
                className={`px-4 py-2 rounded-lg transition ${
                  accountMode === "login" ? "bg-white/15 text-white" : "text-slate-300"
                }`}
              >
                Вход
              </button>
              <button
                type="button"
                onClick={() => {
                  setAccountMode("register");
                  setAccountError(null);
                  setAccountSuccess(null);
                }}
                className={`px-4 py-2 rounded-lg transition ${
                  accountMode === "register" ? "bg-white/15 text-white" : "text-slate-300"
                }`}
              >
                Регистрация
              </button>
            </div>

            <form className="mt-5 space-y-3" onSubmit={submitAccount} noValidate>
              {accountMode === "register" && (
                <input
                  type="text"
                  autoComplete="name"
                  value={accountName}
                  onChange={(e) => {
                    setAccountName(e.target.value);
                    setAccountError(null);
                    setAccountSuccess(null);
                  }}
                  placeholder="Ваше имя"
                  className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/15 outline-none focus:ring-2 focus:ring-cyan-300/40 placeholder:text-slate-400"
                />
              )}
              <input
                type="email"
                autoComplete="email"
                value={accountEmail}
                onChange={(e) => {
                  setAccountEmail(e.target.value);
                  setAccountError(null);
                  setAccountSuccess(null);
                }}
                placeholder="Email"
                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/15 outline-none focus:ring-2 focus:ring-cyan-300/40 placeholder:text-slate-400"
              />
              <input
                type="password"
                autoComplete={accountMode === "login" ? "current-password" : "new-password"}
                value={accountPassword}
                onChange={(e) => {
                  setAccountPassword(e.target.value);
                  setAccountError(null);
                  setAccountSuccess(null);
                }}
                placeholder="Пароль"
                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/15 outline-none focus:ring-2 focus:ring-cyan-300/40 placeholder:text-slate-400"
              />
              <button
                type="submit"
                disabled={accountBusy}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 font-semibold hover:scale-[1.01] transition-transform soft-glow disabled:opacity-60 disabled:pointer-events-none"
              >
                {accountBusy ? "Подождите..." : accountMode === "login" ? "Войти" : "Создать аккаунт"}
              </button>
            </form>
            {accountError && <p className="mt-3 text-sm text-rose-200">{accountError}</p>}
            {accountSuccess && <p className="mt-3 text-sm text-cyan-100">{accountSuccess}</p>}
          </div>
        </div>
      )}

      <footer className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center">
                  <Sparkles size={15} />
                </span>
                <span className="font-semibold text-lg">MsDent</span>
              </div>
              <p className="mt-3 text-sm text-slate-400">Премиальная стоматология в Астане.</p>
            </div>
            <div>
              <p className="font-medium mb-3">Навигация</p>
              <div className="space-y-2 text-sm text-slate-300">
                {navLinks.map((l) => (
                  <button key={l.id} onClick={() => scrollToId(l.id)} className="block hover:text-white">
                    {l.label}
                  </button>
                ))}
                <Link to="/doctors" className="block hover:text-white">
                  Врачи
                </Link>
              </div>
            </div>
            <div>
              <p className="font-medium mb-3">Контакты</p>
              <div className="space-y-2 text-sm text-slate-300">
                <a
                  href={siteConfig.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block hover:text-white underline-offset-2 hover:underline"
                >
                  {siteConfig.address}
                </a>
                <a href={telHref} className="block hover:text-white underline-offset-2 hover:underline">
                  {siteConfig.phoneDisplay}
                </a>
                <a href={mailHref} className="block hover:text-white underline-offset-2 hover:underline">
                  {siteConfig.email}
                </a>
              </div>
            </div>
            <div>
              <p className="font-medium mb-3">Соцсети</p>
              <div className="flex items-center gap-3">
                <a
                  href={siteConfig.telegramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-lg glass flex items-center justify-center hover:scale-105 transition-transform"
                  aria-label="Telegram"
                >
                  <Send size={16} />
                </a>
                <a
                  href={siteConfig.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-lg glass flex items-center justify-center hover:scale-105 transition-transform"
                  aria-label="Instagram"
                >
                  <Globe size={16} />
                </a>
              </div>
            </div>
          </div>
          <div className="mt-8 pt-5 border-t border-white/10 text-sm text-slate-400">
            © {new Date().getFullYear()} MsDent. Все права защищены.
          </div>
        </div>
      </footer>
    </div>
  );
}
