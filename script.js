// Расписание 27 группы (Лечебное дело №1, 4 курс).
// Внутренний ID группы на kgma.kg — 79. Выбор группы не нужен, он зашит.
'use strict';

document.addEventListener("DOMContentLoaded", function () {

  const GROUP_ID = 79;
  const GROUP_NAME = "27 группа";
  const PROXY = "https://ksma-schedule.itismynickname9.workers.dev";
  const PROXY_FALLBACK = "https://ksma-schedule.vercel.app/api/proxy";
  const WEATHER_URL = "https://api.open-meteo.com/v1/forecast"
    + "?latitude=42.875&longitude=74.5"
    + "&hourly=temperature_2m,precipitation,snowfall,cloudcover"
    + "&past_days=7&forecast_days=14"
    + "&timezone=Asia/Bishkek";

  const CACHE_DAYS = 7;

  const currWeekEl = document.getElementById("CurrWeek");
  const nextWeekEl = document.getElementById("NextWeek");
  const cur = document.getElementById("cur");
  const next = document.getElementById("next");

  // ---------- утилиты ----------
  function getMonday(d) {
    d = new Date(d);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  }

  function formatDate(d) {
    const m = d.getMonth() + 1, day = d.getDate();
    return `${d.getFullYear()}-${m < 10 ? "0" + m : m}-${day < 10 ? "0" + day : day}`;
  }

  function isoDate(d) {
    const m = d.getMonth() + 1, day = d.getDate();
    return `${d.getFullYear()}-${m < 10 ? "0" + m : m}-${day < 10 ? "0" + day : day}`;
  }

  function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function saveCache(name, data) {
    try {
      localStorage.setItem(name, JSON.stringify(data));
    } catch (e) {
      console.warn("[cache] не удалось сохранить", name, e);
    }
  }

  function loadCache(name) {
    try {
      const raw = localStorage.getItem(name);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.warn("[cache] битый кэш", name, e);
      return null;
    }
  }

  // ---------- загрузка недели ----------
  async function fetchSchedule(dateStr) {
    const key = `schedule_${GROUP_ID}_${dateStr}`;
    const urls = [
      `${PROXY}/proxy/${GROUP_ID}/${dateStr}/get`,
      `${PROXY_FALLBACK}/${GROUP_ID}/${dateStr}/get`
    ];

    for (const url of urls) {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const data = await res.json();
        saveCache(key, data);
        return { data, source: "online" };
      } catch (err) {
        console.warn("[net] не удалось:", url, err.message);
      }
    }

    const cached = loadCache(key);
    if (cached) {
      console.info("[cache] расписание показано из кэша:", dateStr);
      return { data: cached, source: "offline" };
    }
    return { data: null, source: "error" };
  }

  function renderWeek(dateStr, container, weekId) {
    return fetchSchedule(dateStr).then(({ data, source }) => {
      const label = document.getElementById(weekId === "CurrWeek" ? "week" : "week-next");
      // Чистим только прошлый рендер, заголовок недели не трогаем
      container.querySelectorAll(".schedule__table, .s27-src, .s27-err")
        .forEach(node => node.remove());

      if (!data) {
        if (label) label.textContent = "";
        container.insertAdjacentHTML("beforeend", "<p class='s27-err'>Не удалось загрузить расписание</p>");
        return;
      }

      const dates = Object.keys(data)
        .map(k => data[k] && data[k].d)
        .filter(Boolean)
        .sort();
      if (label && dates.length) {
        const a = new Date(dates[0]);
        const b = new Date(dates[dates.length - 1]);
        const fmt = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" });
        label.textContent = dates.length
          ? `${fmt.format(a)} — ${fmt.format(b)}`
          : "";
      }

      const table = document.createElement("ul");
      table.className = "schedule__table";

      for (const dayKey of Object.keys(data)) {
        const day = data[dayKey];
        if (!day || !day.d || !day.l) continue;
        const dateObj = new Date(day.d);
        if (isNaN(dateObj)) continue;

        const lessons = Object.keys(day.l)
          .map(k => day.l[k])
          .filter(l => l && l.tm);

        if (!lessons.length) continue;

        const liDay = document.createElement("li");
        liDay.className = "schedule__day";
        liDay.dataset.date = isoDate(dateObj);

        const dateSpan = document.createElement("span");
        dateSpan.className = "schedule__date";
        dateSpan.innerHTML =
          `<b>${dateObj.toLocaleDateString("ru-RU", { weekday: "short" })}</b>` +
          `<i>${dateObj.getDate()}</i>` +
          `<em>${dateObj.toLocaleDateString("ru-RU", { month: "long" })}</em>`;
        liDay.appendChild(dateSpan);

        const lessonsUl = document.createElement("ul");
        lessonsUl.className = "schedule__lessons";

        for (const lesson of lessons) {
          const li = document.createElement("li");
          li.className = "lesson";

          const time = document.createElement("div");
          time.className = "lesson__time";
          const startHour = parseInt(String(lesson.tm).split("-")[0], 10);
          if (!isNaN(startHour)) time.dataset.hour = String(startHour);
          time.innerHTML = `<b>${lesson.tm}</b><span class="lesson__weather"></span>`;
          li.appendChild(time);

          const params = document.createElement("div");
          params.className = "lesson__params";

          const name = document.createElement("span");
          name.className = "lesson__name";
          name.textContent = capitalizeFirst(lesson.d || "");
          params.appendChild(name);

          const type = document.createElement("span");
          type.className = "lesson__type";
          type.textContent = lesson.t || "";
          params.appendChild(type);

          if (lesson.r) {
            const room = document.createElement("span");
            room.className = "lesson__place";
            room.innerHTML = `<i class="icon-marker"></i>${lesson.r}`;
            params.appendChild(room);
          }

          li.appendChild(params);
          lessonsUl.appendChild(li);
        }

        liDay.appendChild(lessonsUl);
        table.appendChild(liDay);
      }

      container.appendChild(table);

      const statusP = document.createElement("p");
      statusP.className = "s27-src";
      statusP.innerHTML = `источник: <b class="${source}">${source === "online" ? "kgma.kg" : "кэш"}</b>`;
      container.appendChild(statusP);

      attachWeather(container);
    });
  }

  // ---------- погода под каждой парой ----------
  async function attachWeather(container) {
    const slots = container.querySelectorAll(".lesson__weather");
    if (!slots.length) return;
    try {
      const res = await fetch(WEATHER_URL);
      const w = await res.json();
      const hours = w.hourly && w.hourly.time;
      if (!hours) return;

      slots.forEach(slot => {
        const date = slot.closest(".lesson").closest(".schedule__day").dataset.date;
        const hour = slot.closest(".lesson").querySelector(".lesson__time").dataset.hour;
        if (!date || !hour) return;

        const idx = hours.findIndex(t => t.startsWith(`${date}T${hour.padStart(2, "0")}:`));
        if (idx === -1) return;

        const temp = Math.round(w.hourly.temperature_2m[idx]);
        const precip = w.hourly.precipitation[idx];
        const snow = w.hourly.snowfall[idx];
        const cloud = w.hourly.cloudcover[idx];

        let icon = "☀️";
        if (snow > 0.1) icon = "❄️";
        else if (precip > 0.1) icon = "🌧";
        else if (cloud >= 85) icon = "☁️";
        else if (cloud >= 40) icon = "⛅";
        else if (cloud >= 20) icon = "🌤";

        slot.textContent = `${icon} ${temp}°`;
        slot.title = `${temp}°C, облачность ${cloud}%, осадки ${precip} мм`;
      });
    } catch (e) {
      console.warn("[weather] не удалось:", e.message);
    }
  }

  // ---------- переключение недель ----------
  function showWeek(which) {
    const isCur = which === "CurrWeek";
    currWeekEl.style.display = isCur ? "block" : "none";
    nextWeekEl.style.display = isCur ? "none" : "block";
    cur.style.backgroundColor = isCur ? "#27a8e7dd" : "#bbdd";
    next.style.backgroundColor = isCur ? "#bbdd" : "#27a8e7dd";
  }

  cur.onclick = () => showWeek("CurrWeek");
  next.onclick = () => showWeek("NextWeek");

  // ---------- старт ----------
  (async function init() {
    document.title = `Расписание · ${GROUP_NAME}`;
    const monday = getMonday(new Date());
    const nextMonday = new Date(monday);
    nextMonday.setDate(nextMonday.getDate() + 7);

    document.querySelector(".week-tb").style.display = "table";
    showWeek("CurrWeek");

    await renderWeek(formatDate(monday), currWeekEl, "CurrWeek");
    await renderWeek(formatDate(nextMonday), nextWeekEl, "NextWeek");
  })();

});