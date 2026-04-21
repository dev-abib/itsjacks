const cron = require("node-cron");
const { DateTime } = require("luxon");
const { Post } = require("../Schema/post.schema");
const { user } = require("../Schema/user.schema");
const { sendFirebaseNotification } = require("./fcmHelper");
const { Notification } = require("../Schema/notification.schema");

cron.schedule(
  "* * * * *",
  async () => {
    try {
      console.log("Cron running:", new Date().toISOString());

      const nowUTC = new Date();
      const nowPST = DateTime.fromJSDate(nowUTC).setZone("America/Los_Angeles");

      const reminders = [
        { label: "1 day", ms: 24 * 60 * 60 * 1000 },
        { label: "1 hour", ms: 60 * 60 * 1000 },
      ];

      // =========================
      // 🔹 RELATIVE REMINDERS
      // =========================
      const allEvents = await Post.find({ postType: "event" }).populate(
        "savedBy"
      );

      for (const event of allEvents) {
        const eventTime = new Date(event.eventTime);

        for (const reminder of reminders) {
          const targetTime = new Date(eventTime.getTime() - reminder.ms);

          const windowStart = new Date(targetTime.getTime() - 5 * 60 * 1000);
          const windowEnd = new Date(targetTime.getTime() + 5 * 60 * 1000);

          if (nowUTC < windowStart || nowUTC > windowEnd) continue;

          for (const savedUser of event.savedBy) {
            const exists = await Notification.findOne({
              user: savedUser._id,
              post: event._id,
              type: `event-reminder-${reminder.label}`,
            });

            if (exists) continue;

            await Notification.create({
              user: savedUser._id,
              message: `Reminder: Event "${event.description}" starts in ${reminder.label}`,
              type: `event-reminder-${reminder.label}`,
              post: event._id,
              reminderSent: true,
            });

            const savedUserData = await user.findById(savedUser._id);

            if (savedUserData?.fcmToken) {
              await sendFirebaseNotification(
                savedUserData.fcmToken,
                "Event Reminder",
                `Your saved event "${event.description}" starts in ${reminder.label}`,
                {
                  type: "event-reminder",
                  postId: event._id.toString(),
                }
              );
            }
          }
        }
      }

      // =========================
      // 🔹 8 AM PST DAILY REMINDER
      // =========================
      if (nowPST.hour === 8) {
        const startOfDayUTC = nowPST.startOf("day").toUTC().toJSDate();
        const endOfDayUTC = nowPST.endOf("day").toUTC().toJSDate();

        const todaysEvents = await Post.find({
          postType: "event",
          eventTime: {
            $gte: startOfDayUTC,
            $lte: endOfDayUTC,
          },
        }).populate("savedBy");

        for (const event of todaysEvents) {
          for (const savedUser of event.savedBy) {
            const exists = await Notification.findOne({
              user: savedUser._id,
              post: event._id,
              type: "event-reminder-8am",
            });

            if (exists) continue;

            await Notification.create({
              user: savedUser._id,
              message: `Reminder: Today's event "${event.description}" is happening`,
              type: "event-reminder-8am",
              post: event._id,
              reminderSent: true,
            });

            const savedUserData = await user.findById(savedUser._id);

            if (savedUserData?.fcmToken) {
              await sendFirebaseNotification(
                savedUserData.fcmToken,
                "Today's Events",
                `You have an event today: "${event.description}" in ${reminder.label}`,
                {
                  type: "event-reminder",
                  postId: event._id.toString(),
                }
              );
            }
          }
        }
      }
    } catch (err) {
      console.error("Cron Error:", err);
    }
  },
  {
    timezone: "UTC",
  }
);
