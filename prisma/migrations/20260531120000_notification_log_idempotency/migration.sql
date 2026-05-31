DELETE FROM "NotificationLog" a
USING "NotificationLog" b
WHERE a."eventId" = b."eventId"
    AND a."channelId" = b."channelId"
    AND (
        a."createdAt" < b."createdAt"
        OR (a."createdAt" = b."createdAt" AND a."id" < b."id")
    );

ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_eventId_channelId_key" UNIQUE ("eventId", "channelId");
