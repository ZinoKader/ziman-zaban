revoke truncate, trigger, references on
  public.profiles,
  public.cards,
  public.reviews,
  public.daily_totals,
  public.medals,
  public.content_reports
from anon, authenticated;
