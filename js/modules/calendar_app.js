
(function(){
    let viewDate = new Date();
    let selectedDate = toDateKey(new Date());
    let formOverrideDate = '';

    function ensureCalendarData() {
        if (!db.calendarData || typeof db.calendarData !== 'object') {
            db.calendarData = {
                cycleLength: 28,
                periodLength: 5,
                periodRecords: [],
                notes: {},
                selectedDate: ''
            };
        }
        if (!Array.isArray(db.calendarData.periodRecords)) db.calendarData.periodRecords = [];
        if (!db.calendarData.cycleLength) db.calendarData.cycleLength = 28;
        if (!db.calendarData.periodLength) db.calendarData.periodLength = 5;
        if (db.calendarData.selectedDate) selectedDate = db.calendarData.selectedDate;
    }

    const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    function pad(n){ return String(n).padStart(2,'0'); }
    function toDateKey(d){ return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
    function parseDate(key){
        if (!key) return null;
        const m = String(key).match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!m) return null;
        return new Date(Number(m[1]), Number(m[2])-1, Number(m[3]));
    }
    function addDays(d, n){ const x = new Date(d); x.setDate(x.getDate()+n); return x; }
    function diffDays(a,b){ return Math.round((stripTime(a)-stripTime(b))/(24*60*60*1000)); }
    function stripTime(d){ return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); }
    function fmt(key){
        const d = parseDate(key);
        if (!d) return '未记录';
        return `${d.getMonth()+1}月${d.getDate()}日`;
    }
    function escapeHtml(s){
        return String(s || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
    }

    function getOngoingEndDate(startDate) {
        const todayKey = toDateKey(new Date());
        if (!startDate) return todayKey;
        return startDate <= todayKey ? todayKey : startDate;
    }

    function getRecordDisplayEnd(record) {
        if (!record) return '';
        return record.endDate || getOngoingEndDate(record.startDate);
    }

    function isOngoingRecord(record) {
        return !!(record && record.startDate && !record.endDate);
    }

    async function saveCalendarDataOnly() {
        if (typeof saveGlobalSetting === 'function') {
            await saveGlobalSetting('calendarData');
        } else {
            await saveData();
        }
    }

    function getRecords() {
        ensureCalendarData();
        return db.calendarData.periodRecords
            .filter(r => r && r.startDate)
            .map(r => ({
                startDate: r.startDate,
                endDate: r.endDate || '',
                createdAt: r.createdAt || 0,
                updatedAt: r.updatedAt || 0
            }))
            .sort((a,b) => String(a.startDate).localeCompare(String(b.startDate)));
    }

    function isInRange(key, startKey, endKey) {
        return key >= startKey && key <= endKey;
    }

    function getLatestRecord() {
        const records = getRecords();
        return records.length ? records[records.length-1] : null;
    }

    function getPrediction() {
        ensureCalendarData();
        const latest = getLatestRecord();
        if (!latest) return null;
        const cycle = parseInt(db.calendarData.cycleLength, 10) || 28;
        const len = parseInt(db.calendarData.periodLength, 10) || 5;
        let nextStart = parseDate(latest.startDate);
        const today = new Date();
        do {
            nextStart = addDays(nextStart, cycle);
        } while (stripTime(nextStart) < stripTime(today));
        const nextEnd = addDays(nextStart, len - 1);
        const ovulation = addDays(nextStart, -14);
        const fertileStart = addDays(ovulation, -5);
        const fertileEnd = addDays(ovulation, 1);
        return {
            nextStart: toDateKey(nextStart),
            nextEnd: toDateKey(nextEnd),
            ovulation: toDateKey(ovulation),
            fertileStart: toDateKey(fertileStart),
            fertileEnd: toDateKey(fertileEnd)
        };
    }

    function getDayType(key) {
        const records = getRecords();
        if (records.some(r => isInRange(key, r.startDate, getRecordDisplayEnd(r)))) return 'period';
        const p = getPrediction();
        if (p) {
            if (isInRange(key, p.nextStart, p.nextEnd)) return 'predicted-period';
            if (key === p.ovulation) return 'ovulation';
            if (isInRange(key, p.fertileStart, p.fertileEnd)) return 'fertile';
        }
        return '';
    }

    function renderCalendarScreen() {
        ensureCalendarData();

        const grid = document.getElementById('calendar-grid');
        const title = document.getElementById('calendar-month-title');
        if (!grid || !title) return;

        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();
        title.textContent = `${MONTH_NAMES[month]} ${year}`;

        const first = new Date(year, month, 1);
        const startOffset = (first.getDay() + 6) % 7;
        const start = addDays(first, -startOffset);
        const todayKey = toDateKey(new Date());

        const cells = [];
        for (let i=0; i<42; i++) {
            const d = addDays(start, i);
            const key = toDateKey(d);
            const type = getDayType(key);
            const classes = ['calendar-day'];
            if (d.getMonth() !== month) classes.push('other-month');
            if (key === todayKey) classes.push('today');
            if (key === selectedDate) classes.push('selected');
            if (type) classes.push(type);
            cells.push(`<button type="button" class="${classes.join(' ')}" data-date="${key}"><span>${d.getDate()}</span></button>`);
        }
        grid.innerHTML = cells.join('');
        grid.querySelectorAll('.calendar-day').forEach(btn => {
            btn.addEventListener('click', () => {
                selectedDate = btn.dataset.date;
                db.calendarData.selectedDate = selectedDate;
                const startInput = document.getElementById('calendar-period-start');
                const endInput = document.getElementById('calendar-period-end');
                formOverrideDate = selectedDate;
                if (startInput) startInput.value = selectedDate;
                if (endInput) endInput.value = '';
                renderCalendarScreen();
            });
        });

        loadSettingsInputs();
        renderSummary();
    }

    function loadSettingsInputs() {
        const cycle = document.getElementById('calendar-cycle-length');
        const len = document.getElementById('calendar-period-length');
        if (cycle) cycle.value = db.calendarData.cycleLength || 28;
        if (len) len.value = db.calendarData.periodLength || 5;

        const startInput = document.getElementById('calendar-period-start');
        const endInput = document.getElementById('calendar-period-end');
        const latest = getLatestRecord();

        if (formOverrideDate) {
            if (startInput) startInput.value = formOverrideDate;
            if (endInput) endInput.value = '';
            formOverrideDate = '';
        } else if (latest) {
            if (startInput) startInput.value = latest.startDate || '';
            if (endInput) endInput.value = latest.endDate || '';
        } else {
            if (startInput && !startInput.value) startInput.value = selectedDate || toDateKey(new Date());
            if (endInput && !endInput.value) endInput.value = '';
        }
    }

    function renderSummary() {
        const el = document.getElementById('calendar-summary');
        if (!el) return;
        const latest = getLatestRecord();
        const p = getPrediction();
        let currentState = '暂无经期记录';
        if (latest) {
            const todayKey = toDateKey(new Date());
            if (isInRange(todayKey, latest.startDate, getRecordDisplayEnd(latest))) {
                const day = diffDays(new Date(), parseDate(latest.startDate)) + 1;
                currentState = isOngoingRecord(latest) ? `经期第 ${day} 天（进行中）` : `经期第 ${day} 天`;
            } else if (p) {
                const daysToNext = diffDays(parseDate(p.nextStart), new Date());
                if (daysToNext >= 0) currentState = `距下次预计经期 ${daysToNext} 天`;
            }
        }
        el.innerHTML = `
            <div class="calendar-summary-item"><div class="calendar-summary-label">当前状态</div><div class="calendar-summary-value">${escapeHtml(currentState)}</div></div>
            <div class="calendar-summary-item"><div class="calendar-summary-label">最近经期</div><div class="calendar-summary-value">${latest ? `${fmt(latest.startDate)} 至 ${isOngoingRecord(latest) ? '进行中' : fmt(latest.endDate)}` : '未记录'}</div></div>
            <div class="calendar-summary-item"><div class="calendar-summary-label">下次预计经期</div><div class="calendar-summary-value">${p ? `${fmt(p.nextStart)} 至 ${fmt(p.nextEnd)}` : '记录后生成'}</div></div>
            <div class="calendar-summary-item"><div class="calendar-summary-label">预计排卵/易孕期</div><div class="calendar-summary-value">${p ? `${fmt(p.ovulation)}；${fmt(p.fertileStart)} 至 ${fmt(p.fertileEnd)}` : '记录后生成'}</div></div>
        `;
    }

    async function savePeriodRecord() {
        ensureCalendarData();
        const start = document.getElementById('calendar-period-start')?.value || '';
        let end = document.getElementById('calendar-period-end')?.value || '';
        const cycle = parseInt(document.getElementById('calendar-cycle-length')?.value, 10);
        const len = parseInt(document.getElementById('calendar-period-length')?.value, 10);
        if (!start) {
            showToast('先选经期开始日期');
            return;
        }
        if (end && end < start) end = start;
        db.calendarData.cycleLength = (!isNaN(cycle) && cycle >= 15 && cycle <= 60) ? cycle : 28;
        db.calendarData.periodLength = (!isNaN(len) && len >= 1 && len <= 15) ? len : 5;

        const existing = db.calendarData.periodRecords.find(r => r.startDate === start);
        if (existing) {
            existing.endDate = end;
            existing.updatedAt = Date.now();
        } else {
            db.calendarData.periodRecords.push({ startDate: start, endDate: end, createdAt: Date.now() });
        }
        selectedDate = start;
        db.calendarData.selectedDate = selectedDate;
        await saveCalendarDataOnly();
        showToast(end ? '经期记录已保存' : '经期开始已记录，结束日期可以之后补');
        renderCalendarScreen();
    }

    async function deleteLastPeriod() {
        ensureCalendarData();
        const records = getRecords();
        if (!records.length) {
            showToast('还没有经期记录');
            return;
        }
        const last = records[records.length-1];
        db.calendarData.periodRecords = db.calendarData.periodRecords.filter(r => r.startDate !== last.startDate);
        await saveCalendarDataOnly();
        showToast('已删除最近一次经期记录');
        renderCalendarScreen();
    }

    function bindCalendarEvents() {
        document.getElementById('calendar-prev-month')?.addEventListener('click', () => {
            viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth()-1, 1);
            renderCalendarScreen();
        });
        document.getElementById('calendar-next-month')?.addEventListener('click', () => {
            viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth()+1, 1);
            renderCalendarScreen();
        });
        document.getElementById('calendar-save-period-btn')?.addEventListener('click', savePeriodRecord);
        document.getElementById('calendar-delete-last-period-btn')?.addEventListener('click', deleteLastPeriod);

        document.addEventListener('click', (e) => {
            const target = e.target && e.target.closest && e.target.closest('[data-target="calendar-screen"]');
            if (target) setTimeout(renderCalendarScreen, 30);
        }, true);
    }

    function setupCalendarApp() {
        ensureCalendarData();
        bindCalendarEvents();
        renderCalendarScreen();
    }

    window.setupCalendarApp = setupCalendarApp;
    window.renderCalendarScreen = renderCalendarScreen;

    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(setupCalendarApp, 100);
    });
})();
