# Payment-Channel

## Payment Channel API

A bitcoin payment channel API that allowes you to provide a trust-less time/token based payment system that provide both the user and the provider protection against fruad and it's currently the best way of providing this kind of service.


## Payment Channel Socket API

Two JavaScript modules that will create a payment channel between the server side (nodejs) and the client side (JavaScript) on top of Socket.io framework.

# Configuration Objects

### v1.0.1 API 

#### Payment Channel Option Object

```json
{
  "privateKey" : "String",
  "returnAddress" : "String",
  "counterPartyAddress" : "String", 
  "counterPartyPublicKey" : "String",
  "chain" : {
    "keyId": "String",
    "keySecret": "String",
    "blockChain": "String"
  },
  "publicKeys" : ["String"],
  "fee" : "Number",
  "tickAmount" : "Number",
  "lastAmount" : "Number",
  "lastSignedTx" : "String",
  "redeemScript" : "String",
  "balance" : "Number",
  "multisigAddress" : "String",
}
```

### v1.0.0 API 

#### Payment Channel's Option Object 

```json
{
  "chain" : {
    "keyId": "String",
    "keySecret": "String",
    "blockChain": "String"
  },
  "fee" : "Number",
  "tickAmount" : "Number"
}
```

### Multisignature Object

```json
{
  "multisigAddress" : "String",
  "publicKeys" : ["String"], 
  "returnAddress" : "String", 
  "lastAmount" : "Number",
  "lastUnsignTxid" : "String",
  "lastSignedTx" : "String",
  "lastTickTx" : "String",
  "firstTxId" : "String",
  "redeemScript" : "String",
  "numOfSigns" : "Number",
  "balance" : "Number"
}
```

ֿ