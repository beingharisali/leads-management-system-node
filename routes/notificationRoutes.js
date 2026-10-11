const express = require("express");
const router = express.Router();

const { auth } = require("../middleware/authentication");
const { getMyNotifications, markRead, markAllRead } = require("../controllers/notifications");

// Every signed-in user only ever sees their own notifications
router.get("/", auth, getMyNotifications);
router.patch("/read-all", auth, markAllRead);
router.patch("/:id/read", auth, markRead);

module.exports = router;
