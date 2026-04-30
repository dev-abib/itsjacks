const cron = require("node-cron");
const { DateTime } = require("luxon");
const { Post } = require("../Schema/post.schema");
const { user } = require("../Schema/user.schema");
const { sendFirebaseNotification } = require("./fcmHelper");
const { Notification } = require("../Schema/notification.schema");

// Store last run time (fallback protection)
let lastRunTime = new Date();

cron.schedule(
  "* * * * *",
  async () => {
    try {
      const nowUTC = new Date();
      console.log("Cron running at:", nowUTC.toISOString());

      // fallback window (in case cron was delayed)
      const safeStart = new Date(lastRunTime.getTime() - 15 * 60 * 1000);
      const safeEnd = new Date(nowUTC.getTime() + 15 * 60 * 1000);

      lastRunTime = nowUTC;

      const reminders = [
        { label: "1 day", ms: 24 * 60 * 60 * 1000 },
        { label: "1 hour", ms: 60 * 60 * 1000 },
      ];

      // Fetch events in safe range
      const events = await Post.find({
        postType: "event",
        eventTime: {
          $gte: new Date(safeStart.getTime() + reminders[1].ms),
          $lte: new Date(safeEnd.getTime() + reminders[0].ms),
        },
      }).populate("savedBy");

      for (const event of events) {
        const eventTime = new Date(event.eventTime);

        for (const reminder of reminders) {
          const targetTime = new Date(eventTime.getTime() - reminder.ms);

          // robust check (no strict window dependency)
          const isDue = targetTime >= safeStart && targetTime <= safeEnd;

          if (!isDue) continue;

          console.log(
            `Reminder triggered: ${reminder.label} for event ${event._id}`
          );

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
      // 🔹 8 AM PST DAILY REMINDER (FIXED)
      // =========================
      const nowPST = DateTime.fromJSDate(nowUTC).setZone("America/Los_Angeles");

      if (nowPST.hour === 8 && nowPST.minute < 2) {
        console.log("Running 8AM PST job");

        const startOfDayUTC = nowPST.startOf("day").toUTC().toJSDate();
        const endOfDayUTC = nowPST
          .plus({ days: 1 })
          .startOf("day")
          .toUTC()
          .toJSDate();

        const todaysEvents = await Post.find({
          postType: "event",
          eventTime: {
            $gte: startOfDayUTC,
            $lt: endOfDayUTC,
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
              message: `Reminder: Today's event "${event.description}" is happening today!`,
              type: "event-reminder-8am",
              post: event._id,
              reminderSent: true,
            });

            const savedUserData = await user.findById(savedUser._id);

            if (savedUserData?.fcmToken) {
              await sendFirebaseNotification(
                savedUserData.fcmToken,
                "Today's Events 🎉",
                `You have a saved event today: "${event.description}"`,
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
