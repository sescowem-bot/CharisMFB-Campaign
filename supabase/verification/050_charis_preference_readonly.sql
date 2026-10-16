-- Read-only SQL 050 installation check. Expected: all objects present.
SELECT
 to_regclass('public.charis_email_preference_tokens') AS preference_tokens,
 to_regclass('public.charis_optional_email_optouts') AS optional_optouts,
 to_regprocedure('public.charis_customer_email_optout(text)') AS unsubscribe_function;
