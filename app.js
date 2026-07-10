(function () {
  "use strict";

  var STORAGE_TODOS = "ctd_todos_v1";
  var STORAGE_SPACE = "ctd_space_id";
  var WEEKDAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

  var firebaseConfig = {
    apiKey: "AIzaSyCdxCUdwfLPB7Z3JxaEA04X47yhm8Gdy-4",
    authDomain: "calendar-dbc4b.firebaseapp.com",
    projectId: "calendar-dbc4b",
    storageBucket: "calendar-dbc4b.firebasestorage.app",
    messagingSenderId: "782006257809",
    appId: "1:782006257809:web:3881a20b8d16abbf605730",
  };
  firebase.initializeApp(firebaseConfig);
  var auth = firebase.auth();
  var db = firebase.firestore();
  var unsubscribeSpace = null;

  function spaceTodosRef() {
    return db.collection("spaces").doc(state.spaceId).collection("todos");
  }

  function generateSpaceCode() {
    var chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    var code = "";
    for (var i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }
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
    spaceId: localStorage.getItem(STORAGE_SPACE) || null,
    year: new Date().getFullYear(),
    month: new Date().getMonth(), // 0-indexed
    selectedDate: null,
  };

  // ---------- storage ----------
  function loadTodos() {
    if (localStorage.getItem(STORAGE_SPACE)) return [];
    try {
      var raw = localStorage.getItem(STORAGE_TODOS);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function save() {
    if (state.spaceId) return;
    localStorage.setItem(STORAGE_TODOS, JSON.stringify(state.todos));
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

  function formatTime12h(hhmm) {
    var parts = hhmm.split(":").map(Number);
    var h = parts[0];
    var m = parts[1];
    var period = h < 12 ? "오전" : "오후";
    var h12 = h % 12;
    if (h12 === 0) h12 = 12;
    return period + " " + h12 + ":" + pad(m);
  }

  function to24Hour(period, hour12, minute) {
    var h = parseInt(hour12, 10) % 12;
    if (period === "PM") h += 12;
    return pad(h) + ":" + minute;
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
    return state.todos
      .filter(function (t) {
        return todoOccursOn(t, dateStr);
      })
      .slice()
      .sort(function (a, b) {
        if (!a.time && !b.time) return 0;
        if (!a.time) return -1;
        if (!b.time) return 1;
        return a.time < b.time ? -1 : a.time > b.time ? 1 : 0;
      });
  }

  // ---------- DOM refs ----------
  var monthLabel = document.getElementById("monthLabel");
  var grid = document.getElementById("calendarGrid");
  var prevBtn = document.getElementById("prevMonth");
  var nextBtn = document.getElementById("nextMonth");

  var shareBtn = document.getElementById("shareBtn");
  var shareBtnLabel = document.getElementById("shareBtnLabel");
  var sharePanel = document.getElementById("sharePanel");
  var shareStatusText = document.getElementById("shareStatusText");
  var shareSoloView = document.getElementById("shareSoloView");
  var shareActiveView = document.getElementById("shareActiveView");
  var createSpaceBtn = document.getElementById("createSpaceBtn");
  var joinCodeInput = document.getElementById("joinCodeInput");
  var joinSpaceBtn = document.getElementById("joinSpaceBtn");
  var shareCodeText = document.getElementById("shareCodeText");
  var copyCodeBtn = document.getElementById("copyCodeBtn");
  var leaveSpaceBtn = document.getElementById("leaveSpaceBtn");

  function updateShareUI() {
    if (state.spaceId) {
      shareBtnLabel.textContent = "공유 중";
      shareBtn.classList.add("active");
      shareStatusText.textContent = "이 코드를 아는 사람과 일정을 함께 봐요.";
      shareSoloView.hidden = true;
      shareActiveView.hidden = false;
      shareCodeText.textContent = state.spaceId;
    } else {
      shareBtnLabel.textContent = "공유 안 함";
      shareBtn.classList.remove("active");
      shareStatusText.textContent = "코드를 만들거나 입력해서 다른 사람과 일정을 공유하세요.";
      shareSoloView.hidden = false;
      shareActiveView.hidden = true;
    }
  }

  function stopSpaceSync() {
    if (unsubscribeSpace) {
      unsubscribeSpace();
      unsubscribeSpace = null;
    }
  }

  function startSpaceSync() {
    stopSpaceSync();
    if (!state.spaceId) return;
    unsubscribeSpace = spaceTodosRef().onSnapshot(
      function (snap) {
        state.todos = snap.docs.map(function (d) {
          return Object.assign({ id: d.id }, d.data());
        });
        renderCalendar();
        if (panel.classList.contains("open")) renderTodoList();
      },
      function (err) {
        console.error("space sync error", err);
      }
    );
  }

  function enterSpace(code) {
    state.spaceId = code;
    localStorage.setItem(STORAGE_SPACE, code);
    state.todos = [];
    updateShareUI();
    startSpaceSync();
    renderCalendar();
  }

  shareBtn.addEventListener("click", function () {
    sharePanel.hidden = !sharePanel.hidden;
  });

  createSpaceBtn.addEventListener("click", function () {
    enterSpace(generateSpaceCode());
    sharePanel.hidden = true;
  });

  joinSpaceBtn.addEventListener("click", function () {
    var code = joinCodeInput.value.trim().toUpperCase();
    if (!code) return;
    joinCodeInput.value = "";
    enterSpace(code);
    sharePanel.hidden = true;
  });

  joinCodeInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      joinSpaceBtn.click();
    }
  });

  copyCodeBtn.addEventListener("click", function () {
    if (navigator.clipboard) navigator.clipboard.writeText(state.spaceId);
  });

  leaveSpaceBtn.addEventListener("click", function () {
    stopSpaceSync();
    state.spaceId = null;
    localStorage.removeItem(STORAGE_SPACE);
    state.todos = loadTodos();
    updateShareUI();
    renderCalendar();
    sharePanel.hidden = true;
  });

  var overlay = document.getElementById("overlay");
  var panel = document.getElementById("panel");
  var panelDate = document.getElementById("panelDate");
  var closePanelBtn = document.getElementById("closePanel");
  var addBtn = document.getElementById("addBtn");
  var todoInput = document.getElementById("todoInput");
  var periodSelect = document.getElementById("periodSelect");
  var hourSelect = document.getElementById("hourSelect");
  var minuteSelect = document.getElementById("minuteSelect");
  var repeatSelectWrap = document.getElementById("repeatSelectWrap");
  var repeatDropdownBtn = document.getElementById("repeatDropdownBtn");
  var repeatDropdownLabel = document.getElementById("repeatDropdownLabel");
  var repeatMenu = document.getElementById("repeatMenu");
  var repeatMenuItems = document.querySelectorAll(".repeat-menu-item");
  var selectedRepeat = "none";
  var todoList = document.getElementById("todoList");
  var emptyMsg = document.getElementById("emptyMsg");
  var colorSwatches = document.querySelectorAll(".color-swatch");
  var selectedColor = "";

  var COLOR_VAR = {
    red: "var(--color-rose)",
    green: "var(--color-green)",
  };

  colorSwatches.forEach(function (btn) {
    btn.addEventListener("click", function () {
      selectedColor = btn.dataset.color;
      colorSwatches.forEach(function (b) {
        b.classList.toggle("active", b === btn);
      });
    });
  });

  var COLOR_OPTIONS = [
    { value: "", label: "기본" },
    { value: "red", label: "빨강" },
    { value: "green", label: "초록" },
  ];

  var hiddenDotEl = null;

  function closeColorPopover() {
    var existing = document.querySelector(".color-popover");
    if (existing) existing.remove();
    if (hiddenDotEl) {
      hiddenDotEl.style.visibility = "";
      hiddenDotEl = null;
    }
  }

  function openColorPopover(todo, anchorEl) {
    var already = document.querySelector(".color-popover");
    var wasOpenForThis = already && already.dataset.todoId === todo.id;
    closeColorPopover();
    if (wasOpenForThis) return;

    var pop = document.createElement("div");
    pop.className = "color-popover";
    pop.dataset.todoId = todo.id;

    var currentColor = todo.color || "";
    COLOR_OPTIONS.forEach(function (opt) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "color-swatch" + (opt.value === currentColor ? " active" : "");
      b.dataset.color = opt.value;
      b.setAttribute("aria-label", opt.label);
      var swatchDot = document.createElement("span");
      swatchDot.className = "swatch-dot";
      b.appendChild(swatchDot);
      b.addEventListener("click", function (e) {
        e.stopPropagation();
        var newColor = opt.value || null;
        closeColorPopover();
        if (state.spaceId) {
          spaceTodosRef().doc(todo.id).update({ color: newColor });
        } else {
          todo.color = newColor;
          save();
          renderTodoList();
          renderCalendar();
        }
      });
      pop.appendChild(b);
    });

    document.body.appendChild(pop);
    var rect = anchorEl.getBoundingClientRect();
    pop.style.top = rect.top + rect.height / 2 + "px";
    pop.style.right = window.innerWidth - rect.right + "px";

    anchorEl.style.visibility = "hidden";
    hiddenDotEl = anchorEl;
  }

  document.addEventListener("click", function (e) {
    if (!e.target.closest(".color-popover")) {
      closeColorPopover();
    }
  });

  function closeRepeatMenu() {
    repeatMenu.hidden = true;
    repeatDropdownBtn.setAttribute("aria-expanded", "false");
  }

  repeatDropdownBtn.addEventListener("click", function () {
    var willOpen = repeatMenu.hidden;
    repeatMenu.hidden = !willOpen;
    repeatDropdownBtn.setAttribute("aria-expanded", willOpen ? "true" : "false");
  });

  repeatMenuItems.forEach(function (item) {
    item.addEventListener("click", function () {
      selectedRepeat = item.dataset.value;
      repeatDropdownLabel.textContent = item.textContent;
      repeatMenuItems.forEach(function (i) {
        i.classList.toggle("active", i === item);
      });
      closeRepeatMenu();
    });
  });

  document.addEventListener("click", function (e) {
    if (!repeatMenu.hidden && !repeatSelectWrap.contains(e.target)) {
      closeRepeatMenu();
    }
  });

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
        var chip = document.createElement("div");
        chip.className = "event-chip";
        chip.textContent = (t.time ? t.time + " " : "") + t.text;
        if (t.color && COLOR_VAR[t.color]) {
          chip.style.setProperty("--accent-text", COLOR_VAR[t.color]);
          chip.style.setProperty("--accent-bg", "color-mix(in srgb, " + COLOR_VAR[t.color] + " 18%, var(--color-surface))");
        }
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
  function resetAddFields() {
    todoInput.value = "";
    periodSelect.value = "AM";
    hourSelect.value = "";
    minuteSelect.value = "";
    selectedRepeat = "none";
    repeatMenuItems.forEach(function (i) {
      i.classList.toggle("active", i.dataset.value === "none");
    });
    repeatDropdownLabel.textContent = "오늘";
    closeRepeatMenu();
    selectedColor = "";
    colorSwatches.forEach(function (b) {
      b.classList.toggle("active", b.dataset.color === "");
    });
  }

  function openPanel(dateStr) {
    state.selectedDate = dateStr;
    var d = parseYMD(dateStr);
    panelDate.textContent = (d.getMonth() + 1) + "월 " + d.getDate() + "일 (" + WEEKDAY_NAMES[d.getDay()] + ")";
    resetAddFields();
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
    closeColorPopover();
    var dateStr = state.selectedDate;
    var items = todosForDate(dateStr);
    todoList.innerHTML = "";
    emptyMsg.hidden = items.length > 0;
    var highlightEl = null;

    items.forEach(function (t) {
      var li = document.createElement("li");
      li.className = "todo-item";
      if (t.id === highlightId) highlightEl = li;

      var dot = document.createElement("span");
      dot.className = "todo-color-dot";
      dot.style.background = t.color && COLOR_VAR[t.color] ? COLOR_VAR[t.color] : "var(--color-indigo)";
      li.appendChild(dot);

      li.addEventListener("click", function (e) {
        e.stopPropagation();
        openColorPopover(t, dot);
      });

      if (t.time) {
        var timeLabel = document.createElement("span");
        timeLabel.className = "time-label";
        timeLabel.textContent = formatTime12h(t.time);
        li.appendChild(timeLabel);
      }

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
      delBtn.addEventListener("click", function (e) {
        e.stopPropagation();
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

  function deleteTodo(todo) {
    if (todo.repeat !== "none") {
      var ok = confirm("모든 반복 일정을 삭제할까요?");
      if (!ok) return;
    }
    if (state.spaceId) {
      spaceTodosRef().doc(todo.id).delete();
      return;
    }
    state.todos = state.todos.filter(function (t) {
      return t.id !== todo.id;
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
    var hasTime = !!hourSelect.value;
    var minuteVal = minuteSelect.value || "00";
    var todoData = {
      text: text,
      date: state.selectedDate,
      repeat: selectedRepeat,
      time: hasTime ? to24Hour(periodSelect.value, hourSelect.value, minuteVal) : null,
      color: selectedColor || null,
    };
    if (state.spaceId) {
      spaceTodosRef()
        .add(todoData)
        .then(function (ref) {
          resetAddFields();
          renderTodoList(ref.id);
          todoInput.focus();
        });
      return;
    }
    todoData.id = genId();
    state.todos.push(todoData);
    save();
    resetAddFields();
    renderTodoList(todoData.id);
    todoInput.focus();
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

  var swipeStartX = null;
  var swipeStartY = null;
  var swipeHorizontal = false;
  var swipePointerId = null;

  grid.addEventListener("pointerdown", function (e) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    swipePointerId = e.pointerId;
    swipeStartX = e.clientX;
    swipeStartY = e.clientY;
    swipeHorizontal = false;
  });

  grid.addEventListener(
    "pointermove",
    function (e) {
      if (swipeStartX === null || e.pointerId !== swipePointerId) return;
      var dx = e.clientX - swipeStartX;
      var dy = e.clientY - swipeStartY;
      if (!swipeHorizontal && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
        swipeHorizontal = true;
        try {
          grid.setPointerCapture(swipePointerId);
        } catch (err) {}
      }
      if (swipeHorizontal && e.cancelable) e.preventDefault();
    },
    { passive: false }
  );

  function endSwipe(e) {
    if (swipeStartX === null || e.pointerId !== swipePointerId) return;
    var dx = e.clientX - swipeStartX;
    var dy = e.clientY - swipeStartY;
    swipeStartX = null;
    swipeStartY = null;
    swipePointerId = null;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return;
    if (dx < 0) {
      nextBtn.click();
    } else {
      prevBtn.click();
    }
  }

  grid.addEventListener("pointerup", endSwipe);
  grid.addEventListener("pointercancel", endSwipe);

  var wheelCooldown = false;
  grid.addEventListener(
    "wheel",
    function (e) {
      if (Math.abs(e.deltaX) < 20 || Math.abs(e.deltaX) < Math.abs(e.deltaY)) return;
      e.preventDefault();
      if (wheelCooldown) return;
      wheelCooldown = true;
      setTimeout(function () {
        wheelCooldown = false;
      }, 500);
      if (e.deltaX < 0) {
        prevBtn.click();
      } else {
        nextBtn.click();
      }
    },
    { passive: false }
  );

  updateShareUI();
  renderCalendar();

  auth.onAuthStateChanged(function (user) {
    if (!user) {
      auth.signInAnonymously().catch(function (err) {
        console.error("anonymous sign-in failed", err);
      });
      return;
    }
    if (state.spaceId) startSpaceSync();
  });

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
