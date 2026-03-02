const cron = require("node-cron");
const mongoose = require("mongoose");
const { Post } = require("../Schema/post.schema");
const { user } = require("../Schema/user.schema");
const { sendFirebaseNotification } = require("./fcmHelper");
const { Notification } = require("../Schema/notification.schema");


// This function runs every minute to check upcoming events
cron.schedule("* * * * *", async () => {
  try {
    const now = new Date();

    const reminders = [
      { label: "1 hour", offset: 60 * 60 * 1000 },
      { label: "30 minutes", offset: 30 * 60 * 1000 },
      { label: "15 minutes", offset: 15 * 60 * 1000 },
    ];

    for (const reminder of reminders) {
      const targetTime = new Date(now.getTime() + reminder.offset);

      // Find events that are starting at targetTime and the reminder hasn't been sent
      const events = await Post.find({
        postType: "event",
        eventTime: {
          $gte: new Date(targetTime.getTime() - 60000), 
          $lte: new Date(targetTime.getTime() + 60000),
        },
      }).populate("savedBy");

      for (const event of events) {
        for (const savedUser of event.savedBy) {
          // Check if we've already sent this reminder for this user
          const alreadySent = await Notification.findOne({
            user: savedUser._id,
            post: event._id,
            type: `event-reminder-${reminder.label}`,
          });

          if (alreadySent) continue;

          // Create notification in DB
          const notification = new Notification({
            user: savedUser._id,
            message: `Reminder: Event "${event.description}" starts in ${reminder.label}`,
            type: `event-reminder-${reminder.label}`,
            post: event._id,
            reminderSent: true,
          });

          await notification.save();

          // Send push via Firebase
          const savedUserData = await user.findById(savedUser._id);
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
    console.error("Error in event reminder cron job:", err);
  }
});
