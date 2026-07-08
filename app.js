(function () {
  "use strict";

  var STORAGE_TODOS = "ctd_todos_v1";
  var STORAGE_COMPLETIONS = "ctd_completions_v1";
  var WEEKDAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];
  var REPEAT_LABEL = { daily: "매일", weekday: "평일", weekly: "매주", monthly: "매월" };

  // 대한민국 법정 공휴일 (대체공휴일 포함). 음력 기반 명절 날짜는 매년 바뀌므로
  // 확인된 연도(2025년 하반기~2027년)만 하드코딩되어 있음.
  var HOLIDAYS = {
    "2025-06-06": "현충일",
    "2025-08-15": "광복절",
    "2025-10-03": "개천절",
    "2025-10-05": "추석",
    "2025-10-06": "추석",
    "2025-10-07": "추석",
    "2025-10-08": "대체공휴일",
    "2025-10-09": "한글날",
    "2025-12-25": "크리스마스",

    "2026-01-01": "신정",
    "2026-02-16": "설날",
    "2026-02-17": "설날",
    "2026-02-18": "설날",
    "2026-03-01": "삼일절",
    "2026-03-02": "대체공휴일",
    "2026-05-05": "어린이날",
    "2026-05-24": "부처님오신날",
    "2026-05-25": "대체공휴일",
    "2026-06-06": "현충일",
    "2026-07-17": "제헌절",
    "2026-08-15": "광복절",
    "2026-08-17": "대체공휴일",
    "2026-09-24": "추석",
    "2026-09-25": "추석",
    "2026-09-26": "추석",
    "2026-10-03": "개천절",
    "2026-10-05": "대체공휴일",
    "2026-10-09": "한글날",
    "2026-12-25": "크리스마스",

    "2027-01-01": "신정",
    "2027-02-06": "설날",
    "2027-02-07": "설날",
    "2027-02-08": "설날",
    "2027-02-09": "대체공휴일",
    "2027-03-01": "삼일절",
    "2027-05-05": "어린이날",
    "2027-05-13": "부처님오신날",
    "2027-06-06": "현충일",
    "2027-06-07": "대체공휴일",
    "2027-07-17": "제헌절",
    "2027-07-19": "대체공휴일",
    "2027-08-15": "광복절",
    "2027-08-16": "대체공휴일",
    "2027-09-14": "추석",
    "2027-09-15": "추석",
    "2027-09-16": "추석",
    "2027-10-03": "개천절",
    "2027-10-04": "대체공휴일",
    "2027-10-09": "한글날",
    "2027-10-11": "대체공휴일",
    "2027-12-25": "크리스마스",
    "2027-12-27": "대체공휴일",
  };

  var state = {
    todos: loadTodos(),
    completions: loadCompletions(),
    year: new Date().getFullYear(),
    month: new Date().getMonth(), // 0-indexed
    selectedDate: null,
  };

  // ---------- storage ----------
  function loadTodos() {
    try {
      var raw = localStorage.getItem(STORAGE_TODOS);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function loadCompletions() {
    try {
      var raw = localStorage.getItem(STORAGE_COMPLETIONS);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function save() {
    localStorage.setItem(STORAGE_TODOS, JSON.stringify(state.todos));
    localStorage.setItem(STORAGE_COMPLETIONS, JSON.stringify(state.completions));
  }

  // ---------- date helpers ----------
  function pad(n) {
    return n < 10 ? "0" + n : "" + n;
  }

  function formatDate(y, m0, d) {
    return y + "-" + pad(m0 + 1) + "-" + pad(d);
  }

  function formatDateObj(dateObj) {
    return formatDate(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
  }

  function parseYMD(str) {
    var parts = str.split("-").map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function daysBetween(startStr, endStr) {
    var a = parseYMD(startStr);
    var b = parseYMD(endStr);
    var utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
    var utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
    return Math.round((utcB - utcA) / 86400000);
  }

  function monthlyTargetDay(startStr, dateStr) {
    var s = startStr.split("-").map(Number);
    var d = dateStr.split("-").map(Number);
    var lastDayOfDateMonth = new Date(d[0], d[1], 0).getDate();
    return Math.min(s[2], lastDayOfDateMonth);
  }

  function todoOccursOn(todo, dateStr) {
    if (dateStr < todo.date) return false;
    switch (todo.repeat) {
      case "none":
        return dateStr === todo.date;
      case "daily":
        return true;
      case "weekday":
        var wd = parseYMD(dateStr).getDay();
        return wd !== 0 && wd !== 6;
      case "weekly":
        return daysBetween(todo.date, dateStr) % 7 === 0;
      case "monthly":
        var d = dateStr.split("-").map(Number);
        return d[2] === monthlyTargetDay(todo.date, dateStr);
      default:
        return false;
    }
  }

  function todosForDate(dateStr) {
    return state.todos.filter(function (t) {
      return todoOccursOn(t, dateStr);
    });
  }

  // ---------- DOM refs ----------
  var monthLabel = document.getElementById("monthLabel");
  var grid = document.getElementById("calendarGrid");
  var prevBtn = document.getElementById("prevMonth");
  var nextBtn = document.getElementById("nextMonth");

  var overlay = document.getElementById("overlay");
  var panel = document.getElementById("panel");
  var panelDate = document.getElementById("panelDate");
  var closePanelBtn = document.getElementById("closePanel");
  var addToggleBtn = document.getElementById("addToggleBtn");
  var addFields = document.getElementById("addFields");
  var addBtn = document.getElementById("addBtn");
  var todoInput = document.getElementById("todoInput");
  var repeatSelect = document.getElementById("repeatSelect");
  var todoList = document.getElementById("todoList");
  var emptyMsg = document.getElementById("emptyMsg");

  // ---------- calendar rendering ----------
  function renderCalendar() {
    var y = state.year;
    var m = state.month;
    monthLabel.textContent = y + "년 " + (m + 1) + "월";

    var firstDay = new Date(y, m, 1);
    var startOffset = firstDay.getDay();
    var daysInMonth = new Date(y, m + 1, 0).getDate();
    var daysInPrevMonth = new Date(y, m, 0).getDate();
    var todayStr = formatDateObj(new Date());

    grid.innerHTML = "";

    for (var i = 0; i < 42; i++) {
      var cellY = y,
        cellM0 = m,
        cellD,
        otherMonth = false;

      if (i < startOffset) {
        cellD = daysInPrevMonth - startOffset + 1 + i;
        cellM0 = m - 1;
        if (cellM0 < 0) {
          cellM0 = 11;
          cellY = y - 1;
        }
        otherMonth = true;
      } else if (i >= startOffset + daysInMonth) {
        cellD = i - (startOffset + daysInMonth) + 1;
        cellM0 = m + 1;
        if (cellM0 > 11) {
          cellM0 = 0;
          cellY = y + 1;
        }
        otherMonth = true;
      } else {
        cellD = i - startOffset + 1;
      }

      var dateStr = formatDate(cellY, cellM0, cellD);
      var col = i % 7;

      var holidayName = HOLIDAYS[dateStr];

      var cell = document.createElement("div");
      cell.className = "cell";
      if (otherMonth) cell.classList.add("other-month");
      if (dateStr === todayStr) cell.classList.add("today");
      if (col === 0) cell.classList.add("col-sun");
      if (col === 6) cell.classList.add("col-sat");
      if (holidayName) cell.classList.add("holiday");

      var dayNum = document.createElement("div");
      dayNum.className = "day-num";
      dayNum.textContent = cellD;
      cell.appendChild(dayNum);

      if (holidayName) {
        var holidayLabel = document.createElement("div");
        holidayLabel.className = "holiday-label";
        holidayLabel.textContent = holidayName;
        cell.appendChild(holidayLabel);
      }

      var eventsWrap = document.createElement("div");
      eventsWrap.className = "cell-events";
      var dayTodos = todosForDate(dateStr);
      var MAX_VISIBLE = 3;

      dayTodos.slice(0, MAX_VISIBLE).forEach(function (t) {
        var key = t.id + "__" + dateStr;
        var chip = document.createElement("div");
        chip.className = "event-chip" + (state.completions[key] ? " event-done" : "");
        chip.textContent = t.text;
        eventsWrap.appendChild(chip);
      });

      if (dayTodos.length > MAX_VISIBLE) {
        var more = document.createElement("div");
        more.className = "event-more";
        more.textContent = "+" + (dayTodos.length - MAX_VISIBLE) + "개 더";
        eventsWrap.appendChild(more);
      }
      cell.appendChild(eventsWrap);

      (function (ds) {
        cell.addEventListener("click", function () {
          openPanel(ds);
        });
      })(dateStr);

      grid.appendChild(cell);
    }
  }

  // ---------- panel ----------
  function collapseAddFields() {
    addFields.classList.remove("expanded");
    addToggleBtn.classList.remove("active");
    addToggleBtn.setAttribute("aria-expanded", "false");
    todoInput.value = "";
    repeatSelect.value = "none";
  }

  function expandAddFields() {
    addFields.classList.add("expanded");
    addToggleBtn.classList.add("active");
    addToggleBtn.setAttribute("aria-expanded", "true");
    todoInput.focus();
  }

  addToggleBtn.addEventListener("click", function () {
    if (addFields.classList.contains("expanded")) {
      collapseAddFields();
    } else {
      expandAddFields();
    }
  });

  function openPanel(dateStr) {
    state.selectedDate = dateStr;
    var d = parseYMD(dateStr);
    panelDate.textContent = (d.getMonth() + 1) + "월 " + d.getDate() + "일 (" + WEEKDAY_NAMES[d.getDay()] + ")";
    collapseAddFields();
    renderTodoList();
    overlay.classList.add("open");
    panel.classList.add("open");
    document.body.classList.add("no-scroll");
  }

  function closePanel() {
    overlay.classList.remove("open");
    panel.classList.remove("open");
    document.body.classList.remove("no-scroll");
  }

  function renderTodoList(highlightId) {
    var dateStr = state.selectedDate;
    var items = todosForDate(dateStr);
    todoList.innerHTML = "";
    emptyMsg.hidden = items.length > 0;
    var highlightEl = null;

    items.forEach(function (t) {
      var key = t.id + "__" + dateStr;
      var done = !!state.completions[key];

      var li = document.createElement("li");
      li.className = "todo-item" + (done ? " done" : "");
      if (t.id === highlightId) highlightEl = li;

      var check = document.createElement("input");
      check.type = "checkbox";
      check.className = "check";
      check.checked = done;
      check.addEventListener("change", function () {
        toggleCompletion(key);
      });
      li.appendChild(check);

      var text = document.createElement("span");
      text.className = "text";
      text.textContent = t.text;
      li.appendChild(text);

      if (t.repeat !== "none") {
        var badge = document.createElement("span");
        badge.className = "repeat-badge";
        badge.textContent = REPEAT_LABEL[t.repeat];
        li.appendChild(badge);
      }

      var delBtn = document.createElement("button");
      delBtn.className = "delete-btn";
      delBtn.type = "button";
      delBtn.setAttribute("aria-label", "삭제");
      delBtn.textContent = "✕";
      delBtn.addEventListener("click", function () {
        deleteTodo(t);
      });
      li.appendChild(delBtn);

      todoList.appendChild(li);
    });

    renderCalendar();

    if (highlightEl) {
      highlightEl.classList.add("just-added");
      highlightEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
      setTimeout(function () {
        highlightEl.classList.remove("just-added");
      }, 900);
    }
  }

  function toggleCompletion(key) {
    if (state.completions[key]) {
      delete state.completions[key];
    } else {
      state.completions[key] = true;
    }
    save();
    renderTodoList();
  }

  function deleteTodo(todo) {
    if (todo.repeat !== "none") {
      var ok = confirm("모든 반복 일정을 삭제할까요?");
      if (!ok) return;
    }
    state.todos = state.todos.filter(function (t) {
      return t.id !== todo.id;
    });
    var prefix = todo.id + "__";
    Object.keys(state.completions).forEach(function (k) {
      if (k.indexOf(prefix) === 0) delete state.completions[k];
    });
    save();
    renderTodoList();
  }

  function genId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function addTodo() {
    var text = todoInput.value.trim();
    if (!text || !state.selectedDate) return;
    var id = genId();
    state.todos.push({
      id: id,
      text: text,
      date: state.selectedDate,
      repeat: repeatSelect.value,
    });
    save();
    collapseAddFields();
    renderTodoList(id);
  }

  addBtn.addEventListener("click", addTodo);
  todoInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      addTodo();
    }
  });

  closePanelBtn.addEventListener("click", closePanel);
  overlay.addEventListener("click", closePanel);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && panel.classList.contains("open")) closePanel();
  });

  prevBtn.addEventListener("click", function () {
    state.month--;
    if (state.month < 0) {
      state.month = 11;
      state.year--;
    }
    renderCalendar();
  });

  nextBtn.addEventListener("click", function () {
    state.month++;
    if (state.month > 11) {
      state.month = 0;
      state.year++;
    }
    renderCalendar();
  });

  renderCalendar();

  // ---------- service worker (https / localhost only) ----------
  if (
    "serviceWorker" in navigator &&
    (location.protocol === "https:" || location.hostname === "localhost")
  ) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    });
  }
})();
