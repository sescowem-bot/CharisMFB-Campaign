# Security and customer communication preferences

## Principle
Account ownership is not blanket permission for promotional messages. Charis must communicate with bank customers for permitted purposes while respecting their preferences, applicable Nigerian data protection requirements and the bank's own compliance policies.

## Distinct purposes
1. **Account/service notices:** operational information for an existing bank relationship, subject to an approved purpose and lawful basis.
2. **Security/regulatory notices:** relevant safety or legally required information, governed by its purpose and separate controls.
3. **Promotional communications:** optional offers and marketing messages, subject to appropriate marketing permission and opt-out preferences.

The current system's campaign recipient eligibility is **marketing-specific**. This release **DOES NOT implement live account-notice** or security-notice delivery. Those require a separate purpose-based, approved channel and should not be used to work around marketing unsubscribe choices.

## Communication Preferences page
Staff with customer-management permission can review five categories: unsubscribed from promotions; declined promotions; permission not confirmed; agreed to promotions; and email delivery blocked. Distinguish a provider bounce/complaint from a customer unsubscribe. Unsubscribing must not delete or close a bank account.

Imported customer consent starts as `unknown`; only a documented permission event may change it to `granted`. `denied` means the customer declined or stopped promotional communication. An existing unsubscribe must not be restored by an ordinary staff edit without a new, evidenced opt-in flow authorised by Charis.

## Required controls
- Authenticated role checks and Supabase RLS enforce access, not UI hiding alone.
- Record campaign creator, reviewer, message revision, recipient eligibility and delivery events.
- Do not permit self-approval of promotional bank campaigns.
- Protect customer files, full account numbers, BVN, NIN, credentials and verification codes.
- Keep only masked account references (up to four digits) in permitted campaign customization.
- Follow delivery-bounce and spam-complaint suppressions.
- Have bank Compliance and the Data Protection Officer approve retention and lawful-basis policies before customer sending.

## Test checklist
Use a controlled opt-out example. Verify it appears in Preferences and is suppressed from future promotional audience counts, including groups and smart groups. Verify an account service notice cannot be sent through the marketing workflow as a workaround. Verify staff without customer-management permission cannot view the preferences page.
