-- Event für zurückgehaltene Entwürfe, die eine Compliance-Regel verletzt haben.
--
-- Gleiche Klasse Fehler wie in 0007: ein EventKind in TypeScript ohne den passenden Wert
-- im Postgres-Enum wirft mitten im Zug einen Fehler. Neue Werte gehören IMMER in beide.

alter type event_kind add value if not exists 'compliance_blocked';
