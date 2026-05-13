-- App expects status `completed` when editor taps «Өңдеуді аяқтау» (completeEditorOrder).
-- Original enum omitted this value — Postgres rejects updates until this runs once.

ALTER TYPE order_status ADD VALUE 'completed';
