// Institute workflows a task can belong to. Each one comes with a ready-made
// checklist that is copied onto new tasks of that category (the admin can
// edit the copy per task). "general" is for anything else.
const TASK_WORKFLOWS = [
	{
		key: "general",
		label: "General",
		checklist: [],
	},
	{
		key: "attendance_reporting",
		label: "Attendance Reporting",
		checklist: [
			"Collect attendance from every class",
			"Mark absentees and late arrivals",
			"Update the attendance sheet / LMS",
			"Share the report with management",
		],
	},
	{
		key: "recordings",
		label: "Recordings",
		checklist: [
			"Download the class recording",
			"Check audio and video quality",
			"Upload to the LMS / drive",
			"Share the link with the batch",
		],
	},
	{
		key: "certificates",
		label: "Certificates",
		checklist: [
			"Verify the eligible student list",
			"Prepare and proofread certificates",
			"Print and get them signed",
			"Deliver / hand over to students",
		],
	},
	{
		key: "student_cards",
		label: "Student Cards",
		checklist: [
			"Collect student photos and details",
			"Design and proofread the cards",
			"Print the cards",
			"Distribute to students",
		],
	},
	{
		key: "admissions_followup",
		label: "Admissions Follow-up",
		checklist: [
			"Call the pending admissions",
			"Confirm documents and fee status",
			"Update admission records",
			"Report confirmed admissions",
		],
	},
	{
		key: "events",
		label: "Events",
		checklist: [
			"Finalise date, venue and agenda",
			"Arrange logistics and equipment",
			"Send invitations / announcements",
			"Run the event and share a summary",
		],
	},
];

const WORKFLOW_KEYS = TASK_WORKFLOWS.map((w) => w.key);

const workflowByKey = (key) => TASK_WORKFLOWS.find((w) => w.key === key) || TASK_WORKFLOWS[0];

module.exports = { TASK_WORKFLOWS, WORKFLOW_KEYS, workflowByKey };
