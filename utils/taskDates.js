// Calendar helpers for tasks. Recurring tasks are generated in the server's
// local time (set TZ=Asia/Karachi on the server so "18:00" means 6 PM PKT),
// the same convention as the CSR activity tracker (models/Activity.js).
const { dayKey } = require("../models/Activity");

const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

const isDayKey = (value) => {
	if (typeof value !== "string" || !DAY_KEY_RE.test(value)) return false;
	const [y, m, d] = value.split("-").map(Number);
	const date = new Date(y, m - 1, d);
	return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
};

// "YYYY-MM-DD" -> that day at hh:mm, server-local
const atTime = (key, hhmm = "00:00") => {
	const [y, m, d] = key.split("-").map(Number);
	const [hh, mm] = hhmm.split(":").map(Number);
	return new Date(y, m - 1, d, hh, mm, 0, 0);
};

const startOfDay = (date = new Date()) => {
	const d = new Date(date);
	d.setHours(0, 0, 0, 0);
	return d;
};

const addDays = (date, days) => {
	const d = new Date(date);
	d.setDate(d.getDate() + days);
	return d;
};

module.exports = { dayKey, isDayKey, atTime, startOfDay, addDays };
