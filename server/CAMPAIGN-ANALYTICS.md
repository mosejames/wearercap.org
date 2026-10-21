# Newsletter and raffle activity

Aggregate action counts are available from Analytics in an issue's newsletter builder toolbar. Reports require the existing invited-editor session and issue authorization. No new credentials or schema changes.

Encrypted R2 records reuse shared storage and LONDON_IMPORT_STATE_KEY under _analytics/rcap-campaign/. Records contain a random event UUID, a whitelisted event name, newsletter slug and server timestamp only. No stored IP, photo ID, name, class, house, URL query or persistent visitor identifier. IP hashes exist only in a short warm-instance rate limiter. Clients honor Do Not Track and Global Privacy Control.

Photo creator and invitation visits, photo selections, frame changes, creation attempts/errors, server-confirmed card creations, successful native share actions, copy actions, saved cards and outbound ticket clicks are counted. Shares do not confirm recipient delivery or reading. Purchases are not tracked because checkout is external. Existing cards work with the current client instrumentation.

New copied/downloaded newsletters and public issue pages wrap known links in a fixed-destination redirect. Previously sent messages cannot be changed. Editor previews do not count visits. No email open pixel is used. Known crawler/preview agents are skipped, but security scanners can still inflate counts. Browser blocking can undercount. Counts are actions, not unique people. The latest 30 UTC days are reported with a 5,000-event cap and an explicit incomplete flag. Tracking must never block creation or click-throughs.
