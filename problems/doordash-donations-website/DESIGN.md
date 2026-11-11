# Donations Website: Design

## Requirements

### Functional

1. Users must be able to see a list of available charities
2. User can select a charity and enter a custom donation amount
3. Users should be able to see the live total number of donations for each charity

### Non-functional

1. No double charges and no lost donations
2. Handle 5 - 10k / s donations at peak
3. Accepting donations stays highly available during broadcast
4. Up to 5 seconds of lag in donation total consistency

### Scale estimates

## API

1. GET api/charity/list

```
   response: [
    {
        charity_id: number,
        name: string,
        started_in: string,
        image_url: string,
        total_donations: number,
        total_donation_amount: string,
    }
   ]
```

2. POST api/pay/${user_id}

```
   body: {
        idempotency_key: string,
        card_number: string,
        payment_method: string,
        signature: string // can be ccv or pin depending on the type
        zip_code: string,
        charity_id: string,
        amount: number,
   }
```

```
Response: {
    transaction_id: string,
    status: string,

}
```

3. GET api/pay/${tansaction_id}

## Data model

DB:

Charity Table:
id INT PRIMARY KEY,
name VARCHAR(50) NOT NULL,
image_url VARCHAR(100),
description: TEXT,
started_in: TIMESTAMPTZ,

User Table:
id INT PRIMARY KEY
first_name VARCHAR(50) NOT NULL,
last_name VARCHAR(50) NOT NULL,
email VARCHAR(100) UNIQUE,

Transaction Table:
id UUID PRIMARY KEY,
user_id INT REFERENCES User(id),
charity_id INT REFERENCES Charity(id),
campaign_id INT REFERENCES Campaign(id),
psp_id VARCHAR(100) NOT NULL,
payment_token VARCHAR(256) NOT NULL,
idempotency_key VARCHAR(50) UNIQUE,
amount INT NOT NULL,
status VARCHAR(50), #PENDING, SUCCESS, FAIL, ARCHIVED
date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP

Campaign Table;
id INT PRIMARY KEY,
name VARCHAR(50) NOT NULL,
description TEXT,
status VARCHAR (100), NOT NULL,
start_date TIMESTAMPTZ NOT NULL,
end_date TIMESTAMPTZ NOT NULL,

Campaign_to_Charity
id INT PRIMARY KEY,
campaign_id REFERENCES Campaign(id),
charity_id REFERENCES Charity(id),

NO SQL DB:

```
{
    donation_id: string,
    user_id: number,
    payment_id: string,
    charity_id: number,
    amount: number,
    status: string,
    date: string,
    error_code: number,
    error_message: string,
}
```

Dead Letter queue same as above

## High-level architecture

1. Because we dealing with money, the most important thing is data correctness, and then second availability during critical hours. We use a relational database to store basic relationship data such as users, campaigns, charities, etc, and a DynamoDB to store transaction data since those will have a heavy load during critical times.
2. The Backend will be split into 2 or 3 services: The charity service, and the payment service. If this is a part of an established company, there will probably already be a separate user service that handles login, authentitation, and user accounts.
3. Assuming this is from an established company, the frontend will similarly be separated into 3 frontends, with login and authentication being a modal that can pop up whenever a session expires, the payment page being a separate portal, and the main charity donations page.

## Payment flow

1. payment service stores data in NOSQL DB with status PENDING
2. once bank / stripe, or whatever finishes, change the status to SUCCESS or Fail,
3. Worker periodically checks NoSQL DB for transactions writes to SQL DB

## Failure handling

1. If fail, retry up to 3 times, if denied, do not retry. Retries will use the same idempotency key
2. if server crash after Payment provider charged, we will still have pending so the worker, when it
   sweeps through the DB should check if the PENDING rows need to be reconciled.

## Backup payment methods

## Payouts & totals

1. If a payment is still processing during payout, we can always query again later and do a separate ledger
2. charity service will query for all payments relating to a specific charity during a specific campaign

## Tradeoffs / open questions

## Corrections

1. For payment use Dynamo DB as a single source of truth. At the end of the campaign, have a worker process that data and store it in a warehouse for reporting

NO SQL DB:

```
{
    donation_id: string,
    user_id: number,
    payment_id: string,
    charity_id: number,
    amount: number,
    status: string,
    date: string,
    error_code: number,
    error_message: string,
}
```

2. For possible PSP overload, we put those requests in a queue and return pending right away to client.
   Client periodically polls GET api/transactions/${transaction_id}

3. We don't have to store the campaign totals but have DynamoDB stream be connected to lambda that updates redis. FE display data is eventually consistent Then, at the end of the campaign, that worker can do final query and write it to final DB for reckoning. DynamoDB stream / logger can be connected to some kind of lambda that updates the redis totals, sends user the receipt, and copy to warehouse for payouts
