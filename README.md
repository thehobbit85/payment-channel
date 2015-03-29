# payment-channel

Two JavaScript modules that will create a payment channel between the server side (nodejs) and the client side (JavaScript jQuery) on top of Socket.io framework. With a payment channel you can provide a trust-less time/token based payment system that provide both the user's and the provider protection against fruad and it's currently the best way of providing this kind of service.

### Payment Channel's Option Object 

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