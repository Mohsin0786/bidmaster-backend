# Email Notification Feature for Bidding End

## Overview
Automated email notifications are sent when a requirement's bidding period ends. The system uses **Bull MQ** with **Redis** for reliable job scheduling.

---

## How It Works

### 1. **Job Scheduling**
When a requirement is created or updated with `status: ACTIVE`:
- A delayed job is scheduled in Bull queue
- Job fires exactly at `endTime`
- Job persists in Redis (survives server restarts)

### 2. **Job Processing**
When `endTime` arrives, the worker:
1. Finds the winning bid (lowest `offeredPrice`)
2. Updates requirement status:
   - `CLOSED` if no bids received
   - `AWARDED` if winner exists
3. Sends emails to relevant parties

### 3. **Email Recipients**

#### **No Bids Scenario:**
- **Creator** receives: "No bids received" notification

#### **Winner Exists Scenario:**
- **Creator** receives: Winner details (name, email, winning price)
- **Winner** receives: Congratulations message with creator contact

---

## Architecture

```
Requirement Created (ACTIVE)
    ↓
Schedule job in Bull Queue (stored in Redis)
    ↓
Server can restart multiple times (job persists)
    ↓
At endTime, Bull worker processes job
    ↓
Find winner → Update status → Send emails
```

---

## File Structure

```
src/
├── jobs/
│   ├── index.js                    # Export queues
│   ├── queues/
│   │   └── bidding.queue.js        # Bull queue configuration
│   └── workers/
│       └── bidding.worker.js       # Process close-bidding jobs
├── services/
│   └── requirement.service.js      # Schedule/reschedule jobs
├── microservices/
│   └── email.service.js            # SendGrid email sender
└── index.js                        # Initialize worker on startup
```

---

## Key Features

### ✅ **Persistent Jobs**
- Jobs stored in Redis
- Survive server restarts
- Execute at exact `endTime`

### ✅ **Automatic Rescheduling**
- If `endTime` is updated → Old job removed, new job scheduled
- If requirement deleted → Job removed

### ✅ **Retry Logic**
- Failed jobs retry up to 3 times
- Exponential backoff (5s, 10s, 20s)

### ✅ **Graceful Shutdown**
- Bull queue closes cleanly on server shutdown
- No job loss

---

## Environment Variables

Add to `.env`:

```env
# SendGrid (required for emails)
SENDGRID_API_KEY=your_sendgrid_api_key
SENDGRID_FROM_EMAIL=no-reply@yourdomain.com
SENDGRID_FROM_NAME=BiddingMaster

# Redis (already configured)
REDIS_URL=redis://localhost:6379
# OR
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
```

---

## Installation

```bash
npm install bull @sendgrid/mail
```

---

## Usage Examples

### **Create ACTIVE Requirement (Auto-schedules job)**
```javascript
POST /v1/requirements
{
  "title": "Website Development",
  "status": "ACTIVE",
  "endTime": "2025-10-15T14:00:00Z",
  "ceilingPrice": 50000,
  // ... other fields
}
```
→ Job scheduled for 2025-10-15 14:00 UTC

### **Update endTime (Auto-reschedules)**
```javascript
PATCH /v1/requirements/:id
{
  "endTime": "2025-10-16T10:00:00Z"
}
```
→ Old job removed, new job scheduled

### **Delete Requirement (Auto-removes job)**
```javascript
DELETE /v1/requirements/:id
```
→ Scheduled job removed

---

## Email Templates

### **No Bids Email (to Creator)**
```
Subject: Bidding Ended: [Requirement Title]

Hello [Creator Name],

Your requirement "[Title]" has ended.

Unfortunately, no bids were received for this requirement.

You can create a new requirement or modify the existing one to attract more bidders.

Best regards,
BiddingMaster Team
```

### **Winner Email (to Creator)**
```
Subject: Bidding Ended: [Requirement Title]

Hello [Creator Name],

Your requirement "[Title]" has ended successfully!

Winner Details:
- Name: [Winner Name]
- Email: [Winner Email]
- Winning Bid: INR [Price]
- Delivery Days: [Days]

You can now proceed to contact the winner and finalize the deal.

Best regards,
BiddingMaster Team
```

### **Congratulations Email (to Winner)**
```
Subject: Congratulations! You Won: [Requirement Title]

Hello [Winner Name],

Congratulations! You have won the bid for "[Title]"!

Your Winning Bid: INR [Price]
Delivery Days: [Days]

The requirement creator will contact you soon to finalize the details.

Creator Contact:
- Name: [Creator Name]
- Email: [Creator Email]

Best regards,
BiddingMaster Team
```

---

## Monitoring & Debugging

### **Check Scheduled Jobs**
```javascript
const { biddingQueue } = require('./jobs');

// Get all delayed jobs
const delayed = await biddingQueue.getDelayed();
console.log(delayed);

// Get specific job
const job = await biddingQueue.getJob('close-bidding-<requirementId>');
console.log(job.data, job.opts.delay);
```

### **Logs to Watch**
```
✅ Scheduled close-bidding job for requirement <id> at <endTime>
✅ Processing close-bidding job for requirement: <id>
✅ Requirement <id> awarded to bidder <bidderId>
✅ Winner notification email sent to creator: <email>
✅ Congratulations email sent to winner: <email>
```

---

## Edge Cases Handled

| Scenario | Behavior |
|----------|----------|
| No bids received | Status → `CLOSED`, email to creator |
| Winner exists | Status → `AWARDED`, emails to creator + winner |
| Requirement already closed | Skip job (idempotent) |
| endTime updated | Reschedule job automatically |
| Requirement deleted | Remove scheduled job |
| Server restarts | Jobs persist in Redis, execute on time |
| Email fails | Retry 3 times with backoff |

---

## Testing

### **Test with Short Duration**
```javascript
POST /v1/requirements
{
  "title": "Test Requirement",
  "status": "ACTIVE",
  "endTime": "2025-10-12T14:05:00+05:30", // 5 minutes from now
  "ceilingPrice": 1000,
  "minDecrement": 10,
  "startTime": "2025-10-12T14:00:00+05:30"
}
```

### **Place a Bid**
```javascript
POST /v1/bids
{
  "requirement": "<requirementId>",
  "offeredPrice": 900
}
```

### **Wait for endTime**
- Check logs for job processing
- Check emails in SendGrid dashboard
- Verify requirement status updated to `AWARDED`

---

## Future Enhancements

- [ ] HTML email templates with branding
- [ ] Email to all participants (not just winner)
- [ ] SMS notifications via Twilio
- [ ] Push notifications via Firebase
- [ ] Bull Board UI for job monitoring
- [ ] Separate worker server for scaling

---

## Troubleshooting

### **Jobs not executing?**
1. Check Redis connection: `redis-cli ping`
2. Check worker initialized: Look for "Bull worker initialized" in logs
3. Check job exists: `await biddingQueue.getJob('close-bidding-<id>')`

### **Emails not sending?**
1. Verify `SENDGRID_API_KEY` is set
2. Check SendGrid dashboard for errors
3. Check logs for email errors

### **Job scheduled in past?**
- If `endTime < now`, job won't be scheduled
- Check requirement `endTime` is in future

---

## Support

For issues or questions, contact the development team.
