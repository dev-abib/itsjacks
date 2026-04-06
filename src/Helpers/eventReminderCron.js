const cron = require("node-cron");
const { Post } = require("../Schema/post.schema");
const { user } = require("../Schema/user.schema");
const { sendFirebaseNotification } = require("./fcmHelper");
const { Notification } = require("../Schema/notification.schema");

cron.schedule("* * * * *", async () => {
  try {
    console.log("Cron running at:", new Date().toISOString());

    const now = new Date();

    const reminders = [
      { label: "1 hour", offset: 60 * 60 * 1000 },
      { label: "30 minutes", offset: 30 * 60 * 1000 },
      { label: "15 minutes", offset: 15 * 60 * 1000 },
    ];

    for (const reminder of reminders) {
      const targetTime = new Date(now.getTime() + reminder.offset);

      const windowStart = new Date(targetTime.getTime() - 5 * 60 * 1000);
      const windowEnd = new Date(targetTime.getTime() + 5 * 60 * 1000);

      const events = await Post.find({
        postType: "event",
        eventTime: {
          $gte: windowStart,
          $lte: windowEnd,
        },
      }).populate("savedBy");

      for (const event of events) {
        for (const savedUser of event.savedBy) {
          const alreadySent = await Notification.findOne({
            user: savedUser._id,
            post: event._id,
            type: `event-reminder-${reminder.label}`,
          });

          if (alreadySent) continue;

          const notification = new Notification({
            user: savedUser._id,
            message: `Reminder: Event "${event.description}" starts in ${reminder.label}`,
            type: `event-reminder-${reminder.label}`,
            post: event._id,
            reminderSent: true,
          });

          await notification.save();

          const savedUserData = await user.findById(savedUser._id);

          console.log("Sending to:", savedUserData?.fcmToken);

          if (savedUserData?.fcmToken) {
            await sendFirebaseNotification(
              savedUserData.fcmToken,
              "Event Reminder",
              `Your saved event "${event.description}" starts in ${reminder.label}`,
              { type: "event-reminder", postId: event._id }
            );
          }
        }
      }
    }
  } catch (err) {
    console.error("Error in cron:", err);
  }
});


