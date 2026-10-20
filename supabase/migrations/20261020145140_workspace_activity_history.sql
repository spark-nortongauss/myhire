-- Track edits atomically with each successful application mutation. No privileged function.
create function public.record_application_activity() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new is distinct from old then
 insert into public.job_events(user_id,job_application_id,event_type,payload)
 values(new.user_id,new.id,case when new.status is distinct from old.status then 'status_changed' else 'details_updated' end,jsonb_build_object('status',new.status,'previous_status',old.status));
 end if;
 return new;
end;
$$;
revoke all on function public.record_application_activity() from public,anon,authenticated;
create trigger job_application_activity after update on public.job_applications for each row execute function public.record_application_activity();
