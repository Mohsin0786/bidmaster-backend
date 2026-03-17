# Node-starter-template-v2

1. Config - You can add your all configuation and external settings in this
    - contains the validation and logic to export the env variables
    - contains the loggers to handle custom logs, errors or exceptions etc occuring throughout the codebase be it internal or your own logs

2. Constants - contains the constant variables that could be types, options that are used in different models, validations, controllers etc

3. Controllers - contains the function that takes over the request once its validated & authenticated by the middlewares. This is the place where you ensure all the checks/errorHandling, data manipulation/extraction & prepartion of data which will be required by the services.

4. Microservices - contains the 3rd party services for example, notifications, fileUpload, sms etc. 

5. Middlewares - contains the function that are used for validation, authentication, or handling the errors thrown by any service, controller or other functions.

6. Models - Contains the schema of collections and plugins which can be integrated into schema
  - for example: we have paginate plugin that supports - pagination, filtering, sorting, ordering, location search, population 

7. routes - contains versions of all api(s) routes. In initial setup you will have all routes starting from v1 later on you can upgrade.

8. services - contains the function that interacts with Database to do the CRUD operations. Since we are not using Typescript in this templates. It's highly recommended that you handle all your exception and checks in the respective controller before interacting with any service. Services are purely for performing CRUD ops, period.

9. utils - contains the utility functions that you use all across the codebase.

10. validations - contains the validation schemas for each api. Its again highly recommended that if we are not writing test cases then please maintain validators so that we can avoid unnecessary edge cases or wrong request. First thing that we do is validate the request then move to authentication, period. 

- app.js - contains  the configuration of your server

- index.js - boot up script

**Before You Start**
- You have to save the .env file locally with required variables mentioned in config/config.js
- If you don't use any or specific microservice then please remove their validation & cancel their export from config/config.js, otherwise app won't run.

## Render / Production setup (Firebase Admin)

This backend uses **Firebase Admin SDK** (server-side) and expects a **service account** to be provided via environment variables (no `firebase-service-secret.json` file on the server).

- **Recommended (most reliable)**: set `FIREBASE_SERVICE_ACCOUNT_B64` to **base64-encoded JSON**
- **Alternative**: set `FIREBASE_SERVICE_ACCOUNT_JSON` to the **raw JSON string**
- **Back-compat**: `FIREBASE_SERVICE_ACCOUNT` is also accepted as **base64 JSON**

### Generate Base64 on Windows (PowerShell)

From the project root (where your service account file is), run:

```powershell
$bytes = [System.Text.Encoding]::UTF8.GetBytes((Get-Content -Raw .\firebase-service-secret.json))
[Convert]::ToBase64String($bytes)
```

Copy the output into Render as:

- `FIREBASE_SERVICE_ACCOUNT_B64` = `<paste base64 here>`

_Codebase should be like a graden where everyone can move around easily and peacefully._

**_HAPPY CODING..._**
