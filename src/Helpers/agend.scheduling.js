const Agenda = require("agenda");
const webPush = require("web-push");
const { user } = require("../Schema/user.schema");
const { Post } = require("../Schema/post.schema");

// Set up the Agenda job scheduler
const mongoConnectionString = process.env.MONGO_URL;
const agenda = new Agenda({ db: { address: mongoConnectionString } });

agenda.define("event_reminder", async (job) => {
  const { eventId } = job.attrs.data;

  try {
    // Find the event by ID
    const updatedEvent = await Post.findById(eventId);
    if (!updatedEvent) {
      console.error(`Event with ID ${eventId} not found`);
      return;
    }

    const usersToNotify = updatedEvent.savedBy;

    // Use Promise.all to send notifications in parallel
    const notificationPromises = usersToNotify.map(async (userId) => {
      try {
        const singleUser = await user.findById(userId);
        if (singleUser && singleUser.notificationToken) {
          const payload = JSON.stringify({
            title: "Event Reminder",
            message: `You have an event starting in 30 minutes!`,
            url: `/events/${eventId}`,
          });

          await webPush.sendNotification(singleUser.notificationToken, payload);
          console.log(`Notification sent to user ${userId}`);
        }
      } catch (error) {
        console.error(`Failed to send notification to user ${userId}:`, error);
      }
    });

    // Wait for all notifications to be sent
    await Promise.all(notificationPromises);
  } catch (error) {
    console.error("Error sending event reminder:", error);
  }
});

agenda.start();
