var assert = require('assert')
var testParams = require('./testParams.json')
var bitcoin = require('bitcoinjs-lib')
var PaymentChannel = require (__dirname  + "/../src/payment-channel.js")
// var server = require (__direname  + "/app.js")

////////////////TestParams////////////////
var firstPrivateKeyWifUncompressed = testParams.firstPrivateKeyWifUncompressed
var secondPrivateKeyWifUncompressed = testParams.secondPrivateKeyWifUncompressed

var firstPrivateKeyWifCompressed = testParams.firstPrivateKeyWifCompressed
var secondPrivateKeyWifCompressed = testParams.secondPrivateKeyWifCompressed

var uncompressedFirstPublicKey = testParams.uncompressedFirstPublicKey
var uncompressedSecondPublicKey = testParams.uncompressedSecondPublicKey

var firstPublicKeyCompressed = testParams.firstPublicKeyCompressed
var secondPublicKeyCompressed = testParams.secondPublicKeyCompressed

var multisigAddressFromWeb = testParams.multisigAddressFromWeb
var redeemScriptFromWeb = testParams.redeemScriptFromWeb
//////////////////////////////////////////

var options = testParams.options
if (options.network === "bitcoin")
  options.network = bitcoin.networks.bitcoin
else if (options.network === "testnet")
  options.network = bitcoin.networks.testnet

var multisigObject
var app = new PaymentChannel(options)

newMultisigObject = app.getNewMultisigObject(firstPublicKeyCompressed,secondPublicKeyCompressed)
assert(newMultisigObject ,'Problem with data')
assert(newMultisigObject.publicKeys[0] === firstPublicKeyCompressed,'Problem with firstPublicKey')
assert(newMultisigObject.publicKeys[1] === secondPublicKeyCompressed,'Problem with secondPublicKey')
assert(newMultisigObject.multisigAddress === multisigAddressFromWeb,'Problem with multisigAddress')
assert(newMultisigObject.redeemScript === redeemScriptFromWeb,'Problem with redeemScript')
console.log('Passed First tests with the following data: ');
multisigObject = newMultisigObject
console.log(newMultisigObject);

app.getAccountBalance(multisigObject,
  function (err,data) {
    if (err) return console.log(err)
  
    assert(data ,'Problem with data')
    assert(data.returnAddress === '17hugGSy9akmxv9wRWXdLXpw1QeYN36vnf','Problem with returnAddress')
    assert(data.firstTxId === '300a9f23d26def68601e3952c236c6568623952469fa4e001a64d0dd9bd9c35c','Problem with firstTxId')
    assert(data.balance === 10000,'Problem with balance')
  
    console.log('Passed Second tests with the following data: ');
    console.log(data);
  }
);