## Authorization
-- Request application authorization
    - Request structure
```json
    "https://sandbox.kopokopo.com/oauth/token", {
        "client_id": `${client_id}`,
        "Content-Type": "application/x-ww-form-urlencoded",
        "User-Agent": "<product>/<product-version> <comment>",
    }
``` - Response structure
```json
    {
        "access_token": "JCGQXLrlfuOqdUYdTcLz3rBiCZQDRvdWIUPkw++GMuGhkem9Bo",
        "token_type": "Bearer",
        "expires_in": 3600,
        "created_at": "2026-04-27T00:09:15+03:00"
    }
```
```javascript
    const options = {
        clientId: 'YOUR_CLIENT_ID',
        clientSecret: 'YOUR_CLIENT_SECRET',
        apiKey: 'YOUR_API_KEY',
        baseUrl: 'https://sandbox.kopokopo.com'
    }

    //Including the kopokopo module
    var K2 = require("k2-connect-node")(options)

    const TokenService = K2.TokenService

    TokenService
        .getToken()
        .then(response => {
            //Developer can decide to store the token_details and track expiry
            console.log(response)
        })
        .catch( error => {
            console.log(error);
        })
```


-- Request token information
    - Request structure
```json
    "https://sandbox.kopokopo.com/oauth/token/info", {
        "Authorization": "Bearer access_token",
        "User-Agent": "<product>/<product-version> <comment>",
    }
``` - Response structure
```json
    {
        "resource_owner_id": null,
        "scope": [],
        "expires_in": 4498,
        "application": {
            "uid": "_9fXMGROLmSegBhofF6z-qDKHH5L6FsbMn2MgG24Xnk"
        },
        "created_at": 1613376955
    }
```
```javascript
    const options = {
        clientId: 'YOUR_CLIENT_ID',
        clientSecret: 'YOUR_CLIENT_SECRET',
        baseUrl: 'https://sandbox.kopokopo.com',
        apiKey: 'YOUR_API_KEY',
    }

    //Including the kopokopo module
    var K2 = require("k2-connect-node")(options)

    const TokenService = K2.TokenService

    TokenService
        .infoToken({accessToken: 'my_access_token'})
        .then(response => {
            //Developer can decide to store the token_details and track expiry
            console.log(response)
        })
        .catch( error => {
            console.log(error);
        })
```

-- Create webhook subcription
    - Request header structure
```json
    "https://sandbox.kopokopo.com/api/v2/webhook_subscriptions" , {
        "Accept": "application/json", 
        "Content-Type": "application/json",
        "Authorization": "Bearer 0Sn0W6kzNicvoWhDbQcVSKLRUpGjIdlPSEYyrHqrDDoRnQwE7Q",
        "User-Agent": "< product >/< product-version > < comment >"
    }
``` - body structure
```json
    {
        "event_type": "buygoods_transaction_received",
        "url": "https://myapplication.com/webhooks",
        "scope": "till",
        "scope_reference": "555555",
        "enable_daraja_payload": false
    }
```
```javascript
    const Webhooks = K2.Webhooks

    var requestBody = {
    eventType: 'buygoods_transaction_received',
    url: 'https://myawesomeapplication.com/destination',
    scope: 'till',
    scopeReference: '555555', // Your till number
    accessToken: 'my_access_token',
    enableDarajaPayload: false
    }

    Webhooks
        .subscribe(subscribeOptions)
        .then(response => { console.log(response) })
        .catch(error => { console.log(error) })
```

    -  On success
        HTTP/1.1 201 Created Location: https://sandbox.kopokopo.com/api/v2/webhook_subscriptions/d76265cd-0951-e511-80da-0aa34a9b2388

    -  On fail
        HTTP/1.1 400 Bad Request

        { "error_code": 400, "error_message": "Invalid scope reference" } 


## Note: The signature is contained in the X-KopoKopo-Signature header and is a SHA256 HMAC hash of the request body with the key being your API Key. ~ Validating webhooks

-- Receive payments from M-PESA users via STK Push.
    - Request header structure
```json
    "https://sandbox.kopokopo.com/api/v2/incoming_payments" , {
        "Accept": "application/json", 
        "Content-Type": "application/json",
        "Authorization": "Bearer 0Sn0W6kzNicvoWhDbQcVSKLRUpGjIdlPSEYyrHqrDDoRnQwE7Q",
        "User-Agent": "< product >/< product-version > < comment >"
    }
``` - Body structure
```json
    {
        "payment_channel": "M-PESA STK Push",
        "till_number": "K000000 || 000000",
        "subscriber": {
            "first_name": "Joe",
            "last_name": "Buyer",
            "phone_number": "+254999999999",
            "email": "jbuyer@mail.net"
        },
        "amount": {
            "currency": "KES",
            "value": 20000
        },
        "metadata": {
            "customer_id": "123456789",
            "reference": "123456",
            "notes": "Payment for invoice 12345"
        },
        "_links": {
            "callback_url": "https://callback_to_your_app.your_application.com"
        }
    }
```
```javascript
    const StkService = K2.StkService;

    var stkOptions = {
        paymentChannel: "M-PESA STK Push",
        tillNumber: "K000000 || 000000",
        firstName: "Jane",
        lastName: "Doe",
        phoneNumber: "+254999999999",
        email: "example@example.com",
        currency: "KES",
        // A maximum of 5 key value pairs
        metadata: {
            customerId: "123456789",
            reference: "123456",
            notes: "Payment for invoice 123456",
        },
        // This is where once the request is completed kopokopo will post the response
        callbackUrl: "https://callback_to_your_app.your_application.com/endpoint",
        accessToken: "myRand0mAcc3ssT0k3n",
    };

    StkService.initiateIncomingPayment(stkOptions)
        .then((response) => {
            console.log(response);
            // => 'https://sandbox.kopokopo.com/api/v2/incoming_payments/247b1bd8-f5a0-4b71-a898-f62f67b8ae1c'
        })
        .catch((error) => {
            console.log(error);
        });
```

    - On success
        HTTP/1.1 201 Created Location: https://sandbox.kopokopo.com/api/v2/incoming_payments/247b1bd8-f5a0-4b71-a898-f62f67b8ae1c 

    - On error
        HTTP/1.1 400 Bad Request

        { "error_code": 400, "error_message": "Till number can't be blank" }

-- Process Incoming Payment Result: callback
    - Request header structure
```json
 "https://your-callback-url.com/api/v2/payment_request_result", 
 {
    "Content-Type": "application/json",
    "User-Agent": "< product >/< product-version > < comment >", "X-KopoKopo-Signature": "0Sn0W6kzNicvoWhDbQcVSKLRUpGjIdlPSEYyrHqrDDoRnQwE7"
 }
 ```
    - Response structure: on success
 ```json
 {
  "data": {
    "id": "a652f86f-f2aa-4d70-baa2-ccfe4b78f4fc",
    "type": "incoming_payment",
    "attributes": {
      "initiation_time": "2020-10-19T09:24:48.622+03:00",
      "status": "Success",
      "event": {
        "type": "Incoming Payment Request",
        "resource": {
          "id": "52f86f-f2aa-4d70-baa2-ccfe4b78f4fc",
          "reference": "OJJ1MPU40Z",
          "origination_time": "2020-10-19T09:24:54+03:00",
          "sender_phone_number": "+254999999999",
          "amount": "100.0",
          "currency": "KES",
          "till_number": "K000000",
          "system": "Lipa Na M-PESA",
          "status": "Received",
          "sender_first_name": "Joe",
          "sender_middle_name": null,
          "sender_last_name": "Buyer"
        },
        "errors": null
      },
      "metadata": {
        "customer_id": "123456789",
        "reference": "123456",
        "notes": "Payment for invoice 12345"
      },
      "_links": {
        "callback_url": "https://webhook.site/675d4ef4-0629-481f-83cd-d101f55e4bc8",
        "self": "http://sandbox.kopokopo.com/api/v2/incoming_payments/a652f86f-f2aa-4d70-baa2-ccfe4b78f4fc"
      }
    }
  }
}
 ```
    - Response structure: on error/fail
 ```json
 {
  "data": {
    "id": "09bc45fc-3b97-4c44-b860-42a7bcbd7480",
    "type": "incoming_payment",
    "attributes": {
      "initiation_time": "2020-10-15T09:45:18.843+03:00",
      "status": "Failed",
      "event": {
        "type": "Incoming Payment Request",
        "resource": null,
        "errors": ["The initiator information is invalid."]
      },
      "metadata": {
        "customer_id": "123456789",
        "reference": "123456",
        "notes": "Payment for invoice 12345"
      },
      "_links": {
        "callback_url": "https://webhook.site/675d4ef4-0629-481f-83cd-d101f55e4bc8",
        "self": "http://localhost:3000/api/v2/incoming_payments/09bc45fc-3b97-4c44-b860-42a7bcbd7480"
      }
    }
  }
}
```

-- Query Incoming Payment status

```javascript
var StkService = K2.StkService;
var stkUrl =
  "https://sandbox.kopokopo.com/api/v2/incoming_payments/d76265cd-0951-e511-80da-0aa34a9b2388";

StkService.getStatus({ accessToken: "myRand0mAcc3ssT0k3n", location: stkUrl })
  .then((response) => {
    console.log(response);
  })
  .catch((error) => {
    console.log(error);
  });
```
    -  On success
```json
{
  "data": {
    "id": "a652f86f-f2aa-4d70-baa2-ccfe4b78f4fc",
    "type": "incoming_payment",
    "attributes": {
      "initiation_time": "2020-10-19T09:24:48.622+03:00",
      "status": "Success",
      "event": {
        "type": "Incoming Payment Request",
        "resource": {
          "id": "52f86f-f2aa-4d70-baa2-ccfe4b78f4fc",
          "reference": "OJJ1MPU40Z",
          "origination_time": "2020-10-19T09:24:54+03:00",
          "sender_phone_number": "+254999999999",
          "amount": "100.0",
          "currency": "KES",
          "till_number": "K000000",
          "system": "Lipa Na M-PESA",
          "status": "Received",
          "sender_first_name": "Joe",
          "sender_middle_name": null,
          "sender_last_name": "Buyer"
        },
        "errors": null
      },
      "metadata": {
        "customer_id": "123456789",
        "reference": "123456",
        "notes": "Payment for invoice 12345"
      },
      "_links": {
        "callback_url": "https://webhook.site/675d4ef4-0629-481f-83cd-d101f55e4bc8",
        "self": "http://sandbox.kopokopo.com/api/v2/incoming_payments/a652f86f-f2aa-4d70-baa2-ccfe4b78f4fc"
      }
    }
  }
}
```
    -   On error/fail
```json
{
  "data": {
    "id": "e192ac63-8b24-4caf-8637-a2a9b75a14e6",
    "type": "incoming_payment",
    "attributes": {
      "initiation_time": "2020-10-27T11:16:42.364+03:00",
      "status": "Pending",
      "event": {
        "type": "Incoming Payment Request",
        "resource": null,
        "errors": null
      },
      "metadata": {
        "customer_id": "123456789",
        "reference": "123456",
        "notes": "Payment for invoice 12345"
      },
      "_links": {
        "callback_url": "https://webhook.site/675d4ef4-0629-481f-83cd-d101f55e4bc8",
        "self": "http://localhost:3000/api/v2/incoming_payments/e192ac63-8b24-4caf-8637-a2a9b75a14e6"
      }
    }
  }
}
```


-- Reversal

```javascript
const ReversalService = K2.ReversalService

const reversalOpts = {
  transactionReference: "transaction_reference",
  reason: "reason",
  callbackUrl: "https://8650bfeddc80.ngrok.io/reversals/result",
  metadata: {
    notes: "Sample Reversal transaction",
    customId: "custom123"
  },
  accessToken: "access_token",
};

ReversalService
  .initiateReversal(reversalOpts)
  .then(response => {
    console.log(response) // => 'https://sandbox.kopokopo.com/api/v2/reversals/cc438b3e-ecf0-4600-b9cc-edba32ae7019'
  })
  .catch(error => {
    console.log(error)
  })
```

    - On success
    HTTP/1.1 201 Created Location: https://sandbox.kopokopo.com/api/v2/reversals/247b1bd8-f5a0-4b71-a898-f62f67b8ae1c 

 ```json   
    {
        "data": {
            "id": "67b1bb87-b89b-4366-93c9-a2bb6944ec99",
            "type": "reversals",
            "attributes": {
                "status": "Processed",
                "created_at": "2025-10-31T16:32:54.952+03:00",
                "transaction_reference": "059278a2-8ffe-4f31-b3b4-d6c76770c72f",
                "reason": "Testing Reversals",
                "reversal_bulk_payment": {
                    "amount": "400.0",
                    "status": "Transferred",
                    "origination_time": "2025-10-31T12:55:18.000+03:00",
                    "transaction_reference": "ce430292-899b-4543-beb8-4195875dc063"
                },
            "errors":null,
            "metadata": {
                "name": "Test"
            },
            "_links": {
                "callback_url": "https://your_callback_url.com/",
                "self": "https://sandbox.kopokopo.com/api/v2/reversals/67b1bb87-b89b-4366-93c9-a2bb6944ec99"
            }
        }
        }
    }
```
    - On fail/error
    { "error_code": 400, "error_message": [ "You cannot reverse a transaction in Pending Reversal" ] }

```json
{
  "data": {
    "id": "c5486bd6-54c5-4d38-9e8a-e5a3597cd704",
    "type": "reversals",
    "attributes": {
      "status": "Processed",
      "created_at": "2025-11-24T13:11:13.255+03:00",
      "transaction_reference": "8b275328-3b33-4144-9163-b2badbfb5de3",
      "reason": "Testing Reversals",
      "reversal_bulk_payment": {
        "amount": "1300.0",
        "status": "Cancelled",
        "origination_time": "2025-11-24T13:01:18.000+03:00",
        "transaction_reference":null
      },
      "errors": ["The balance is insufficient for the transaction"],
      "metadata": {
        "name": "Test"
      },
      "_links": {
        "callback_url": "https://your_callback_url.com/",
        "self": "https://sandbox.kopokopo.com/api/v2/reversals/c5486bd6-54c5-4d38-9e8a-e5a3597cd704"
      }
    }
  }
}
```