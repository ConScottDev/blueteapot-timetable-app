# Functions

## Task Notifications

`notifyTaskParticipants` listens for writes to the `tasks/{taskId}` collection. On create, update, or delete it gathers the participant profile documents from `/users` and emails everyone with an address on file. Updates include a short change summary and the latest task details. The function also leaves a hook for future push notifications via Firebase Cloud Messaging.

### SMTP configuration

Provide SMTP credentials through environment variables before deploying or emulating the functions:

- `SMTP_HOST`
- `SMTP_PORT` (defaults to `587` if omitted)
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM` or `SMTP_SENDER` (optional; falls back to the SMTP user address)

For Firebase Functions this can be set with:

```bash
firebase functions:config:set smtp.host="smtp.example.com" smtp.port="587" smtp.user="user@example.com" smtp.pass="app-password" smtp.from="scheduler@example.com"
```

and then exposed at runtime with:

```bash
firebase deploy --only functions
```

or for local testing:

```bash
firebase emulators:start --only functions   --import=.firebase/emulator-data   --export-on-exit
```

The function reads the credentials from `process.env`, so you can also use `.env` files when running the emulator.

### Push notifications

`maybeQueuePushNotification` is currently a stub. When the mobile client is ready, wire this helper into Firebase Cloud Messaging (FCM) or your preferred push provider. The helper receives the task context so you can target the same participant set.
