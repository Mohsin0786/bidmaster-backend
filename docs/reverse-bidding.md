# Reverse Bidding Documentation

## Overview
Reverse bidding (reverse auction) is a competitive procurement mechanism where sellers bid prices down to win a buyer’s requirement. The lowest compliant bid typically wins when the event closes.

## Roles
- **Buyer**: Creates and manages the requirement (event) and its rules.
- **Sellers**: Invited or public participants who place bids to compete on price.

## Lifecycle
1. **Draft**
   - Buyer prepares the requirement privately.
   - Only `title` is required in DRAFT; other fields are optional.
   - Code: `src/validations/requirement.validation.js` and `src/models/requirement.model.js` (conditional required fields).
2. **Publish/Activate**
   - Requirement is made ACTIVE with a complete payload.
   - Required: `title, description, currency, ceilingPrice, minDecrement, startTime, endTime`.
   - Participants (if provided) are processed and invited.
   - Code: `requirement.service.updateRequirementById()` in `src/services/requirement.service.js`.
3. **Live Bidding Window**
   - Sellers place bids between `startTime` and `endTime`.
   - Validation enforces price rules and eligibility.
   - Code: `src/services/bid.service.js`.
4. **Close**
   - At `endTime` (or manual close), no more bids are accepted.
5. **Award**
   - Buyer selects the winner (typically the lowest compliant bid) and proceeds to contracting.

## Key Rules
- **Ceiling price**: The first bid must be `<= ceilingPrice`.
- **Minimum decrement**: Each subsequent bid must be `<= (currentBest - minDecrement)`.
- **Eligibility**: 
  - Public event: anyone can bid.
  - Restricted event: only invited participants can bid; invite matching by `userId` or `email`.
- **One bid per seller per requirement (current setup)**:
  - App-layer check rejects if a user has already bid on that requirement.
  - Optional DB unique index `(requirement, bidder)` can be enabled to hard-enforce this (see Bid model note below).

## Visibility
- **Buyer**: Sees all bids for own requirement.
- **Seller**: Sees only own bids (blind bidding for others).
- Configurable whether to show the current best price publicly (currently computed server-side for rule enforcement).

## Anti-Sniping (Optional)
- Extension of end time if a bid arrives near the deadline (not currently implemented; can be added as a feature).

## Tie-Breaking (Policy)
- If equal best prices occur, choose by earliest timestamp or secondary criteria (e.g., delivery days, quality score) or request BAFO (best and final offer).

## API Reference (Current Implementation)
- **Create Requirement (Draft/Active)**
  - `POST /v1/requirements`
  - Files: `attachments[]` (multipart)
  - Validation: `src/validations/requirement.validation.js`
  - Controller: `src/controllers/requirement.controller.js`
  - Service: `requirement.service.createRequirement()`
- **Publish/Activate Requirement**
  - `PATCH /v1/requirements/:requirementId` with `status: "ACTIVE"`
  - Completeness enforced; participants processed on activation
  - Controller: `requirement.controller.updateRequirement()`
  - Service: `requirement.service.updateRequirementById()`
- **Place Bid**
  - `POST /v1/bids`
  - Files: `attachments[]` (multipart)
  - Validation and rules: `src/services/bid.service.js`
    - `getOpenRequirement()` ensures time window
    - `assertBidderEligibility()` enforces invitations
    - `assertPriceRules()` enforces ceiling/min decrement
    - Duplicate prevention: service checks for existing bid by user for the requirement
- **List Bids**
  - `GET /v1/bids?requirementId=...`
  - Buyer sees all; sellers see their own
  - Service: `bid.service.listBids()`

## Models and Constants
- **Requirement**: `src/models/requirement.model.js`
  - Status: `DRAFT`, `ACTIVE`, `CLOSED`, `AWARDED` (`src/constants/requirement.js`)
  - Conditional required fields based on status
  - Participants with `email`, optional `userId`, and `status` (`INVITED`, `JOINED`)
- **Bid**: `src/models/bid.model.js`
  - Indexed for performance on `requirement`, `bidder`, `(requirement, offeredPrice)`
  - Note: To hard-enforce one bid per user per requirement, add a unique index:
    ```js
    // bidSchema.index({ requirement: 1, bidder: 1 }, { unique: true });
    ```

## Example Flows
- **Draft**
  - Create: `{ "title": "Q4 Procurement", "status": "DRAFT" }`
  - Update freely while in DRAFT.
- **Activate**
  - Patch with all required fields and `status: "ACTIVE"`.
  - Participants (optional) are converted to invitations when activating.
- **Bidding**
  - Seller submits a bid within the window. 
  - First bid must be `<= ceilingPrice`. 
  - Next bids must be `<= currentBest - minDecrement`.
- **Award**
  - Buyer reviews all bids and awards to lowest compliant bidder (policy-driven).

## Operational Notes
- **Time validation**: `endTime` must be greater than `startTime` when activating.
- **Access control**: Routes use `firebaseAuth('All')` to authenticate.
- **Attachments**: Uploaded to storage via `fileUploadService` and associated with requirement/bid.
- **Logging**: Key steps log via `src/config/logger` in services/controllers.

## Future Enhancements
- Anti-sniping time extension
- Configurable visibility of current best price to sellers
- Multi-bid per seller with cooldown or improvement-over-own-last-bid rule
- Award/close endpoints and notifications
