const cron = require("node-cron");
const moment = require("moment");
const { Post } = require("../Schema/post.schema");
const { Notification } = require("../Schema/notification.schema");

cron.schedule("* * * * *", async () => {
  console.log("Running event reminder check...");

  const posts = await Post.find({
    postType: "event",
    eventTime: { $gte: moment().toDate() },
    reminderSent: { $ne: true }, // Make sure reminder hasn't been sent yet
  });

  for (const post of posts) {
    const eventTime = moment(post.eventTime);
    const now = moment();

    // Check if event is within 30 minutes but not already sent the reminder
    if (
      eventTime.diff(now, "minutes") <= 30 &&
      eventTime.diff(now, "minutes") > 0 &&
      !post.reminderSent
    ) {
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

        // Emit the notification for the user who saved the event
        io.emit("sendNotification", {
          message: savedUserNotification.message,
          userId: user._id,
        });
      }

      // Mark the reminder as sent
      post.reminderSent = true;
      await post.save();
    }
  }
});
