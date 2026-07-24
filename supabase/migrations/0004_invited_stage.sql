-- Trigger A (cold outbound): a lead we sent a LinkedIn connection request to, waiting for
-- them to accept before the AI fires the opener. Sits between 'new' and 'opener_sent'.
alter type funnel_stage add value if not exists 'invited' before 'opener_sent';
