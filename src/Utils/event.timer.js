const cron = require("node-cron");
const moment = require("moment");
const { Post } = require("../Schema/post.schema");
const { Notification } = require("../Schema/notification.schema");
const { io } = require("../../app");



cron.schedule("* * * * *", async () => {

  try {
    // Fetch events that are yet to send reminders and are scheduled for the future
    const posts = await Post.find({
      postType: "event",
      eventTime: { $gte: moment().toDate() },
      reminderSent: { $ne: true },
    });

    for (const post of posts) {
      const eventTime = moment(post.eventTime);
      const now = moment();

      // Check if event is within 30 minutes but not already sent the reminder
      const timeDiff = eventTime.diff(now, "minutes");
      if (timeDiff <= 30 && timeDiff > 0 && !post.reminderSent) {
        // Notify the post owner (author)
        const postOwner = post.author;
        const authorNotification = new Notification({
          user: postOwner,
          message: `Event "${post.description}" is starting in 30 minutes!`,
          type: "event-reminder",
          post: post._id,
        });
        await authorNotification.save();

        // Emit the notification for the post owner (event organizer)
        io.emit("sendNotification", {
          message: authorNotification.message,
          userId: postOwner,
        });

        // Notify users who have saved the event
        for (const user of post.savedBy) {
          const savedUserNotification = new Notification({
            user: user._id,
            message: `The event "${post.description}" you saved is starting in 30 minutes!`,
            type: "event-reminder",
            post: post._id,
          });
          await savedUserNotification.save();

          io.emit("sendNotification", {
            message: savedUserNotification.message,
            userId: user._id,
          });
        }

        post.reminderSent = true;
        await post.save();
      }
    }
  } catch (error) {
    console.error("Error in cron job:", error);
  }
});
