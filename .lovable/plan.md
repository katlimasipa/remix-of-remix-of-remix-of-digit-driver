## Plan

1. **Fix token save/load reliability**
   - Update the profile token loading code so failures are visible instead of silently leaving the token field empty.
   - Ensure the saved token is loaded from the correct account slot: Demo uses `deriv_token_demo`, Real uses `deriv_token_real`, with fallback to the older `deriv_token` field.

2. **Fix profile upsert edge cases**
   - Adjust token saving so it does not accidentally overwrite the wrong token slot when switching between Demo and Real.
   - Preserve the currently selected account type and only update the token field for that account.

3. **Improve user feedback**
   - Show a clear message when token loading fails, saving fails, or no saved token exists for the selected account.
   - Keep the Connect button disabled only when there is genuinely no token available.

4. **Verify the change**
   - Check the relevant code path for syntax/type safety and confirm the UI still shows the token field, Save, and Connect controls correctly.