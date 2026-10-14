-- CHARIS 026 | Department memberships, internal reminders, scoped read/write.
-- Apply ONCE after migration 025. Existing customers, campaigns, user roles and
-- communication sending are untouched. Department assignments are explicit.
BEGIN;
CREATE TABLE IF NOT EXISTS public.charis_departments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
 slug text NOT NULL CHECK (slug ~ '^[a-z][a-z0-9_]{1,49}$'),
 name text NOT NULL CHECK(length(btrim(name)) BETWEEN 3 AND 100),
 description text NOT NULL DEFAULT '',
 active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,id), UNIQUE(organization_id,slug)
);
INSERT INTO public.charis_departments(organization_id,slug,name,description)
SELECT o.id,d.slug,d.name,d.description FROM public.organizations o
CROSS JOIN (VALUES
 ('it','IT / System Administration','Access, integrations and platform security'),
 ('executive','Managing Director / Executive Management','Executive reports and sensitive-communication oversight'),
 ('marketing','Marketing & Business Development','Promotions and customer engagement'),
 ('customer_service','Customer Service','Customer enquiries and preferences'),
 ('operations','Operations','Banking services and operational updates'),
 ('credit','Credit & Loan Recovery','Approved repayment and lending communications'),
 ('compliance','Risk & Compliance','Communication policy and consent oversight'),
 ('audit','Internal Control / Audit','Independent oversight and audit trails'),
 ('finance','Finance & Accounts','Delivery costs and monthly allowance tracking'),
 ('branch','Branch Management','Branch-specific communication coordination'),
 ('hr','Human Resources','Employee-only internal communications')
) d(slug,name,description)
WHERE o.slug='charis-mfb'
ON CONFLICT(organization_id,slug) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.charis_department_members (
 organization_id uuid NOT NULL,
 department_id uuid NOT NULL,
 user_id uuid NOT NULL,
 department_role text NOT NULL DEFAULT 'member' CHECK (department_role IN ('head','member','observer')),
 assigned_by uuid REFERENCES auth.users(id),
 assigned_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,department_id,user_id),
 FOREIGN KEY(organization_id,department_id) REFERENCES public.charis_departments(organization_id,id) ON DELETE CASCADE,
 FOREIGN KEY(organization_id,user_id) REFERENCES public.organization_members(organization_id,user_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS charis_dept_member_user_idx ON public.charis_department_members(organization_id,user_id);

CREATE OR REPLACE FUNCTION public.charis_department_access(p_org uuid,p_dept uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT public.can_manage_team(p_org) OR EXISTS (
  SELECT 1 FROM public.charis_department_members m JOIN public.charis_departments d
   ON d.organization_id=m.organization_id AND d.id=m.department_id
  WHERE m.organization_id=p_org AND m.department_id=p_dept
   AND m.user_id=(SELECT auth.uid()) AND d.active
 );
$$;
REVOKE ALL ON FUNCTION public.charis_department_access(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_department_access(uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.charis_department_can_write(p_org uuid,p_dept uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT public.can_manage_team(p_org) OR EXISTS (
  SELECT 1 FROM public.charis_department_members m JOIN public.charis_departments d
    ON d.organization_id=m.organization_id AND d.id=m.department_id
  WHERE m.organization_id=p_org AND m.department_id=p_dept
   AND m.user_id=(SELECT auth.uid()) AND m.department_role IN ('head','member') AND d.active
 );
$$;
REVOKE ALL ON FUNCTION public.charis_department_can_write(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_department_can_write(uuid,uuid) TO authenticated;

ALTER TABLE public.charis_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.charis_department_members ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.charis_departments,public.charis_department_members FROM PUBLIC,anon;
GRANT SELECT ON public.charis_departments,public.charis_department_members TO authenticated;
DROP POLICY IF EXISTS charis_depts_read ON public.charis_departments;
CREATE POLICY charis_depts_read ON public.charis_departments FOR SELECT TO authenticated
 USING(public.can_manage_team(organization_id) OR public.charis_department_access(organization_id,id));
DROP POLICY IF EXISTS charis_dept_members_read ON public.charis_department_members;
CREATE POLICY charis_dept_members_read ON public.charis_department_members FOR SELECT TO authenticated
 USING(public.can_manage_team(organization_id) OR user_id=(SELECT auth.uid()));

CREATE OR REPLACE FUNCTION public.charis_department_assign(p_org uuid,p_dept uuid,p_user uuid,p_role text,p_remove boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public.can_manage_team(p_org) THEN RAISE EXCEPTION 'Only the system administrator can assign department access';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.charis_departments WHERE organization_id=p_org AND id=p_dept AND active) THEN RAISE EXCEPTION 'Department not found';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.organization_members WHERE organization_id=p_org AND user_id=p_user) THEN RAISE EXCEPTION 'Invite the staff member before assigning a department';END IF;
 IF p_role NOT IN ('head','member','observer') THEN RAISE EXCEPTION 'Invalid department responsibility';END IF;
 IF p_remove THEN
  DELETE FROM public.charis_department_members WHERE organization_id=p_org AND department_id=p_dept AND user_id=p_user;
 ELSE
  INSERT INTO public.charis_department_members(organization_id,department_id,user_id,department_role,assigned_by)
  VALUES(p_org,p_dept,p_user,p_role,auth.uid())
  ON CONFLICT(organization_id,department_id,user_id) DO UPDATE
  SET department_role=EXCLUDED.department_role,assigned_by=EXCLUDED.assigned_by,assigned_at=now();
 END IF;
 INSERT INTO public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,details)
 VALUES(p_org,auth.uid(),CASE WHEN p_remove THEN 'department.member_removed' ELSE 'department.member_assigned' END,
 'department',p_dept::text,jsonb_build_object('user_id',p_user,'responsibility',p_role));
END;$$;
REVOKE ALL ON FUNCTION public.charis_department_assign(uuid,uuid,uuid,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_department_assign(uuid,uuid,uuid,text,boolean) TO authenticated;

-- Internal staff reminders ONLY. No email/SMS customer dispatch is triggered here.
CREATE TABLE IF NOT EXISTS public.charis_reminders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL,
 department_id uuid NOT NULL,
 title text NOT NULL CHECK(length(btrim(title)) BETWEEN 3 AND 160),
 notes text NOT NULL DEFAULT '' CHECK(length(notes)<=1500),
 due_at timestamptz NOT NULL,
 priority text NOT NULL DEFAULT 'normal' CHECK(priority IN ('low','normal','high')),
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','done','cancelled')),
 created_by uuid NOT NULL REFERENCES auth.users(id),
 assigned_to uuid NOT NULL REFERENCES auth.users(id),
 completed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(organization_id,department_id) REFERENCES public.charis_departments(organization_id,id),
 FOREIGN KEY(organization_id,assigned_to) REFERENCES public.organization_members(organization_id,user_id)
);
CREATE INDEX IF NOT EXISTS charis_reminders_org_due_idx ON public.charis_reminders(organization_id,status,due_at);
CREATE INDEX IF NOT EXISTS charis_reminders_assignee_idx ON public.charis_reminders(organization_id,assigned_to,status,due_at);
ALTER TABLE public.charis_reminders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.charis_reminders FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.charis_reminders TO authenticated;
DROP POLICY IF EXISTS charis_reminders_read ON public.charis_reminders;
CREATE POLICY charis_reminders_read ON public.charis_reminders FOR SELECT TO authenticated
 USING(public.charis_department_access(organization_id,department_id));

CREATE OR REPLACE FUNCTION public.charis_reminder_save(p_org uuid,p_dept uuid,p_title text,p_notes text,p_due timestamptz,p_priority text,p_assignee uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid;
BEGIN
 IF NOT public.charis_department_can_write(p_org,p_dept) THEN RAISE EXCEPTION 'Department editing access required';END IF;
 IF length(btrim(coalesce(p_title,''))) NOT BETWEEN 3 AND 160 OR length(coalesce(p_notes,''))>1500
 OR p_due IS NULL OR p_due<now()-interval '1 day' OR p_due>now()+interval '2 years'
 OR p_priority NOT IN ('low','normal','high') THEN RAISE EXCEPTION 'Check the reminder title, date, priority and notes';END IF;
 IF NOT (public.can_manage_team(p_org) OR EXISTS(SELECT 1 FROM public.charis_department_members
  WHERE organization_id=p_org AND department_id=p_dept AND user_id=p_assignee)) THEN
   RAISE EXCEPTION 'Choose a member of this department'; END IF;
 INSERT INTO public.charis_reminders(organization_id,department_id,title,notes,due_at,priority,created_by,assigned_to)
 VALUES(p_org,p_dept,btrim(p_title),p_notes,p_due,p_priority,auth.uid(),p_assignee) RETURNING id INTO v_id;
 INSERT INTO public.audit_logs(organization_id,actor_id,action,entity_type,entity_id)
 VALUES(p_org,auth.uid(),'reminder.created','reminder',v_id::text);
 RETURN v_id;
END;$$;
REVOKE ALL ON FUNCTION public.charis_reminder_save(uuid,uuid,text,text,timestamptz,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_reminder_save(uuid,uuid,text,text,timestamptz,text,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.charis_reminder_status(p_org uuid,p_id uuid,p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.charis_reminders;
BEGIN
 SELECT * INTO r FROM public.charis_reminders WHERE organization_id=p_org AND id=p_id FOR UPDATE;
 IF NOT FOUND OR NOT public.charis_department_can_write(p_org,r.department_id) THEN RAISE EXCEPTION 'Reminder unavailable';END IF;
 IF auth.uid() NOT IN (r.created_by,r.assigned_to) AND NOT public.can_manage_team(p_org) THEN
  RAISE EXCEPTION 'Only the reminder owner or assignee can update it';END IF;
 IF p_status NOT IN ('open','done','cancelled') THEN RAISE EXCEPTION 'Invalid reminder status';END IF;
 UPDATE public.charis_reminders SET status=p_status,completed_at=CASE WHEN p_status='done' THEN now() ELSE NULL END,updated_at=now() WHERE id=p_id;
 INSERT INTO public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,details)
 VALUES(p_org,auth.uid(),'reminder.status_changed','reminder',p_id::text,jsonb_build_object('status',p_status));
END;$$;
REVOKE ALL ON FUNCTION public.charis_reminder_status(uuid,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_reminder_status(uuid,uuid,text) TO authenticated;
-- Extend existing template storage RPC to accept email-safe image and shape blocks.
-- The original authorization, ownership, audit and draft behavior remains unchanged.
CREATE OR REPLACE FUNCTION public.save_email_template(p_id uuid,p_org uuid,p_name text,p_subject text,p_description text,p_category text,p_design jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid;v_owner uuid; b jsonb;
BEGIN
 IF p_org IS NULL THEN
  IF NOT public.is_platform_super_admin() THEN RAISE EXCEPTION 'Not authorized';END IF;
 ELSE
  IF NOT public.can_edit_company_design(p_org) THEN RAISE EXCEPTION 'Not authorized';END IF;
 END IF;
 IF length(trim(coalesce(p_name,''))) NOT BETWEEN 2 AND 120 OR length(coalesce(p_subject,''))>200 THEN RAISE EXCEPTION 'Invalid template name or subject'; END IF;
 IF length(coalesce(p_description,''))>500 OR length(coalesce(p_category,''))>40 THEN RAISE EXCEPTION 'Invalid template metadata';END IF;
 IF jsonb_typeof(p_design) IS DISTINCT FROM 'object' OR length(p_design::text)>60000
   OR p_design->>'version'<>'1' OR jsonb_typeof(p_design->'blocks') IS DISTINCT FROM 'array'
   OR jsonb_array_length(p_design->'blocks') NOT BETWEEN 1 AND 30 THEN RAISE EXCEPTION 'Invalid email design';END IF;
 FOR b IN SELECT value FROM jsonb_array_elements(p_design->'blocks') LOOP
  IF b->>'type' NOT IN ('heading','paragraph','button','divider','image','shape')
   OR length(coalesce(b->>'text',''))>5000 THEN RAISE EXCEPTION 'Unsupported email block';END IF;
  IF b->>'type'='image' THEN
   IF p_org IS NULL OR NOT EXISTS(SELECT 1 FROM public.charis_media_assets
     WHERE organization_id=p_org AND public_url=b->>'url') THEN
      RAISE EXCEPTION 'Email image must come from the bank-approved media library';END IF;
  END IF;
  IF b->>'type'='shape' AND ((b->>'shape') NOT IN ('pill','banner','panel','rule')
    OR (b->>'color') !~ '^#[0-9A-Fa-f]{6}$') THEN RAISE EXCEPTION 'Invalid shape style';END IF;
 END LOOP;
 IF p_id IS NULL THEN
  INSERT INTO public.email_templates(organization_id,name,subject,description,category,design,created_by,updated_by)
  VALUES(p_org,trim(p_name),coalesce(p_subject,''),coalesce(p_description,''),coalesce(p_category,'general'),p_design,auth.uid(),auth.uid()) RETURNING id INTO v_id;
 ELSE
  SELECT organization_id INTO v_owner FROM public.email_templates WHERE id=p_id FOR UPDATE;
  IF NOT FOUND OR v_owner IS DISTINCT FROM p_org THEN RAISE EXCEPTION 'Template not found in this workspace';END IF;
  UPDATE public.email_templates SET name=trim(p_name),subject=coalesce(p_subject,''),description=coalesce(p_description,''),category=coalesce(p_category,'general'),design=p_design,updated_at=now(),updated_by=auth.uid(),status='draft'
  WHERE id=p_id RETURNING id INTO v_id;
 END IF;
 INSERT INTO public.audit_logs(organization_id,actor_id,action,entity_type,entity_id)
 VALUES(p_org,auth.uid(),'template.saved','email_template',v_id::text);
 RETURN v_id;
END;$$;
REVOKE ALL ON FUNCTION public.save_email_template(uuid,uuid,text,text,text,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_email_template(uuid,uuid,text,text,text,text,jsonb) TO authenticated;
COMMIT;
