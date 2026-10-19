UPDATE "StudentTeam"
SET
    "ratingAverage" = COALESCE(
        (SELECT AVG("rating") FROM "Review"
         WHERE "reviewedTeamId" = "StudentTeam"."id"
           AND "direction" = 'BUSINESS_TO_TEAM'),
        0
    ),
    "ratingCount" = (
        SELECT COUNT(*) FROM "Review"
        WHERE "reviewedTeamId" = "StudentTeam"."id"
          AND "direction" = 'BUSINESS_TO_TEAM'
    );
